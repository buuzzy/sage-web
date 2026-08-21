/**
 * Session Store — disk-persisted conversation context.
 *
 * Stores full conversation messages and compaction summaries per sessionId
 * in ~/.sage/sessions/{sessionId}.json.
 *
 * The full message history is NEVER truncated on disk — compaction only
 * affects what gets assembled into the model's context window.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { getAppDir } from '@/config/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokenEstimate: number;
}

export interface CompactionSummary {
  summary: string;
  compactedUpTo: number;      // index in messages[] up to which compaction covers
  tokenEstimate: number;
  createdAt: string;
  identifiers: string[];      // preserved paths, IDs, URLs
}

export interface SessionData {
  sessionId: string;
  messages: SessionMessage[];
  compaction: CompactionSummary | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function sessionsDir(): string {
  return join(getAppDir(), 'sessions');
}

function sessionPath(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(sessionsDir(), `${safe}.json`);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function loadSession(sessionId: string): SessionData | null {
  const p = sessionPath(sessionId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(data: SessionData): void {
  const dir = sessionsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  data.updatedAt = new Date().toISOString();
  writeFileSync(sessionPath(data.sessionId), JSON.stringify(data, null, 2), 'utf-8');
}

export function createSession(sessionId: string): SessionData {
  return {
    sessionId,
    messages: [],
    compaction: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cleanup — remove sessions older than N days
// ---------------------------------------------------------------------------

export function cleanupOldSessions(maxAgeDays: number = 7): number {
  const dir = sessionsDir();
  if (!existsSync(dir)) return 0;

  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        unlinkSync(filePath);
        removed++;
      }
    } catch { /* skip */ }
  }

  if (removed > 0) {
    console.log(`[SessionStore] Cleaned up ${removed} old session(s)`);
  }
  return removed;
}
