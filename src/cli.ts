#!/usr/bin/env node

import { Command } from 'commander';
import { issuesCommand } from './commands/issues.js';
import { eventsCommand } from './commands/events.js';
import { tailCommand } from './commands/tail.js';
import type { OutputFormat } from './types.js';

const program = new Command();

program
  .name('slog')
  .description('Fast, scriptable CLI for querying Sentry issues and events')
  .version('1.0.0');

// Issues command
program
  .command('issues')
  .description('List issues (error groups) from Sentry')
  .option('-q, --query <query>', 'Sentry search query (e.g., "is:unresolved level:error")')
  .option('-e, --env <environment>', 'Filter by environment')
  .option('-s, --since <time>', 'Time period (e.g., 1h, 24h, 7d)', '24h')
  .option('-l, --limit <n>', 'Maximum number of issues to return', '25')
  .option('-p, --project <slug>', 'Filter by project slug')
  .option('-f, --format <format>', 'Output format: table or json', 'table')
  .option('--redact', 'Redact sensitive data (emails, tokens, secrets)')
  .option('--fields <fields>', 'Comma-separated list of fields to include in JSON output')
  .action(async (opts) => {
    await issuesCommand({
      query: opts.query,
      env: opts.env,
      since: opts.since,
      limit: parseInt(opts.limit, 10),
      format: opts.format as OutputFormat,
      project: opts.project,
      redact: opts.redact,
      fields: opts.fields,
    });
  });

// Events command
program
  .command('events <issue_id>')
  .description('List recent events for a specific issue')
  .option('-l, --limit <n>', 'Maximum number of events to return', '10')
  .option('-x, --expand', 'Fetch full event payload including stacktrace & breadcrumbs')
  .option('-f, --format <format>', 'Output format: table or json', 'table')
  .option('--redact', 'Redact sensitive data (emails, tokens, secrets)')
  .option('--fields <fields>', 'Comma-separated list of fields to include in JSON output')
  .action(async (issueId, opts) => {
    await eventsCommand(issueId, {
      limit: parseInt(opts.limit, 10),
      expand: opts.expand || false,
      format: opts.format as OutputFormat,
      redact: opts.redact,
      fields: opts.fields,
    });
  });

// Tail command
program
  .command('tail')
  .description('Poll for new events and print them as they appear')
  .option('-q, --query <query>', 'Sentry search query', 'is:unresolved')
  .option('-e, --env <environment>', 'Filter by environment')
  .option('-p, --project <slug>', 'Filter by project slug')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '10')
  .option('-f, --format <format>', 'Output format: table or json', 'table')
  .option('--redact', 'Redact sensitive data (emails, tokens, secrets)')
  .option('--fields <fields>', 'Comma-separated list of fields to include in JSON output')
  .action(async (opts) => {
    await tailCommand({
      query: opts.query,
      env: opts.env,
      project: opts.project,
      interval: parseInt(opts.interval, 10),
      format: opts.format as OutputFormat,
      redact: opts.redact,
      fields: opts.fields,
    });
  });

program.parse();
