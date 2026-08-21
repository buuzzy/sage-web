import type { TaskPlan } from '@/shared/hooks/useAgent';
import { cn } from '@/shared/lib/utils';
import { useLanguage } from '@/shared/providers/language-provider';
import { Ban, Check, ListTodo, X } from 'lucide-react';

interface PlanApprovalProps {
  plan: TaskPlan;
}

/**
 * Read-only renderer for historical plan messages.
 * The interactive plan approval flow was removed with the single-path
 * architecture refactor — this component only displays stored plans.
 */
export function PlanApproval({ plan }: PlanApprovalProps) {
  const { t } = useLanguage();

  // Check if all steps are completed
  const isAllCompleted = plan.steps.every(
    (step) => step.status === 'completed'
  );

  // Check if plan was cancelled
  const isCancelled = plan.steps.some((step) => step.status === 'cancelled');

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border p-4',
        isCancelled
          ? 'border-muted-foreground/30 bg-muted/30'
          : isAllCompleted
            ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20'
            : 'border-primary/30 bg-accent/30'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          {isCancelled ? (
            <Ban className="text-muted-foreground size-4" />
          ) : isAllCompleted ? (
            <Check className="size-4 text-emerald-500" />
          ) : (
            <ListTodo className="text-primary size-4" />
          )}
          {t.task.executionPlan}
          {isCancelled ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              {t.task.planCancelled}
            </span>
          ) : isAllCompleted ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              {t.task.planCompleted}
            </span>
          ) : null}
        </div>
      </div>

      {/* Goal */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">{t.task.goal}</p>
        <p className="text-foreground text-sm">{plan.goal}</p>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">
          {t.task.stepsCount.replace('{count}', String(plan.steps.length))}
        </p>
        <div className="space-y-2">
          {plan.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-2.5">
              {/* Step number or status indicator */}
              <div
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs font-medium transition-colors',
                  step.status === 'completed'
                    ? 'bg-primary border-primary text-primary-foreground'
                    : step.status === 'in_progress'
                      ? 'border-primary bg-primary/10 text-primary'
                      : step.status === 'failed'
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : step.status === 'cancelled'
                          ? 'border-muted-foreground/30 bg-muted text-muted-foreground'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground'
                )}
              >
                {step.status === 'completed' ? (
                  <Check className="size-3" />
                ) : step.status === 'in_progress' ? (
                  <div className="bg-primary size-1.5 animate-pulse rounded-full" />
                ) : step.status === 'cancelled' ? (
                  <X className="size-3" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm leading-snug',
                  step.status === 'completed'
                    ? 'text-muted-foreground'
                    : step.status === 'in_progress'
                      ? 'text-foreground font-medium'
                      : step.status === 'failed'
                        ? 'text-destructive'
                        : step.status === 'cancelled'
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                )}
              >
                {step.description}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {plan.notes && (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">{t.task.notes}</p>
          <p className="text-muted-foreground text-sm">{plan.notes}</p>
        </div>
      )}
    </div>
  );
}
