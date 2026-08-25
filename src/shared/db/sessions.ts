/**
 * Session CRUD operations.
 */

import { markSessionDirty } from '@/shared/sync/session-dirty-queue';

import { getIndexedDB, idbRequest } from './database';
import type { CreateSessionInput, Session, Task } from './types';

export async function createSession(
  input: CreateSessionInput
): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: input.id,
    prompt: input.prompt,
    task_count: 0,
    created_at: now,
    updated_at: now,
  };

  // IndexedDB (Browser)
  const db = await getIndexedDB();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  await idbRequest(store.put(session));
  console.log('[IDB] Created session:', input.id);
  markSessionDirty(input.id);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getIndexedDB();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const result = await idbRequest(store.get(id));
  return result || null;
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getIndexedDB();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const sessions = await idbRequest(store.getAll());
  return sessions.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateSessionTaskCount(
  sessionId: string,
  taskCount: number
): Promise<void> {
  const db = await getIndexedDB();
  const session = await getSession(sessionId);
  if (session) {
    const updatedSession = {
      ...session,
      task_count: taskCount,
      updated_at: new Date().toISOString(),
    };
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    await idbRequest(store.put(updatedSession));
  }
  markSessionDirty(sessionId);
}

export async function getTasksBySessionId(sessionId: string): Promise<Task[]> {
  const db = await getIndexedDB();
  const tx = db.transaction('tasks', 'readonly');
  const store = tx.objectStore('tasks');
  try {
    const index = store.index('session_id');
    const tasks = await idbRequest(index.getAll(sessionId));
    return tasks.sort((a, b) => (a.task_index || 0) - (b.task_index || 0));
  } catch {
    // Index may not exist
    return [];
  }
}

// ============ Task Operations ============
