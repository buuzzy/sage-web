/**
 * Task CRUD operations.
 */

import { enqueueTaskUpsert } from '@/shared/sync/messages-sync';
import {
  markSessionDeleted,
  markSessionDirty,
} from '@/shared/sync/session-dirty-queue';

import { currentUid, getIndexedDB, idbRequest } from './database';
import { deleteMessagesByTaskId } from './messages';
import { getTasksBySessionId, updateSessionTaskCount } from './sessions';
import type { CreateTaskInput, Task, UpdateTaskInput } from './types';

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: input.id,
    session_id: input.session_id,
    task_index: input.task_index,
    prompt: input.prompt,
    status: 'running',
    cost: null,
    duration: null,
    provider_usage: null,
    created_at: now,
    updated_at: now,
  };

  // IndexedDB (Browser)
  const db = await getIndexedDB();
  const tx = db.transaction('tasks', 'readwrite');
  const store = tx.objectStore('tasks');
  await idbRequest(store.put(task));
  console.log('[IDB] Created task:', input.id);

  // Update session task count
  await updateSessionTaskCount(input.session_id, input.task_index);
  if (currentUid) enqueueTaskUpsert(task, currentUid);

  return task;
}

export async function getTask(id: string): Promise<Task | null> {
  const db = await getIndexedDB();
  const tx = db.transaction('tasks', 'readonly');
  const store = tx.objectStore('tasks');
  const result = await idbRequest(store.get(id));
  return result || null;
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getIndexedDB();
  const tx = db.transaction('tasks', 'readonly');
  const store = tx.objectStore('tasks');
  const tasks = await idbRequest(store.getAll());
  // Sort by created_at descending
  return tasks.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task | null> {
  let result: Task | null;
  const db = await getIndexedDB();
  const task = await getTask(id);
  if (task) {
    const updatedTask = {
      ...task,
      ...input,
      updated_at: new Date().toISOString(),
    };
    const tx = db.transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    await idbRequest(store.put(updatedTask));
    result = updatedTask;
  } else {
    result = null;
  }
  // 影响 session 的只有 prompt（title 来源）和 status（间接通过 preview 不变，但语义上是活跃）
  if (result?.session_id) {
    if (currentUid) enqueueTaskUpsert(result, currentUid);
    markSessionDirty(result.session_id);
  }

  return result;
}

export async function deleteTask(id: string): Promise<boolean> {
  // 先记下 session_id，删除前拿到，删除后用它来更新 task_count / 判断是否清空 session
  const task = await getTask(id);
  const sessionId = task?.session_id ?? null;

  const db = await getIndexedDB();
  const tx = db.transaction('tasks', 'readwrite');
  const store = tx.objectStore('tasks');
  await idbRequest(store.delete(id));
  // Also delete related messages
  await deleteMessagesByTaskId(id);
  // Refresh parent session：若 session 还剩 task 则 markDirty，否则 markDeleted
  if (sessionId) {
    try {
      const remaining = await getTasksBySessionId(sessionId);
      if (remaining.length === 0) {
        markSessionDeleted(sessionId);
      } else {
        markSessionDirty(sessionId);
      }
    } catch {
      /* best effort */
    }
  }

  return true;
}

// ============ Message Operations ============
