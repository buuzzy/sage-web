import { importBackupData, type BackupImportResult } from '@/shared/db';
import { supabase } from '@/shared/lib/supabase';

interface CloudSessionRow {
  id: string;
  title?: string | null;
  preview?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message_count?: number | null;
}

interface RestoreCloudConversationsResult extends BackupImportResult {
  cloudSessions: number;
}

export async function restoreCloudConversations(): Promise<RestoreCloudConversationsResult> {
  const [
    { data: sessions, error: sessionsError },
    { data: tasks, error: tasksError },
  ] = await Promise.all([
    supabase.from('sessions').select('*').order('updated_at', {
      ascending: false,
    }),
    supabase.from('tasks').select('*').order('created_at', {
      ascending: true,
    }),
  ]);

  if (sessionsError) {
    throw new Error(`Failed to fetch cloud sessions: ${sessionsError.message}`);
  }
  if (tasksError) {
    throw new Error(`Failed to fetch cloud tasks: ${tasksError.message}`);
  }

  const [
    { data: messages, error: messagesError },
    { data: files, error: filesError },
  ] = await Promise.all([
    supabase.from('messages').select('*').order('created_at', {
      ascending: true,
    }),
    supabase.from('files').select('*').order('created_at', {
      ascending: true,
    }),
  ]);

  if (messagesError) {
    throw new Error(`Failed to fetch cloud messages: ${messagesError.message}`);
  }
  if (filesError) {
    throw new Error(`Failed to fetch cloud files: ${filesError.message}`);
  }

  const normalizedSessions = ((sessions ?? []) as CloudSessionRow[]).map(
    (session) => ({
      id: session.id,
      prompt: session.title || session.preview || session.id,
      task_count: session.message_count ?? 0,
      created_at: session.created_at ?? session.updated_at,
      updated_at: session.updated_at ?? session.created_at,
    })
  );

  const result = await importBackupData({
    sessions: normalizedSessions,
    tasks: tasks ?? [],
    messages: messages ?? [],
    files: files ?? [],
  });

  return {
    ...result,
    cloudSessions: normalizedSessions.length,
  };
}

/**
 * Incremental sync: fetch cloud sessions newer than local latest.
 *
 * Query order: sessions -> tasks (by session_id) -> messages+files (by task_id).
 * This two-step chain is required because messages reference task_id, not session_id.
 */
export async function incrementalCloudSync(): Promise<void> {
  const { getAllSessions } = await import('@/shared/db/sessions');
  const localSessions = await getAllSessions();

  // Find the most recent local updated_at
  let latestLocal: string | null = null;
  if (localSessions.length > 0) {
    const dates = localSessions
      .map((s) => s.updated_at || s.created_at)
      .filter(Boolean) as string[];
    if (dates.length > 0) {
      dates.sort();
      latestLocal = dates[dates.length - 1];
    }
  }

  // Fetch cloud sessions newer than local (or all if fresh device)
  let sessionsQuery = supabase.from('sessions').select('*').order('updated_at', { ascending: false });
  if (latestLocal) {
    sessionsQuery = sessionsQuery.gt('updated_at', latestLocal);
  }
  // Defense-in-depth: RLS already filters by user_id, but add explicit filter too
  const { data: newSessions, error: sessionsError } = await sessionsQuery;
  if (sessionsError) {
    console.warn('[CloudSync] Failed to fetch new sessions:', sessionsError.message);
    return;
  }

  if (!newSessions || newSessions.length === 0) {
    console.log('[CloudSync] No new sessions to sync');
    return;
  }

  console.log(`[CloudSync] Found ${newSessions.length} new/updated sessions, syncing...`);

  const sessionIds = newSessions.map((s: { id: string }) => s.id);

  // Step 1: fetch tasks by session_id
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  if (tasksError) {
    console.warn('[CloudSync] Failed to fetch tasks:', tasksError.message);
  }

  // Step 2: extract real task IDs, then fetch messages and files by task_id
  const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);

  const messagesPromise = taskIds.length > 0
    ? supabase.from('messages').select('*').in('task_id', taskIds).order('created_at', { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const filesPromise = taskIds.length > 0
    ? supabase.from('files').select('*').in('task_id', taskIds).order('created_at', { ascending: true })
    : Promise.resolve({ data: [], error: null });

  const [{ data: messages, error: messagesError }, { data: files, error: filesError }] = await Promise.all([
    messagesPromise,
    filesPromise,
  ]);

  if (messagesError) {
    console.warn('[CloudSync] Failed to fetch messages:', messagesError.message);
  }
  if (filesError) {
    console.warn('[CloudSync] Failed to fetch files:', filesError.message);
  }

  const normalizedSessions = (newSessions as CloudSessionRow[]).map((session) => ({
    id: session.id,
    prompt: session.title || session.preview || session.id,
    task_count: session.message_count ?? 0,
    created_at: session.created_at ?? session.updated_at,
    updated_at: session.updated_at ?? session.created_at,
  }));

  const result = await importBackupData({
    sessions: normalizedSessions,
    tasks: tasks ?? [],
    messages: messages ?? [],
    files: files ?? [],
  });

  console.log(`[CloudSync] Incremental sync done: ${result.sessions} sessions, ${result.tasks} tasks, ${result.messages} messages, ${result.files} files`);
}
