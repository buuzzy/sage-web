/**
 * Agent execution strategy classifier.
 * Single-path architecture: every prompt goes through direct execution
 * with full tools + conversation context. The only classification left
 * is multi-target detection, used to boost the prompt with batching hints.
 */

import type { AgentExecutionStrategy } from './types';

function countExplicitSymbols(lower: string): number {
  const matches = lower.match(/\b(?:sh|sz|hk|bj)?\d{5,6}\b/g);
  return new Set(matches ?? []).size;
}

function isMultiTargetQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const comparisonPatterns = ['对比', '比较', '分析', 'vs', '和', '与', '跟'];
  const hasComparisonIntent = comparisonPatterns.some((p) => lower.includes(p));
  const enumCount = (lower.match(/[、，,]/g) || []).length;
  const symbolCount = countExplicitSymbols(lower);

  return (
    (hasComparisonIntent && enumCount >= 1) ||
    enumCount >= 2 ||
    symbolCount >= 2
  );
}

function classifyAgentExecutionStrategy(
  prompt: string
): AgentExecutionStrategy {
  const multiTarget = isMultiTargetQuery(prompt);

  return {
    route: 'direct',
    intent: multiTarget ? 'multi_target' : 'simple_lookup',
    boostPrompt: multiTarget,
    reason: 'single-path architecture: direct execution for all queries',
  };
}

function applyAgentStrategyHint(
  prompt: string,
  strategy: AgentExecutionStrategy
): string {
  if (!strategy.boostPrompt && strategy.intent !== 'multi_target') {
    return prompt;
  }

  return `${prompt}

[Execution strategy]
- This is a multi-target or comparison request.
- Prefer batch-capable tools and aggregate results before writing the final answer.
- Keep tool calls bounded: fetch each required data category once per target group, then summarize.
- If web search is needed, search combined keywords instead of repeating one search per target.
- In the final answer, explicitly compare the targets and call out missing data instead of looping.`;
}

export { classifyAgentExecutionStrategy, applyAgentStrategyHint };
