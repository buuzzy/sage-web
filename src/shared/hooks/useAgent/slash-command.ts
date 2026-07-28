/**
 * Frontend slash command matcher.
 * Mirrors the backend patterns so we can intercept before DB/UI pollution.
 */

const SLASH_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'new',     pattern: /^\/(new|新对话|新建)\s*$/i },
  { name: 'reset',   pattern: /^\/(reset|重置)\s*$/i },
  { name: 'status',  pattern: /^\/(status|状态)\s*$/i },
  { name: 'compact', pattern: /^\/(compact|压缩)\s*$/i },
  { name: 'help',    pattern: /^\/(help|帮助|命令)\s*$/i },
];

export function matchSlashCommand(text: string): { name: string } | null {
  const trimmed = text.trim();
  for (const cmd of SLASH_PATTERNS) {
    if (cmd.pattern.test(trimmed)) {
      return { name: cmd.name };
    }
  }
  return null;
}
