import Table from 'cli-table3';
import chalk from 'chalk';
import type {
  SentryIssue,
  SentryEvent,
  OutputFormat,
  ExceptionData,
  BreadcrumbData,
  StackFrame,
  Breadcrumb,
} from '../types.js';
import { redactObject, filterFields, filterArrayFields } from './redact.js';

// Time formatting
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return `${diffSecs}s ago`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// Level coloring
function colorLevel(level: string): string {
  switch (level.toLowerCase()) {
    case 'error':
    case 'fatal':
      return chalk.red(level);
    case 'warning':
      return chalk.yellow(level);
    case 'info':
      return chalk.blue(level);
    default:
      return chalk.gray(level);
  }
}

// Issue formatting
export function formatIssues(
  issues: SentryIssue[],
  format: OutputFormat,
  options: { redact?: boolean; fields?: string } = {}
): string {
  let data: SentryIssue[] | Partial<SentryIssue>[] = issues;

  if (options.redact) {
    data = redactObject(data);
  }

  if (options.fields) {
    const fieldList = options.fields.split(',').map((f) => f.trim());
    data = filterArrayFields(data as SentryIssue[], fieldList);
  }

  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  // Table format
  if (issues.length === 0) {
    return chalk.gray('No issues found');
  }

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('Level'),
      chalk.cyan('Title'),
      chalk.cyan('Events'),
      chalk.cyan('Users'),
      chalk.cyan('Last Seen'),
    ],
    colWidths: [12, 8, 50, 8, 7, 12],
    wordWrap: true,
  });

  for (const issue of issues) {
    table.push([
      issue.shortId,
      colorLevel(issue.level),
      truncate(issue.title, 47),
      issue.count,
      issue.userCount?.toString() || '-',
      formatTimeAgo(issue.lastSeen),
    ]);
  }

  return table.toString();
}

// Event formatting
export function formatEvents(
  events: SentryEvent[],
  format: OutputFormat,
  options: { redact?: boolean; fields?: string; expand?: boolean } = {}
): string {
  let data: SentryEvent[] | Partial<SentryEvent>[] = events;

  if (options.redact) {
    data = redactObject(data);
  }

  if (options.fields) {
    const fieldList = options.fields.split(',').map((f) => f.trim());
    data = filterArrayFields(data as SentryEvent[], fieldList);
  }

  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  // Table format
  if (events.length === 0) {
    return chalk.gray('No events found');
  }

  const table = new Table({
    head: [
      chalk.cyan('Event ID'),
      chalk.cyan('Time'),
      chalk.cyan('Exception'),
      chalk.cyan('Message'),
    ],
    colWidths: [14, 12, 25, 40],
    wordWrap: true,
  });

  for (const event of events) {
    const exceptionType = getExceptionType(event);
    const message = event.title || event.message || '-';

    table.push([
      event.eventID.slice(0, 12),
      formatTimeAgo(event.dateCreated),
      truncate(exceptionType, 22),
      truncate(message, 37),
    ]);
  }

  let output = table.toString();

  // If expand is set, add detailed info for each event
  if (options.expand) {
    output += '\n\n' + chalk.bold('Event Details:\n');
    for (const event of events) {
      output += formatEventDetail(event);
      output += '\n' + chalk.gray('─'.repeat(80)) + '\n';
    }
  }

  return output;
}

// Single event detail formatting
export function formatEventDetail(event: SentryEvent): string {
  const lines: string[] = [];

  lines.push(chalk.bold(`Event: ${event.eventID}`));
  lines.push(`Time: ${new Date(event.dateCreated).toISOString()}`);

  if (event.environment) {
    lines.push(`Environment: ${event.environment}`);
  }

  if (event.release?.version) {
    lines.push(`Release: ${event.release.version}`);
  }

  if (event.user) {
    const userStr = [
      event.user.id && `id:${event.user.id}`,
      event.user.email && `email:${event.user.email}`,
      event.user.username && `user:${event.user.username}`,
    ]
      .filter(Boolean)
      .join(' ');
    if (userStr) lines.push(`User: ${userStr}`);
  }

  // Exception details
  const exception = getExceptionEntry(event);
  if (exception) {
    lines.push('');
    lines.push(chalk.bold('Exception:'));
    for (const value of exception.values || []) {
      lines.push(chalk.red(`  ${value.type}: ${value.value}`));

      // Stacktrace
      if (value.stacktrace?.frames) {
        lines.push(chalk.gray('  Stacktrace (most recent last):'));
        const frames = value.stacktrace.frames.slice(-5); // Last 5 frames
        for (const frame of frames) {
          const loc = formatFrameLocation(frame);
          const inApp = frame.inApp ? chalk.green('●') : chalk.gray('○');
          lines.push(`    ${inApp} ${loc}`);
        }
        if (value.stacktrace.frames.length > 5) {
          lines.push(
            chalk.gray(`    ... ${value.stacktrace.frames.length - 5} more frames`)
          );
        }
      }
    }
  }

  // Breadcrumbs
  const breadcrumbs = getBreadcrumbsEntry(event);
  if (breadcrumbs && breadcrumbs.values && breadcrumbs.values.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Breadcrumbs (last 5):'));
    const crumbs = breadcrumbs.values.slice(-5);
    for (const crumb of crumbs) {
      const time = crumb.timestamp
        ? new Date(crumb.timestamp).toISOString().slice(11, 19)
        : '??:??:??';
      const cat = crumb.category || crumb.type || 'default';
      const msg = crumb.message || JSON.stringify(crumb.data) || '';
      lines.push(chalk.gray(`  [${time}]`) + ` ${cat}: ${truncate(msg, 50)}`);
    }
  }

  return lines.join('\n');
}

// Helper functions
function getExceptionType(event: SentryEvent): string {
  const exception = getExceptionEntry(event);
  if (exception?.values?.[0]) {
    return exception.values[0].type;
  }
  return event.metadata?.type as string || '-';
}

function getExceptionEntry(event: SentryEvent): ExceptionData | null {
  if (!event.entries) return null;
  const entry = event.entries.find((e) => e.type === 'exception');
  return entry?.data as ExceptionData | null;
}

function getBreadcrumbsEntry(event: SentryEvent): BreadcrumbData | null {
  if (!event.entries) return null;
  const entry = event.entries.find((e) => e.type === 'breadcrumbs');
  return entry?.data as BreadcrumbData | null;
}

function formatFrameLocation(frame: StackFrame): string {
  const filename = frame.filename || frame.absPath || frame.module || '?';
  const func = frame.function || '?';
  const line = frame.lineNo ? `:${frame.lineNo}` : '';
  const col = frame.colNo ? `:${frame.colNo}` : '';

  return `${filename}${line}${col} in ${func}`;
}

// Tail output (single event, compact)
export function formatTailEvent(
  event: SentryEvent,
  format: OutputFormat,
  options: { redact?: boolean } = {}
): string {
  let data: SentryEvent = event;

  if (options.redact) {
    data = redactObject(data);
  }

  if (format === 'json') {
    return JSON.stringify(data);
  }

  const time = new Date(event.dateCreated).toISOString().slice(11, 19);
  const exceptionType = getExceptionType(event);
  const message = truncate(event.title || event.message || '-', 60);
  const env = event.environment || '-';

  return `${chalk.gray(time)} ${chalk.yellow(exceptionType)} ${chalk.blue(`[${env}]`)} ${message}`;
}
