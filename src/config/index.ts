/**
 * Application Configuration
 *
 * Centralized configuration for the application.
 */

// =============================================================================
// API Configuration
// =============================================================================

/**
 * API port — unified at 2026 for both dev and production.
 */
export const API_PORT = 2026;

/**
 * API base URL
 *
 * Web frontend connects to the Railway cloud backend.
 * Dev mode: override with VITE_API_URL=http://localhost:2026 if needed.
 */

// Web API service (railway: sage-web-api)
const RAILWAY_URL = 'https://sage.nakocai.com';

export const API_BASE_URL = import.meta.env.VITE_API_URL || RAILWAY_URL;

// =============================================================================
// App Configuration
// =============================================================================

/**
 * App name（用户可见品牌名）
 */
export const APP_NAME = 'Sage';
