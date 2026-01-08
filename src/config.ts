import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SentryConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://sentry.io/api/0';

const CONFIG_LOCATIONS = [
  join(process.cwd(), '.env'),
  join(process.cwd(), '.slog'),
  join(homedir(), '.config', 'slog', 'config'),
  join(homedir(), '.slog'),
];

/**
 * Parse a simple .env file format
 * Supports: KEY=value, KEY="value", KEY='value', # comments
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Load config from file, returns null if file doesn't exist
 */
function loadConfigFile(path: string): Record<string, string> | null {
  if (!existsSync(path)) return null;

  try {
    const content = readFileSync(path, 'utf-8');
    return parseEnvFile(content);
  } catch {
    return null;
  }
}

/**
 * Find and load config from known locations
 * Priority: env vars > .env (cwd) > .slog (cwd) > ~/.config/slog/config > ~/.slog
 */
function loadConfigValues(): { values: Record<string, string>; source: string | null } {
  // Start with empty, will be overridden by file configs then env vars
  let values: Record<string, string> = {};
  let source: string | null = null;

  // Load from config files (later files override earlier)
  // We reverse so that higher priority files are loaded last
  for (const path of [...CONFIG_LOCATIONS].reverse()) {
    const fileValues = loadConfigFile(path);
    if (fileValues && Object.keys(fileValues).length > 0) {
      values = { ...values, ...fileValues };
      source = path;
    }
  }

  // Environment variables always take precedence
  if (process.env.SENTRY_AUTH_TOKEN) values.SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
  if (process.env.SENTRY_ORG) values.SENTRY_ORG = process.env.SENTRY_ORG;
  if (process.env.SENTRY_BASE_URL) values.SENTRY_BASE_URL = process.env.SENTRY_BASE_URL;

  // If we got values from env, note that
  if (process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_ORG) {
    source = 'environment';
  }

  return { values, source };
}

export function loadConfig(): SentryConfig {
  const { values, source } = loadConfigValues();

  const authToken = values.SENTRY_AUTH_TOKEN;
  const org = values.SENTRY_ORG;
  const baseUrl = values.SENTRY_BASE_URL || DEFAULT_BASE_URL;

  if (!authToken || !org) {
    console.error('Error: Sentry credentials not found.');
    console.error('');
    console.error('Configure by creating one of:');
    console.error('  .env or .slog in current directory');
    console.error('  ~/.config/slog/config (global)');
    console.error('  ~/.slog (global)');
    console.error('');
    console.error('File format:');
    console.error('  SENTRY_AUTH_TOKEN=sntrys_your_token');
    console.error('  SENTRY_ORG=your-org-slug');
    console.error('  # Optional:');
    console.error('  # SENTRY_BASE_URL=https://sentry.io/api/0');
    console.error('');
    console.error('Or set environment variables:');
    console.error('  export SENTRY_AUTH_TOKEN="..."');
    console.error('  export SENTRY_ORG="..."');
    console.error('');
    console.error('Create a token at: https://sentry.io/settings/auth-tokens/');
    process.exit(1);
  }

  return { authToken, org, baseUrl };
}

export function getConfigSource(): string | null {
  const { source } = loadConfigValues();
  return source;
}

export function validateConfig(config: SentryConfig): void {
  if (!config.authToken.startsWith('sntrys_') && !config.authToken.startsWith('sentry_')) {
    console.warn('Warning: Auth token format may be invalid. Expected prefix: sntrys_ or sentry_');
  }
}
