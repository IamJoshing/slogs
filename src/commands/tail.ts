import { SentryClient } from '../api/client.js';
import { loadConfig } from '../config.js';
import { formatTailEvent } from '../utils/format.js';
import type { TailOptions, SentryIssue, SentryEvent } from '../types.js';
import chalk from 'chalk';

export async function tailCommand(options: TailOptions): Promise<void> {
  const config = loadConfig();
  const client = new SentryClient(config);

  // Track seen events to avoid duplicates
  const seenEvents = new Set<string>();
  let lastCheck = new Date();

  // Build the query
  let query = options.query || 'is:unresolved';
  if (options.env && !query.includes('environment:')) {
    query = `${query} environment:${options.env}`;
  }

  console.error(chalk.gray(`Tailing events matching: ${query}`));
  console.error(chalk.gray(`Polling every ${options.interval}s. Press Ctrl+C to stop.\n`));

  // Initial fetch to populate seen events
  try {
    const issues = await client.getIssues({
      project: options.project,
      query,
      statsPeriod: '1h',
      limit: 10,
    });

    // Mark all current events as seen
    for (const issue of issues) {
      try {
        const events = await client.getIssueEvents(issue.id, { limit: 5 });
        for (const event of events) {
          seenEvents.add(event.eventID);
        }
      } catch {
        // Ignore errors for individual issues
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error during initial fetch: ${error.message}`);
    }
    process.exit(1);
  }

  // Poll for new events
  const poll = async () => {
    try {
      const issues = await client.getIssues({
        project: options.project,
        query,
        statsPeriod: '1h',
        limit: 25,
      });

      // Check each issue for new events
      for (const issue of issues) {
        // Skip if last seen is before our last check
        const lastSeen = new Date(issue.lastSeen);
        if (lastSeen <= lastCheck) continue;

        try {
          const events = await client.getIssueEvents(issue.id, { limit: 5 });

          for (const event of events) {
            if (seenEvents.has(event.eventID)) continue;

            const eventTime = new Date(event.dateCreated);
            if (eventTime <= lastCheck) continue;

            seenEvents.add(event.eventID);

            const output = formatTailEvent(event, options.format, {
              redact: options.redact,
            });
            console.log(output);
          }
        } catch {
          // Ignore errors for individual issues
        }
      }

      lastCheck = new Date();
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Poll error: ${error.message}`));
      }
    }
  };

  // Start polling
  const intervalMs = options.interval * 1000;
  setInterval(poll, intervalMs);

  // Keep the process alive
  process.on('SIGINT', () => {
    console.error(chalk.gray('\nStopped tailing.'));
    process.exit(0);
  });
}
