/**
 * Unified Chat Input Component
 *
 * Used for both the home page initial input and task detail reply input.
 * Supports text input, file attachments, image paste, and keyboard shortcuts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageAttachment } from '@/shared/hooks/useAgent';
import { cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/providers/language-provider';
import {
  ArrowUp,
  FileText,
  Paperclip,
  Plus,
  Send,
  Square,
  X,
} from 'lucide-react';

import { ContextUsageRing } from './ContextUsageRing';

export interface Attachment {
  id: string;
  file: File;
  preview?: string; // Data URL for image preview
}

export interface ChatInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Whether the agent is running */
  isRunning?: boolean;
  /** Callback when submitting with text and image attachments */
  onSubmit: (
    text: string,
    attachments?: MessageAttachment[]
  ) => Promise<void>;
  /** Callback when stop button is clicked */
  onStop?: () => void;
  /** Variant: 'home' for larger home page style, 'reply' for compact reply style */
  variant?: 'home' | 'reply';
  /** Additional class names */
  className?: string;
  /** Whether to disable the input */
  disabled?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Externally controlled value */
  externalValue?: string;
  /** Callback when external value is consumed */
  onExternalValueConsumed?: () => void;
  /** Current token usage for context window display */
  currentTokens?: number;
  /** Context window limit (default: 200000) */
  contextLimit?: number;
  /** Show context usage ring (default: true for 'reply' variant, false for 'home') */
  showContextRing?: boolean;
}

// Generate unique ID for attachments
const generateId = () =>
  `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Module-level guard: prevent the same drop event from being handled by multiple ChatInput instances
let lastDropTimestamp = 0;

// Create preview for image files with error handling
const createImagePreview = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
};

export function ChatInput({
  placeholder = 'Type a message...',
  isRunning = false,
  onSubmit,
  onStop,
  variant = 'reply',
  className,
  disabled = false,
  autoFocus = false,
  externalValue,
  onExternalValueConsumed,
  currentTokens = 0,
  contextLimit = 200000,
  showContextRing = variant === 'reply',
}: ChatInputProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const prevIsRunningRef = useRef(isRunning);

  // Sync external value into the input
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== '') {
      setValue(externalValue);
      onExternalValueConsumed?.();
      // Focus and move cursor to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.selectionStart = externalValue.length;
          textareaRef.current.selectionEnd = externalValue.length;
        }
      }, 0);
    }
  }, [externalValue, onExternalValueConsumed]);

  // Auto focus on mount if autoFocus is true
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto focus when agent stops running (reply completed)
  useEffect(() => {
    if (prevIsRunningRef.current && !isRunning && textareaRef.current) {
      textareaRef.current.focus();
    }
    prevIsRunningRef.current = isRunning;
  }, [isRunning]);

  // Add image attachments
  const addImages = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newAttachments: Attachment[] = [];

      console.log(
        '[ChatInput] addImages called with',
        fileArray.length,
        'files'
      );

      for (const file of fileArray) {
        const attachment: Attachment = {
          id: generateId(),
          file,
        };

        try {
          attachment.preview = await createImagePreview(file);
          console.log(
            `[ChatInput] Created preview for ${file.name}, previewLength=${attachment.preview?.length || 0}`
          );
        } catch (error) {
          console.error('[ChatInput] Failed to create image preview:', error);
        }

        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    },
    []
  );

  // Remove attachment
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(e.target.files);
      e.target.value = '';
    }
  };

  // Handle paste event for image upload
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await addImages(imageFiles);
      }
    },
    [addImages]
  );

  // Open file picker
  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  // Convert attachments to MessageAttachment format
  const convertToMessageAttachments = async (): Promise<
    MessageAttachment[] | undefined
  > => {
    if (attachments.length === 0) return undefined;

    const result: MessageAttachment[] = [];

    for (const a of attachments) {
      if (!a.preview || a.preview.length === 0) {
        console.warn(
          `[ChatInput] Skipping image ${a.file.name}: no preview data`
        );
        continue;
      }

      result.push({
        id: a.id,
        type: 'image',
        name: a.file.name,
        data: a.preview,
        mimeType: a.file.type || 'image/png',
      });
    }

    // Debug logging
    console.log('[ChatInput] Converting attachments:', result.length);
    result.forEach((a, i) => {
      console.log(
        `[ChatInput] Attachment ${i}: type=${a.type}, hasData=${!!a.data}, dataLength=${a.data?.length || 0}, mimeType=${a.mimeType}`
      );
    });

    return result.length > 0 ? result : undefined;
  };

  const handleSubmit = async () => {
    if ((value.trim() || attachments.length > 0) && !isRunning && !disabled) {
      const text = value.trim();
      const messageAttachments = await convertToMessageAttachments();

      setValue('');
      setAttachments([]);
      await onSubmit(text, messageAttachments);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    setTimeout(() => {
      isComposingRef.current = false;
    }, 10);
  };

  const isHome = variant === 'home';
  const canSubmit = (value.trim() || attachments.length > 0) && !disabled;

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';

    // Calculate the new height
    const maxHeight = isHome ? 200 : 120; // Max height in pixels
    const minHeight = isHome ? 56 : 20; // Min height in pixels (home: taller default)
    const newHeight = Math.min(
      Math.max(textarea.scrollHeight, minHeight),
      maxHeight
    );

    textarea.style.height = `${newHeight}px`;

    // Enable/disable overflow based on content height
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, isHome]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full transition-colors',
        isHome
          ? 'border-border/50 bg-background rounded-2xl border p-4 shadow-lg'
          : 'border-border/60 bg-background rounded-xl border p-3 shadow-sm',
        isDragging && 'border-primary/50 bg-primary/5 border-2',
        className
      )}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit]">
          <div className="text-primary/70 flex items-center gap-2 text-sm font-medium">
            <Paperclip className="size-4" />
            <span>{t.home.dropFilesHere || 'Drop files here'}</span>
          </div>
        </div>
      )}
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group border-border/50 bg-muted/50 relative flex items-center gap-2 rounded-lg border px-3 py-2"
            >
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded">
                  <FileText className="text-muted-foreground h-5 w-5" />
                </div>
              )}
              <span className="text-foreground max-w-[120px] truncate text-sm">
                {attachment.file.name}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="bg-foreground text-background absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={cn(
          'text-foreground placeholder:text-muted-foreground w-full resize-none border-0 bg-transparent focus:outline-none',
          isHome ? 'text-base' : 'px-1 text-sm'
        )}
        style={{
          minHeight: isHome ? '56px' : '20px',
          maxHeight: isHome ? '200px' : '120px',
          overflowY: 'hidden',
        }}
        rows={1}
        disabled={isRunning || disabled}
      />

      {/* Bottom Actions */}
      <div
        className={cn(
          'flex items-center justify-between',
          isHome ? 'mt-3' : 'mt-2'
        )}
      >
        {/* Add Button + Category Tag */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={isRunning || disabled}
            aria-label={t.home.addImagesOrPhotos}
            title={t.home.addImagesOrPhotos}
            className={cn(
              'flex shrink-0 items-center justify-center transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              isHome
                ? 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground size-8 rounded-full border'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground size-7 rounded-md'
            )}
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* Context Usage Ring + Submit/Stop Button */}
        <div className="flex items-center gap-1">
          {showContextRing && !isHome && (
            <ContextUsageRing
              currentTokens={currentTokens}
              contextLimit={contextLimit}
              interactive
              className="shrink-0"
            />
          )}
          {isRunning ? (
            <button
              type="button"
              onClick={onStop}
              className={cn(
                'flex items-center justify-center rounded-full transition-colors',
                isHome
                  ? 'size-8 bg-red-500 text-white hover:bg-red-600'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90 size-7'
              )}
            >
              <Square className={isHome ? 'size-3.5' : 'size-3'} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'flex items-center justify-center rounded-full transition-all',
                canSubmit
                  ? 'bg-foreground text-background hover:bg-foreground/90 cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
                isHome ? 'size-8' : 'size-7'
              )}
            >
              {isHome ? (
                <ArrowUp className="size-4" />
              ) : (
                <Send className="size-3" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
