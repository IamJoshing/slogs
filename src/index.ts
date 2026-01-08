// Main package exports
export { SentryClient, SentryApiError } from './api/client.js';
export { loadConfig, validateConfig, getConfigSource } from './config.js';
export { redactObject, redactString, filterFields, filterArrayFields } from './utils/redact.js';
export { formatIssues, formatEvents, formatEventDetail, formatTailEvent } from './utils/format.js';

// Re-export types
export type {
  SentryConfig,
  SentryIssue,
  SentryEvent,
  SentryEventEntry,
  SentryUser,
  ExceptionData,
  ExceptionValue,
  Stacktrace,
  StackFrame,
  BreadcrumbData,
  Breadcrumb,
  RequestData,
  OutputFormat,
  IssuesOptions,
  EventsOptions,
  TailOptions,
} from './types.js';
