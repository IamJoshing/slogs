// Patterns for sensitive data
const PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // API keys and tokens (common patterns)
  apiKey: /\b(?:sk[-_]|pk[-_]|api[-_]?key[-_]?|token[-_]?)[a-zA-Z0-9_-]{20,}\b/gi,

  // Bearer tokens
  bearer: /Bearer\s+[a-zA-Z0-9_-]+/gi,

  // Basic auth
  basicAuth: /Basic\s+[a-zA-Z0-9+/=]+/gi,

  // JWT tokens
  jwt: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,

  // AWS keys
  awsKey: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  awsSecret: /\b[A-Za-z0-9/+=]{40}\b/g,

  // Generic secrets (32+ char hex or base64)
  genericSecret: /\b[a-fA-F0-9]{32,}\b/g,

  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // IP addresses
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  // Password fields in URLs
  urlPassword: /:\/\/[^:]+:([^@]+)@/g,

  // Sentry auth tokens
  sentryToken: /\b(?:sntrys_|sentry_)[a-zA-Z0-9_-]+/g,
};

// Headers that commonly contain sensitive data
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-xsrf-token',
  'proxy-authorization',
  'www-authenticate',
  'x-access-token',
  'x-refresh-token',
]);

const REDACTED = '[REDACTED]';

export function redactString(value: string): string {
  let result = value;

  // Apply all patterns
  result = result.replace(PATTERNS.email, REDACTED);
  result = result.replace(PATTERNS.bearer, `Bearer ${REDACTED}`);
  result = result.replace(PATTERNS.basicAuth, `Basic ${REDACTED}`);
  result = result.replace(PATTERNS.jwt, REDACTED);
  result = result.replace(PATTERNS.apiKey, REDACTED);
  result = result.replace(PATTERNS.awsKey, REDACTED);
  result = result.replace(PATTERNS.sentryToken, REDACTED);
  result = result.replace(PATTERNS.urlPassword, `://$1:${REDACTED}@`);

  return result;
}

export function redactObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if this is a sensitive header or field
      if (
        SENSITIVE_HEADERS.has(lowerKey) ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('auth') ||
        lowerKey.includes('credential')
      ) {
        result[key] = REDACTED;
      } else if (typeof value === 'string') {
        result[key] = redactString(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redactObject(value);
      } else {
        result[key] = value;
      }
    }

    return result as T;
  }

  return obj;
}

export function redactHeaders(
  headers: Array<[string, string]> | undefined
): Array<[string, string]> | undefined {
  if (!headers) return headers;

  return headers.map(([key, value]) => {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      return [key, REDACTED];
    }
    return [key, redactString(value)];
  });
}

export function filterFields<T extends object>(
  obj: T,
  allowedFields: string[]
): Partial<T> {
  const result: Partial<T> = {};
  const record = obj as Record<string, unknown>;

  for (const field of allowedFields) {
    if (field in record) {
      result[field as keyof T] = record[field] as T[keyof T];
    }
  }

  return result;
}

export function filterArrayFields<T extends object>(
  arr: T[],
  allowedFields: string[]
): Array<Partial<T>> {
  return arr.map((item) => filterFields(item, allowedFields));
}
