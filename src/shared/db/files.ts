/**
 * Library file CRUD operations.
 */

import { enqueueFileUpsert } from '@/shared/sync/messages-sync';
import { markSessionDirty } from '@/shared/sync/session-dirty-queue';
import { uuidv7 } from 'uuidv7';

import {
  currentUid,
  getIndexedDB,
  getSQLiteDatabase,
  idbRequest,
} from './database';
import { getTask } from './tasks';
import type { CreateFileInput, LibraryFile } from './types';

export async function createFile(input: CreateFileInput): Promise<LibraryFile> {
  // Phase 1: files 也用 UUID v7（跨设备唯一，与 messages 一致）
  const id = uuidv7();
  const now = new Date().toISOString();

  const userId = currentUid;
  if (!userId) {
    throw new Error(
      '[DB] createFile called without bound user. AuthProvider must bindUserId() before any DB ops.'
    );
  }

  const file: LibraryFile = {
    id,
    user_id: userId,
    task_id: input.task_id,
    name: input.name,
    type: input.type,
    path: input.path,
    preview: input.preview ?? null,
    thumbnail: input.thumbnail ?? null,
    is_favorite: false,
    created_at: now,
    updated_at: now,
  };

  const database = await getSQLiteDatabase();
  if (database) {
    await database.execute(
      `INSERT INTO files (id, user_id, task_id, name, type, path, preview, thumbnail, is_favorite, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        file.id,
        file.user_id,
        file.task_id,
        file.name,
        file.type,
        file.path,
        file.preview,
        file.thumbnail,
        file.is_favorite ? 1 : 0,
        file.created_at,
        file.updated_at,
      ]
    );
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    await idbRequest(store.add(file));
  }

  enqueueFileUpsert(file);

  // 新增 file 会让 session 的 has_artifacts 变成 true
  try {
    const task = await getTask(input.task_id);
    if (task?.session_id) markSessionDirty(task.session_id);
  } catch {
    /* best effort */
  }

  return file;
}

export async function getFilesByTaskId(taskId: string): Promise<LibraryFile[]> {
  const database = await getSQLiteDatabase();

  if (database) {
    return database.select<LibraryFile>(
      'SELECT * FROM files WHERE task_id = $1 ORDER BY created_at ASC',
      [taskId]
    );
  } else {
    const db = await getIndexedDB();
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const index = store.index('task_id');
    const files = await idbRequest(index.getAll(taskId));
    return files.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
}
