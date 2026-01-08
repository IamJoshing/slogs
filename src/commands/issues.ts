import { SentryClient } from '../api/client.js';
import { loadConfig } from '../config.js';
import { formatIssues } from '../utils/format.js';
import type { IssuesOptions } from '../types.js';

// Parse time string to statsPeriod format (e.g., "24h", "7d", "1h")
function parseTimePeriod(since: string | undefined): string | undefined {
  if (!since) return undefined;

  // Already in correct format
  if (/^\d+[hdwm]$/.test(since)) {
    return since;
  }

  // Handle common variations
  const match = since.match(/^(\d+)\s*(hours?|days?|weeks?|minutes?)$/i);
  if (match) {
    const value = match[1];
    const unit = match[2].toLowerCase();
    if (unit.startsWith('hour')) return `${value}h`;
    if (unit.startsWith('day')) return `${value}d`;
    if (unit.startsWith('week')) return `${value}w`;
    if (unit.startsWith('minute')) return `${value}m`;
  }

  return since;
}

export async function issuesCommand(options: IssuesOptions): Promise<void> {
  const config = loadConfig();
  const client = new SentryClient(config);

  try {
    // Build the query
    let query = options.query || '';

    // Add environment to query if specified
    if (options.env && !query.includes('environment:')) {
      query = query ? `${query} environment:${options.env}` : `environment:${options.env}`;
    }

    const issues = await client.getIssues({
      project: options.project,
      query: query || undefined,
      statsPeriod: parseTimePeriod(options.since),
      limit: options.limit,
    });

    const output = formatIssues(issues, options.format, {
      redact: options.redact,
      fields: options.fields,
    });

    console.log(output);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
