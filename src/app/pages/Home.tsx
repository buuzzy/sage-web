import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import {
  createSession,
  deleteTask,
  getAllTasks,
  updateTask,
  type Task,
} from '@/shared/db';
import type { MessageAttachment } from '@/shared/hooks/useAgent';
import {
  subscribeToBackgroundTasks,
  type BackgroundTask,
} from '@/shared/lib/background-tasks';
import { useIsMobile } from '@/shared/lib/platform';
import { generateSessionId } from '@/shared/lib/session';
import { cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/providers/language-provider';
import { PanelLeft, Sparkles } from 'lucide-react';

import { LeftSidebar, SidebarProvider } from '@/components/layout';
import { useSidebar } from '@/components/layout/sidebar-context';
import { ChatInput } from '@/components/shared/ChatInput';

// 临时写死，后续由每日 A 股热点 cron 生成，见 docs/daily-followups-plan.md
const followOnPrompts = [
  '紫金矿业最近的日 K 线怎么样？',
  '今天 A 股有哪些值得关注的板块？',
  '帮我看看昆仑万维当前的估值高不高？',
];

export function HomePage() {
  return (
    <SidebarProvider>
      <HomeContent />
    </SidebarProvider>
  );
}

function HomeContent() {
  const { t } = useLanguage();
  const mobile = useIsMobile();
  const { toggleLeft } = useSidebar();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const navigate = useNavigate();

  const handlePromptClick = (prompt: string) => {
    setPendingPrompt(prompt);
  };

  const handlePendingConsumed = useCallback(() => {
    setPendingPrompt('');
  }, []);

  // Subscribe to background tasks
  useEffect(() => {
    const unsubscribe = subscribeToBackgroundTasks(setBackgroundTasks);
    return unsubscribe;
  }, []);

  // Load tasks for sidebar
  const loadTasks = useCallback(async () => {
    try {
      const allTasks = await getAllTasks();
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Handle favorite toggle
  const handleToggleFavorite = async (taskId: string, favorite: boolean) => {
    try {
      await updateTask(taskId, { favorite });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, favorite } : t))
      );
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleSubmit = async (
    text: string,
    attachments?: MessageAttachment[]
  ) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    const prompt = text.trim();

    // Create a new session
    const sessionId = generateSessionId(prompt);
    try {
      await createSession({ id: sessionId, prompt });
      console.log('[Home] Created new session:', sessionId);
    } catch (error) {
      console.error('[Home] Failed to create session:', error);
    }

    // Generate task ID and navigate with attachments
    const taskId = Date.now().toString();
    console.log(
      '[Home] Navigating with attachments:',
      attachments?.length || 0
    );

    navigate(`/task/${taskId}`, {
      state: {
        prompt,
        sessionId,
        taskIndex: 1,
        attachments,
      },
    });
  };

  return (
    <div
        className={cn(
          'bg-sidebar flex h-screen overflow-hidden',
          mobile && 'pt-[var(--safe-area-top)]'
        )}
    >
      {/* Left Sidebar */}
      <LeftSidebar
        tasks={tasks}
        onDeleteTask={handleDeleteTask}
        onToggleFavorite={handleToggleFavorite}
        runningTaskIds={backgroundTasks
          .filter((t) => t.isRunning)
          .map((t) => t.taskId)}
      />

      {/* Main Content */}
      <div
          className={cn(
            'bg-background flex min-w-0 flex-1 flex-col overflow-hidden',
            mobile ? 'rounded-none' : 'my-2 mr-2 rounded-2xl shadow-sm'
          )}
      >
       {/* Content Area - Vertically Centered */}
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-auto px-4">
          {/* Mobile sidebar toggle */}
          <button
            onClick={toggleLeft}
            className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-4 left-4 z-10 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg p-2 transition-colors md:hidden"
          >
            <PanelLeft className="size-5" />
          </button>

          <div className="flex w-full max-w-2xl flex-col items-center gap-6">
            {/* Title */}
            <h1 className="text-foreground text-center font-serif text-4xl font-normal tracking-tight md:text-5xl">
              {t.home.welcomeTitle}
            </h1>

            {/* Input Box */}
            <ChatInput
              variant="home"
              placeholder={t.home.inputPlaceholder}
              onSubmit={handleSubmit}
              className="w-full"
              autoFocus
              externalValue={pendingPrompt}
              onExternalValueConsumed={handlePendingConsumed}
            />

            {/* Follow-on questions */}
            <div
              className={cn(
                'flex w-full gap-3',
                mobile
                  ? 'flex-col'
                  : 'flex-row flex-wrap justify-center'
              )}
            >
              {followOnPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handlePromptClick(prompt)}
                  className={cn(
                    'border-border bg-background text-muted-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                    'hover:bg-accent hover:text-foreground',
                    mobile
                      ? 'min-h-11 w-full justify-start'
                      : 'max-w-md'
                  )}
                >
                  <Sparkles className="size-4 shrink-0" />
                  <span className="truncate">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
