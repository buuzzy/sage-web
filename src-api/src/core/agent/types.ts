/**
 * Agent SDK Abstraction Layer - Type Definitions
 *
 * This module defines the common interfaces for different agent implementations.
 * Supports: Claude Agent SDK, DeepAgents.js, and custom implementations.
 */

// ============================================================================
// Message Types
// ============================================================================

import type { SandboxConfig } from '@/core/sandbox/types';

export type { SandboxConfig };

/**
 * Model configuration for custom API endpoints
 */
export interface ModelConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export type AgentMessageType =
  | 'session'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'result'
  | 'error'
  | 'done'
  | 'plan'
  | 'direct_answer';

/**
 * Snapshot of model token usage for a single agent turn.
 * input_tokens is the authoritative signal for context-window consumption.
 */
export interface TokenUsageSnapshot {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface AgentMessage {
  type: AgentMessageType;
  sessionId?: string;
  content?: string;
  /** Result completion subtype (e.g. 'success' / 'error_max_turns') */
  subtype?: string;
  name?: string;
  id?: string;
  input?: unknown;
  cost?: number;
  duration?: number;
  // Tool result fields
  toolUseId?: string;
  output?: string;
  isError?: boolean;
  // Plan fields
  plan?: TaskPlan;
  // Error fields
  message?: string;
  // Token usage from the model result (authoritative context consumption)
  usage?: TokenUsageSnapshot;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Image file paths attached to this message (saved to workspace) */
  imagePaths?: string[];
}

/**
 * Image attachment for vision capabilities
 */
export interface ImageAttachment {
  data: string; // Base64 encoded image data
  mimeType: string; // e.g., 'image/png', 'image/jpeg'
}

// ============================================================================
// Plan Types
// ============================================================================

export interface TaskPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  notes?: string;
  createdAt: Date;
}

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

// ============================================================================
// Agent Configuration
// ============================================================================

export type AgentProvider = 'codeany' | 'custom';

export interface AgentConfig {
  /** Agent provider to use */
  provider: AgentProvider;
  /** API key for the provider */
  apiKey?: string;
  /** Custom API base URL (for third-party API endpoints) */
  baseUrl?: string;
  /** Model to use (provider-specific) */
  model?: string;
  /** API type: 'anthropic-messages' or 'openai-completions' */
  apiType?: 'anthropic-messages' | 'openai-completions';
  /** Working directory for file operations */
  workDir?: string;
  /** Custom configuration for the provider */
  providerConfig?: Record<string, unknown>;
}

/**
 * Skills configuration for loading skills from different directories
 */
export interface SkillsConfig {
  /** Whether skills are globally enabled */
  enabled: boolean;
  /** Whether to load skills from user directory (~/.claude/skills) */
  userDirEnabled: boolean;
  /** Whether to load skills from app directory (workspace/skills) */
  appDirEnabled: boolean;
  /** Custom skills directory path (legacy support) */
  skillsPath?: string;
}

/**
 * MCP configuration for loading MCP servers from different config files
 */
export interface McpConfig {
  /** Whether MCP is globally enabled */
  enabled: boolean;
  /** Whether to load MCP servers from user directory (claude config) */
  userDirEnabled: boolean;
  /** Whether to load MCP servers from app directory (sage config) */
  appDirEnabled: boolean;
  /** Custom MCP config file path (legacy support) */
  mcpConfigPath?: string;
}

export interface AgentOptions {
  /** Session ID for continuing conversations */
  sessionId?: string;
  /** Conversation history */
  conversation?: ConversationMessage[];
  /** Preferred response language (e.g., en-US, zh-CN) */
  language?: string;
  /** Working directory */
  cwd?: string;
  /** Allowed tools */
  allowedTools?: string[];
  /** Task ID for tracking */
  taskId?: string;
  /** Abort controller for cancellation */
  abortController?: AbortController;
  /** Sandbox configuration for isolated execution */
  sandbox?: SandboxConfig;
  /** Image attachments for vision capabilities */
  images?: ImageAttachment[];
  /** Skills configuration */
  skillsConfig?: SkillsConfig;
  /** MCP configuration */
  mcpConfig?: McpConfig;
  /**
   * Supabase auth.users.id (UUID) of the current end-user.
   * Forwarded to the built-in memory MCP server so search_memory can scope
   * results to this user. Required for any memory-aware Agent run; if absent,
   * the memory MCP server is simply not injected (Agent works without it).
   */
  userId?: string;
  /**
   * Supabase access token (JWT) of the current end-user.
   *
   * Forwarded to the built-in memory MCP server so it can talk to Supabase
   * under user-scoped RLS instead of god-mode service role. Without an
   * accessToken, anon-only writes/reads receive zero rows under RLS.
   *
   * Optional in service-role contexts.
   */
  accessToken?: string;
}

// ============================================================================
// Agent Interface
// ============================================================================

/**
 * Base interface for all agent implementations.
 * Each provider (Claude, DeepAgents, etc.) must implement this interface.
 */
export interface IAgent {
  /** Provider name */
  readonly provider: AgentProvider;

  /**
   * Run the agent with a prompt (direct execution mode)
   */
  run(prompt: string, options?: AgentOptions): AsyncGenerator<AgentMessage>;

  /**
   * Stop the current execution
   */
  stop(sessionId: string): Promise<void>;
}

// ============================================================================
// Session Management
// ============================================================================

export interface AgentSession {
  id: string;
  createdAt: Date;
  phase: 'executing' | 'idle';
  isAborted: boolean;
  abortController: AbortController;
  config?: AgentConfig;
}

// ============================================================================
// Factory Types
// ============================================================================

export type AgentFactory = (config: AgentConfig) => IAgent;

export interface AgentRegistry {
  register(provider: AgentProvider, factory: AgentFactory): void;
  get(provider: AgentProvider): AgentFactory | undefined;
  create(config: AgentConfig): IAgent;
}

/**
 * API Request type for agent endpoints
 */
export interface AgentRequest {
  prompt: string;
  sessionId?: string;
  conversation?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  // Workspace settings
  workDir?: string; // Working directory for session outputs
  taskId?: string; // Task ID for session folder
  // Provider selection (optional, defaults to env config)
  provider?: 'codeany' | 'kimi';
  // Custom model configuration
  modelConfig?: ModelConfig;
  // Sandbox configuration for isolated execution
  sandboxConfig?: SandboxConfig;
}
