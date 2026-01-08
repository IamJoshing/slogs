// Sentry API Types

export interface SentryConfig {
  authToken: string;
  org: string;
  baseUrl: string;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  status: string;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  type: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  assignedTo?: {
    type: string;
    id: string;
    name: string;
    email?: string;
  };
  hasSeen: boolean;
  isBookmarked: boolean;
  isSubscribed: boolean;
  annotations: string[];
  stats?: {
    '24h'?: Array<[number, number]>;
    '14d'?: Array<[number, number]>;
  };
}

export interface SentryEvent {
  eventID: string;
  id: string;
  groupID?: string;
  context?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  dateCreated: string;
  dateReceived?: string;
  entries?: SentryEventEntry[];
  errors?: Array<{ type: string; message: string }>;
  message?: string;
  title?: string;
  location?: string;
  culprit?: string;
  user?: SentryUser;
  sdk?: { name: string; version: string };
  tags?: Array<{ key: string; value: string }>;
  platform?: string;
  type?: string;
  metadata?: Record<string, unknown>;
  release?: { version: string };
  dist?: string;
  environment?: string;
}

export interface SentryEventEntry {
  type: string;
  data: ExceptionData | BreadcrumbData | RequestData | unknown;
}

export interface ExceptionData {
  values?: ExceptionValue[];
  excOmitted?: boolean;
  hasSystemFrames?: boolean;
}

export interface ExceptionValue {
  type: string;
  value: string;
  mechanism?: {
    type: string;
    handled: boolean;
    description?: string;
  };
  stacktrace?: Stacktrace;
  module?: string;
  threadId?: number;
}

export interface Stacktrace {
  frames?: StackFrame[];
  framesOmitted?: [number, number];
  hasSystemFrames?: boolean;
}

export interface StackFrame {
  filename?: string;
  absPath?: string;
  module?: string;
  package?: string;
  platform?: string;
  function?: string;
  rawFunction?: string;
  symbol?: string;
  context?: Array<[number, string]>;
  lineNo?: number;
  colNo?: number;
  inApp?: boolean;
  instructionAddr?: string;
  symbolAddr?: string;
  trust?: string;
  vars?: Record<string, unknown>;
}

export interface BreadcrumbData {
  values?: Breadcrumb[];
}

export interface Breadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: string;
  timestamp?: string;
}

export interface RequestData {
  url?: string;
  method?: string;
  headers?: Array<[string, string]>;
  query?: string;
  data?: unknown;
  cookies?: Array<[string, string]>;
  env?: Record<string, string>;
  inferredContentType?: string;
}

export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  name?: string;
  data?: Record<string, unknown>;
}

export interface PaginationLinks {
  next?: { cursor: string; results: boolean };
  previous?: { cursor: string; results: boolean };
}

export type OutputFormat = 'table' | 'json';

export interface IssuesOptions {
  query?: string;
  env?: string;
  since?: string;
  limit: number;
  format: OutputFormat;
  project?: string;
  redact?: boolean;
  fields?: string;
}

export interface EventsOptions {
  limit: number;
  expand: boolean;
  format: OutputFormat;
  redact?: boolean;
  fields?: string;
}

export interface TailOptions {
  query?: string;
  env?: string;
  project?: string;
  interval: number;
  format: OutputFormat;
  redact?: boolean;
  fields?: string;
}
