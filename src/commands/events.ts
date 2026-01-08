import { SentryClient } from '../api/client.js';
import { loadConfig } from '../config.js';
import { formatEvents, formatEventDetail } from '../utils/format.js';
import type { EventsOptions } from '../types.js';

export async function eventsCommand(
  issueId: string,
  options: EventsOptions
): Promise<void> {
  const config = loadConfig();
  const client = new SentryClient(config);

  try {
    // Fetch events for the issue
    const events = await client.getIssueEvents(issueId, {
      limit: options.limit,
      full: options.expand,
    });

    // If expand is requested but we didn't get full event data,
    // fetch each event individually
    if (options.expand && events.length > 0 && !events[0].entries) {
      const fullEvents = await Promise.all(
        events.map((e) => client.getEvent(issueId, e.eventID))
      );
      const output = formatEvents(fullEvents, options.format, {
        redact: options.redact,
        fields: options.fields,
        expand: true,
      });
      console.log(output);
      return;
    }

    const output = formatEvents(events, options.format, {
      redact: options.redact,
      fields: options.fields,
      expand: options.expand,
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
