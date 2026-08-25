/**
 * Attachment utilities
 *
 * Web 模式下附件以 data URL 形式随消息存储/传输（IndexedDB + Supabase）。
 */

import type { MessageAttachment } from '@/shared/hooks/useAgent';

/**
 * Save attachment (web: keep as in-memory data URL, persisted with the message)
 * Returns the file path (relative to session folder)
 */
export async function saveAttachmentToFile(
  sessionFolder: string,
  attachment: MessageAttachment
): Promise<string> {
  // Web mode: attachments stay as in-memory data URLs (persisted with the message)
  return attachment.data;
}

/**
 * Load attachment from file system
 * Takes a file path and returns base64 data URL
 */
export async function loadAttachmentFromFile(
  filePath: string,
  mimeType?: string
): Promise<string> {
  // Web mode: only data URLs can be loaded; plain paths have no backing file
  return filePath;
}

/**
 * Guess MIME type from file extension
 */

/**
 * Attachment reference stored in database
 * Contains path instead of actual data
 */
export interface AttachmentReference {
  id: string;
  type: 'image' | 'file';
  name: string;
  path: string; // File path instead of data
  mimeType?: string;
}

/**
 * Convert MessageAttachment to AttachmentReference (for database storage)
 */
export async function attachmentToReference(
  sessionFolder: string,
  attachment: MessageAttachment
): Promise<AttachmentReference> {
  const filePath = await saveAttachmentToFile(sessionFolder, attachment);

  return {
    id: attachment.id,
    type: attachment.type,
    name: attachment.name,
    path: filePath,
    mimeType: attachment.mimeType,
  };
}

/**
 * Convert AttachmentReference back to MessageAttachment (for display)
 */
export async function referenceToAttachment(
  ref: AttachmentReference
): Promise<MessageAttachment> {
  const data = await loadAttachmentFromFile(ref.path, ref.mimeType);

  return {
    id: ref.id,
    type: ref.type,
    name: ref.name,
    data,
    mimeType: ref.mimeType,
    path: ref.path, // Preserve path for conversation history
  };
}

/**
 * Save multiple attachments and return references
 */
export async function saveAttachments(
  sessionFolder: string,
  attachments: MessageAttachment[]
): Promise<AttachmentReference[]> {
  const references: AttachmentReference[] = [];

  for (const attachment of attachments) {
    const ref = await attachmentToReference(sessionFolder, attachment);
    references.push(ref);
  }

  return references;
}

/**
 * Load multiple attachments from references
 * Uses controlled concurrency to avoid overwhelming the system
 */
export async function loadAttachments(
  references: AttachmentReference[],
  concurrencyLimit: number = 3
): Promise<MessageAttachment[]> {
  if (references.length === 0) return [];

  // For small number of attachments, load in parallel
  if (references.length <= concurrencyLimit) {
    return Promise.all(references.map((ref) => referenceToAttachment(ref)));
  }

  // For larger numbers, use controlled concurrency
  const results: MessageAttachment[] = new Array(references.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < references.length) {
      const index = currentIndex++;
      results[index] = await referenceToAttachment(references[index]);
    }
  }

  // Start workers
  const workers = Array(concurrencyLimit)
    .fill(null)
    .map(() => worker());
  await Promise.all(workers);

  return results;
}
