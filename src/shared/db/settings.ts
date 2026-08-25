// Settings types and storage for AI provider configuration

// ============================================================================
// Backend Sync
// ============================================================================

import { API_BASE_URL } from '@/config';

import { getAppDataDir, getMcpConfigPath } from '../lib/paths';

export type ApiType = 'anthropic-messages' | 'openai-completions';

export interface AIProvider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  models: string[];
  defaultModel?: string;
  apiType?: ApiType;
  // Extended fields for UI
  icon?: string;
  apiKeyUrl?: string;
  canDelete?: boolean;
}

// ============================================================================
// Sandbox Provider Settings
// ============================================================================

type SandboxProviderType =
  | 'docker'
  | 'native'
  | 'e2b'
  | 'codex'
  | 'claude'
  | 'custom';

export interface SandboxProviderSetting {
  id: string;
  type: SandboxProviderType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

const defaultSandboxProviders: SandboxProviderSetting[] = [
  {
    id: 'codex',
    type: 'codex',
    name: 'Codex Sandbox',
    enabled: true,
    config: {
      defaultTimeout: 120000,
    },
  },
  {
    id: 'native',
    type: 'native',
    name: 'Native (No Isolation)',
    enabled: true,
    config: {
      shell: '/bin/bash',
      defaultTimeout: 120000,
    },
  },
];

// ============================================================================
// Agent Runtime Settings
// ============================================================================

type AgentRuntimeType = 'codeany' | 'custom';

export interface AgentRuntimeSetting {
  id: string;
  type: AgentRuntimeType;
  name: string;
  enabled: boolean;
  config: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    executablePath?: string;
    [key: string]: unknown;
  };
}

const defaultAgentRuntimes: AgentRuntimeSetting[] = [
  {
    id: 'codeany',
    type: 'codeany',
    name: 'CodeAny Agent',
    enabled: true,
    config: {
      model: 'claude-sonnet-4-20250514',
    },
  },
];

export interface UserProfile {
  nickname: string;
  avatar: string; // URL or base64 data
}

// Preset accent colors
export type AccentColor =
  | 'orange'
  | 'blue'
  | 'green'
  | 'purple'
  | 'pink'
  | 'red'
  | 'sage';

export const accentColors: {
  id: AccentColor;
  name: string;
  color: string;
  darkColor: string;
}[] = [
  {
    id: 'orange',
    name: 'Orange',
    color: 'oklch(0.6716 0.1368 48.513)',
    darkColor: 'oklch(0.7214 0.1337 49.9802)',
  },
  {
    id: 'blue',
    name: 'Blue',
    color: 'oklch(0.5469 0.1914 262.881)',
    darkColor: 'oklch(0.6232 0.1914 262.881)',
  },
  {
    id: 'green',
    name: 'Green',
    color: 'oklch(0.5966 0.1397 149.214)',
    darkColor: 'oklch(0.6489 0.1397 149.214)',
  },
  {
    id: 'purple',
    name: 'Purple',
    color: 'oklch(0.5412 0.1879 293.541)',
    darkColor: 'oklch(0.6135 0.1879 293.541)',
  },
  {
    id: 'pink',
    name: 'Pink',
    color: 'oklch(0.6171 0.1762 349.761)',
    darkColor: 'oklch(0.6894 0.1762 349.761)',
  },
  {
    id: 'red',
    name: 'Red',
    color: 'oklch(0.5772 0.2077 27.325)',
    darkColor: 'oklch(0.6495 0.2077 27.325)',
  },
  {
    id: 'sage',
    name: 'Sage',
    color: 'oklch(0.4531 0.0891 152.535)', // Dark forest green
    darkColor: 'oklch(0.5654 0.1091 152.535)',
  },
];

// Background style presets
export type BackgroundStyle = 'default' | 'warm' | 'cool';

export const backgroundStyles: {
  id: BackgroundStyle;
  name: string;
  description: string;
}[] = [
  { id: 'default', name: 'Default', description: 'Clean neutral background' },
  { id: 'warm', name: 'Warm', description: 'Cozy cream and beige tones' },
  { id: 'cool', name: 'Cool', description: 'Crisp blue-gray tones' },
];

export interface Settings {
  // User profile
  profile: UserProfile;

  // AI Provider settings
  providers: AIProvider[];
  defaultProvider: string;
  defaultModel: string;

  // MCP settings - path to mcp.json config file
  mcpConfigPath: string;
  mcpEnabled: boolean; // Enable MCP mounting during agent conversations
  mcpUserDirEnabled: boolean; // Enable loading MCP servers from user directory (claude config)
  mcpAppDirEnabled: boolean; // Enable loading MCP servers from app directory (sage config)

  // Skills settings
  skillsPath: string;
  skillsEnabled: boolean; // Enable skills mounting during agent conversations
  skillsUserDirEnabled: boolean; // Enable loading skills from user directory (~/.claude/skills)
  skillsAppDirEnabled: boolean; // Enable loading skills from app directory (workspace/skills)

  // Workspace settings
  workDir: string; // Working directory for sessions and outputs

  // Sandbox settings
  sandboxEnabled: boolean; // Enable sandbox mode for script execution
  sandboxProviders: SandboxProviderSetting[]; // Available sandbox providers
  defaultSandboxProvider: string; // Default sandbox provider ID

  // Agent Runtime settings
  agentRuntimes: AgentRuntimeSetting[]; // Available agent runtimes
  defaultAgentRuntime: string; // Default agent runtime ID

  // Conversation History settings
  maxConversationTurns: number; // Maximum conversation turns to keep in history (default: 50)
  maxHistoryTokens: number; // Maximum tokens for conversation context (default: 12000, auto-compaction when exceeded)

  // General settings
  theme: 'light' | 'dark' | 'system';
  accentColor: AccentColor;
  backgroundStyle: BackgroundStyle;
  language: string;
}

// ============================================================================
// AI Provider Configuration
// ============================================================================

// Default providers with full configuration
const defaultProviders: AIProvider[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api',
    enabled: true,
    models: ['anthropic/claude-sonnet-4.5', 'anthropic/claude-opus-4.5'],
    apiType: 'openai-completions',
    icon: 'O',
    apiKeyUrl: 'https://openrouter.ai/keys',
    canDelete: true,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    apiKey: '',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    enabled: true,
    models: [
      'MiniMax-M2',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
    ],
    defaultModel: 'MiniMax-M2',
    apiType: 'anthropic-messages',
    icon: 'M',
    apiKeyUrl:
      'https://platform.minimax.io/subscribe/coding-plan?code=9hgHKlPO3G&source=link',
    canDelete: true,
  },
  {
    id: 'zai',
    name: 'Z.ai',
    apiKey: '',
    baseUrl: 'https://api.z.ai/api/anthropic',
    enabled: true,
    models: ['glm-4.7'],
    apiType: 'anthropic-messages',
    icon: 'Z',
    apiKeyUrl: 'https://z.ai/subscribe?ic=7YS469UOXD',
    canDelete: true,
  },
  {
    id: 'volcengine',
    name: 'Volcengine',
    apiKey: '',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
    enabled: true,
    models: ['ark-code-latest'],
    apiType: 'openai-completions',
    icon: 'V',
    apiKeyUrl: 'https://volcengine.com/L/Sq5rSgyFu_E',
    canDelete: true,
  },
  {
    id: '302ai',
    name: '302.AI',
    apiKey: '',
    baseUrl: 'https://api.302.ai/cc',
    enabled: true,
    models: ['claude-sonnet-4-5-20250929'],
    apiType: 'anthropic-messages',
    icon: '3',
    apiKeyUrl: 'https://302.ai/?utm_source=sage_desktop',
    canDelete: true,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    enabled: true,
    models: ['glm-4.7-flash'],
    apiType: 'openai-completions',
    icon: 'O',
    apiKeyUrl: 'https://docs.ollama.com/integrations/claude-code',
    canDelete: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    apiKey: '',
    baseUrl: 'https://api.siliconflow.com/',
    enabled: true,
    models: ['MiniMaxAI/MiniMax-M2.1', 'zai-org/GLM-4.7'],
    apiType: 'openai-completions',
    icon: 'S',
    apiKeyUrl: 'https://cloud.siliconflow.com/me/account/ak',
    canDelete: true,
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    enabled: true,
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    apiType: 'openai-completions',
    icon: 'K',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    canDelete: true,
  },
];

// Default settings
// Note: Path values are placeholders that get resolved at initialization
// to platform-specific paths (e.g., ~/.sage on macOS/Linux)
export const defaultSettings: Settings = {
  profile: {
    nickname: 'Guest User',
    avatar: '',
  },
  providers: defaultProviders,
  defaultProvider: '', // Empty until user configures a provider
  defaultModel: '',
  mcpConfigPath: '', // Will be resolved to app data dir at init
  mcpEnabled: true, // Enable MCP by default
  mcpUserDirEnabled: true, // Enable user directory MCP by default
  mcpAppDirEnabled: true, // Enable app directory MCP by default
  skillsPath: '', // Will be resolved to app data dir at init
  skillsEnabled: true, // Enable skills by default
  skillsUserDirEnabled: true, // Enable user directory skills by default
  skillsAppDirEnabled: true, // Enable app directory skills by default
  workDir: '', // Will be resolved to app data dir at init
  sandboxEnabled: true,
  sandboxProviders: defaultSandboxProviders,
  defaultSandboxProvider: 'codex', // Default to Codex sandbox, fallback to native
  agentRuntimes: defaultAgentRuntimes,
  defaultAgentRuntime: 'codeany', // Default to CodeAny Agent
  maxConversationTurns: 50, // Default: 50 conversation turns
  maxHistoryTokens: 12000, // Default: 12000 tokens for history (auto-compaction when exceeded)
  theme: 'system',
  accentColor: 'orange',
  backgroundStyle: 'default',
  language: '', // Empty string triggers system language detection on first run
};

const MINIMAX_ANTHROPIC_CONFIG: Pick<
  AIProvider,
  'baseUrl' | 'apiType' | 'models' | 'defaultModel'
> = {
  baseUrl: 'https://api.minimaxi.com/anthropic',
  apiType: 'anthropic-messages',
  models: [
    'MiniMax-M2',
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
  ],
  defaultModel: 'MiniMax-M2',
};

function normalizeSettingsProviders(settings: Settings): void {
  for (const defaultProvider of defaultProviders) {
    if (!settings.providers.find((p) => p.id === defaultProvider.id)) {
      settings.providers.push(defaultProvider);
    }
  }

  const minimaxProvider = settings.providers.find((p) => p.id === 'minimax');
  if (!minimaxProvider) return;

  // MiniMax's Anthropic endpoint supports native tool_use. Keep every storage
  // path on the same protocol so older OpenAI-format migrations cannot regress
  // into fake tool-call text leaks.
  Object.assign(minimaxProvider, MINIMAX_ANTHROPIC_CONFIG);
}

// In-memory cache for settings
let settingsCache: Settings | null = null;

// Subscribe to user binding changes: clear cache when user switches.
// We lazy-import to avoid circular init; the subscription is one-time.
(async () => {
  if (typeof window === 'undefined') return;
  try {
    const { subscribeUserBinding } = await import('./database');
    subscribeUserBinding(() => {
      settingsCache = null;
    });
  } catch {
    /* ignore - database module may not be available in all contexts */
  }
})();

// Get settings from database (async version)
async function getSettingsAsync(): Promise<Settings> {
  // Return cached settings if available
  if (settingsCache) {
    console.log('[Settings] getSettingsAsync returning cached settings:', {
      defaultProvider: settingsCache.defaultProvider,
      defaultModel: settingsCache.defaultModel,
    });
    return settingsCache;
  }

  // Fallback to localStorage for browser mode
  try {
    const stored = localStorage.getItem('sage_settings');
    if (stored) {
      const loadedSettings = { ...defaultSettings, ...JSON.parse(stored) };
      normalizeSettingsProviders(loadedSettings);
      // Debug: Log loaded settings
      console.log('[Settings] Loaded from localStorage:', {
        defaultProvider: loadedSettings.defaultProvider,
        defaultModel: loadedSettings.defaultModel,
        sandboxEnabled: loadedSettings.sandboxEnabled,
        sandboxProvider: loadedSettings.defaultSandboxProvider,
      });
      settingsCache = loadedSettings;
      return loadedSettings;
    } else {
      console.log('[Settings] localStorage has no sage_settings');
    }
  } catch (error) {
    console.error('[Settings] Failed to load from localStorage:', error);
  }

  // WARNING: Using default settings - user custom API settings will NOT be applied
  console.warn(
    '[Settings] Using defaultSettings - no saved settings found in database or localStorage.',
    'User custom API settings will NOT be applied!'
  );
  settingsCache = defaultSettings;
  return defaultSettings;
}

// Get settings synchronously (returns cached or default)
export function getSettings(): Settings {
  if (settingsCache) {
    return settingsCache;
  }

  // Try localStorage first for immediate sync access
  try {
    const stored = localStorage.getItem('sage_settings');
    if (stored) {
      const loadedSettings = { ...defaultSettings, ...JSON.parse(stored) };
      normalizeSettingsProviders(loadedSettings);
      settingsCache = loadedSettings;
      console.log('[Settings] getSettings loaded from localStorage:', {
        defaultProvider: loadedSettings.defaultProvider,
        defaultModel: loadedSettings.defaultModel,
        providersCount: loadedSettings.providers.length,
      });
      return loadedSettings;
    }
  } catch (error) {
    console.error('[Settings] Failed to load from localStorage:', error);
  }

  // WARNING: Returning default settings - user configuration may not be loaded
  console.warn(
    '[Settings] getSettings returning defaultSettings - settingsCache is null and localStorage has no data.',
    'User custom API settings will NOT be applied. This may happen if:',
    '1. App just started and initializeSettings() has not completed yet',
    '2. Database/localStorage failed to load settings',
    '3. User has never saved settings'
  );
  return defaultSettings;
}

// Save settings to database (async version)
async function saveSettingsAsync(settings: Settings): Promise<void> {
  settingsCache = settings;

  // Persist to localStorage
  try {
    localStorage.setItem('sage_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('[Settings] Failed to save to localStorage:', error);
  }
}

// Sync version that triggers async save
export function saveSettings(settings: Settings): void {
  settingsCache = settings;

  console.log('[Settings] saveSettings called:', {
    defaultProvider: settings.defaultProvider,
    defaultModel: settings.defaultModel,
    providersCount: settings.providers.length,
  });

  // Save to localStorage immediately for sync access
  try {
    localStorage.setItem('sage_settings', JSON.stringify(settings));
    console.log('[Settings] Saved to localStorage successfully');
  } catch (error) {
    console.error('[Settings] Failed to save to localStorage:', error);
  }

  // Also save to database asynchronously
  saveSettingsAsync(settings)
    .then(() => {
      console.log('[Settings] Saved to database successfully');
    })
    .catch((error) => {
      console.error('[Settings] Failed to save settings async:', error);
    });

  // Fire post-save observers (e.g. cloud sync). Never throw out of here.
  for (const observer of postSaveObservers) {
    try {
      observer(settings);
    } catch (err) {
      console.error('[Settings] post-save observer error:', err);
    }
  }
}

// ─── Post-save observers ───────────────────────────────────────────────────
//
// Allows external modules (cloud sync) to react to settings changes without
// creating a circular dependency on React/providers. Observers run synchronously
// after localStorage is written; errors in one observer don't affect others.

type SettingsObserver = (settings: Settings) => void;
const postSaveObservers = new Set<SettingsObserver>();

export function subscribeSettingsSaved(fn: SettingsObserver): () => void {
  postSaveObservers.add(fn);
  return () => {
    postSaveObservers.delete(fn);
  };
}

// Initialize settings - call this on app startup
export async function initializeSettings(): Promise<Settings> {
  // Resolve platform-specific paths
  const [appDataDir, mcpConfigPath] = await Promise.all([
    getAppDataDir(),
    getMcpConfigPath(),
  ]);

  const settings = await getSettingsAsync();

  // If paths are empty (first run or migration), set them to platform defaults
  if (!settings.workDir) {
    settings.workDir = appDataDir;
  }
  if (!settings.mcpConfigPath) {
    settings.mcpConfigPath = mcpConfigPath;
  }
  // Default skillsPath to workDir/skills (not system default)
  if (!settings.skillsPath) {
    settings.skillsPath = `${settings.workDir}/skills`;
  }

  // Migration: If a sandbox provider is selected but sandboxEnabled is not true, enable it
  // This fixes a bug where selecting a sandbox provider didn't enable sandbox mode
  if (settings.defaultSandboxProvider && settings.sandboxEnabled !== true) {
    console.log(
      '[Settings] Migration: Enabling sandbox because provider is selected:',
      settings.defaultSandboxProvider
    );
    settings.sandboxEnabled = true;
  }

  settingsCache = settings;

  // Save if paths were updated
  if (
    settings.workDir === appDataDir ||
    settings.mcpConfigPath === mcpConfigPath ||
    settings.skillsPath === `${settings.workDir}/skills`
  ) {
    await saveSettingsAsync(settings);
  }

  // Auto-sync model configuration with backend on startup
  // This ensures channel adapters (WeChat, Feishu) have access to the model config
  // Use a delayed retry since backend may not be ready immediately
  const syncWithRetry = async (retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        await syncSettingsWithBackend();
        console.log(
          '[Settings] Auto-synced model config with backend on startup'
        );
        return;
      } catch {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    console.warn('[Settings] Could not auto-sync with backend after retries');
  };
  // Fire and forget — don't block app rendering
  syncWithRetry().catch(() => {});

  return settings;
}

/**
 * Reload settings from the freshly bound user DB.
 *
 * 用于 AuthProvider 在 bindUserId 成功后调用：清空内存 cache，下一次
 * `getSettingsAsync()` 会从 user-scoped SQLite 读出该用户自己的偏好。
 * 若 DB 里没有条目（新账号首次登录）会 fallback 到 localStorage / defaults。
 */
export async function reloadSettingsForCurrentUser(): Promise<Settings> {
  settingsCache = null;
  return getSettingsAsync();
}

// Get the current default sandbox provider
function getDefaultSandboxProvider(): SandboxProviderSetting | undefined {
  const settings = getSettings();
  return settings.sandboxProviders.find(
    (p) => p.id === settings.defaultSandboxProvider
  );
}

// Get the current default agent runtime
function getDefaultAgentRuntime(): AgentRuntimeSetting | undefined {
  const settings = getSettings();
  return settings.agentRuntimes.find(
    (r) => r.id === settings.defaultAgentRuntime
  );
}

/**
 * Get the current default AI provider (for model configuration)
 */
function getDefaultAIProvider(): AIProvider | undefined {
  const settings = getSettings();
  return settings.providers.find((p) => p.id === settings.defaultProvider);
}

/**
 * Sync settings with the backend API
 * This ensures the backend uses the same provider configuration as the frontend
 */
export async function syncSettingsWithBackend(): Promise<void> {
  const settings = getSettings();

  // Get the selected AI provider's configuration.
  // Fallback: if defaultProvider has no apiKey, find any enabled provider with one.
  let aiProvider = getDefaultAIProvider();
  if (!aiProvider?.apiKey) {
    const fallback = settings.providers.find((p) => p.enabled && p.apiKey);
    if (fallback) {
      aiProvider = fallback;
      // Also fix defaultProvider so future syncs are correct
      settings.defaultProvider = fallback.id;
      settings.defaultModel =
        fallback.defaultModel || fallback.models?.[0] || settings.defaultModel;
      saveSettings(settings);
    }
  }

  // Build agent config with model information
  const agentConfig: Record<string, unknown> = {
    ...getDefaultAgentRuntime()?.config,
  };

  // If a custom AI provider is selected (not 'default'), use its configuration
  if (settings.defaultProvider !== 'default' && aiProvider) {
    if (aiProvider.apiKey) {
      agentConfig.apiKey = aiProvider.apiKey;
    }
    if (aiProvider.baseUrl) {
      agentConfig.baseUrl = aiProvider.baseUrl;
    }
    if (settings.defaultModel) {
      agentConfig.model = settings.defaultModel;
    }
    if (aiProvider.apiType) {
      agentConfig.apiType = aiProvider.apiType;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/providers/settings/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sandboxProvider: settings.defaultSandboxProvider,
        sandboxConfig: getDefaultSandboxProvider()?.config,
        agentProvider: settings.defaultAgentRuntime,
        agentConfig: agentConfig,
        // Also send the AI provider info for clarity
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
      }),
    });

    if (!response.ok) {
      console.error(
        '[Settings] Failed to sync with backend:',
        response.statusText
      );
    } else {
      console.log('[Settings] Successfully synced with backend');
    }
  } catch (error) {
    // Backend might not be running, ignore error
    console.warn('[Settings] Could not sync with backend:', error);
  }
}
