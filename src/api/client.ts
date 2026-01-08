import type { SentryConfig, SentryIssue, SentryEvent, PaginationLinks } from '../types.js';

interface ApiResponse<T> {
  data: T;
  pagination: PaginationLinks;
}

interface RateLimitState {
  remaining: number;
  limit: number;
  reset: number;
  retryAfter?: number;
}

export class SentryClient {
  private config: SentryConfig;
  private rateLimit: RateLimitState = { remaining: 100, limit: 100, reset: 0 };

  constructor(config: SentryConfig) {
    this.config = config;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Wait if rate limited
    if (this.rateLimit.remaining <= 0 && Date.now() < this.rateLimit.reset) {
      const waitTime = this.rateLimit.reset - Date.now();
      await this.delay(waitTime);
    }

    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.authToken}`,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Update rate limit state
    this.updateRateLimitState(response);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10) * 1000;
      await this.delay(retryAfter);
      return this.request<T>(path, options);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new SentryApiError(
        `Sentry API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = (await response.json()) as T;
    const pagination = this.parseLinkHeader(response.headers.get('link'));

    return { data, pagination };
  }

  private updateRateLimitState(response: Response): void {
    const remaining = response.headers.get('x-sentry-rate-limit-remaining');
    const limit = response.headers.get('x-sentry-rate-limit-limit');
    const reset = response.headers.get('x-sentry-rate-limit-reset');

    if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
    if (limit) this.rateLimit.limit = parseInt(limit, 10);
    if (reset) this.rateLimit.reset = parseInt(reset, 10) * 1000;
  }

  private parseLinkHeader(header: string | null): PaginationLinks {
    if (!header) return {};

    const links: PaginationLinks = {};
    const parts = header.split(',');

    for (const part of parts) {
      const match = part.match(/<[^>]+>\s*;\s*rel="(\w+)";\s*results="(\w+)";\s*cursor="([^"]+)"/);
      if (match) {
        const [, rel, results, cursor] = match;
        if (rel === 'next' || rel === 'previous') {
          links[rel] = { cursor, results: results === 'true' };
        }
      }
    }

    return links;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getIssues(options: {
    project?: string;
    query?: string;
    statsPeriod?: string;
    environment?: string;
    limit?: number;
  }): Promise<SentryIssue[]> {
    const params = new URLSearchParams();

    if (options.query) params.set('query', options.query);
    if (options.statsPeriod) params.set('statsPeriod', options.statsPeriod);
    if (options.environment) params.set('environment', options.environment);
    if (options.limit) params.set('limit', options.limit.toString());

    const path = options.project
      ? `/projects/${this.config.org}/${options.project}/issues/?${params}`
      : `/organizations/${this.config.org}/issues/?${params}`;

    const issues: SentryIssue[] = [];
    let cursor: string | undefined;
    const maxResults = options.limit || 25;

    do {
      const paginatedParams = new URLSearchParams(params);
      if (cursor) paginatedParams.set('cursor', cursor);

      const pagePath = options.project
        ? `/projects/${this.config.org}/${options.project}/issues/?${paginatedParams}`
        : `/organizations/${this.config.org}/issues/?${paginatedParams}`;

      const { data, pagination } = await this.request<SentryIssue[]>(pagePath);
      issues.push(...data);

      if (issues.length >= maxResults) break;
      cursor = pagination.next?.results ? pagination.next.cursor : undefined;
    } while (cursor);

    return issues.slice(0, maxResults);
  }

  async getIssueEvents(
    issueId: string,
    options: { limit?: number; full?: boolean } = {}
  ): Promise<SentryEvent[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.full) params.set('full', 'true');

    const path = `/organizations/${this.config.org}/issues/${issueId}/events/?${params}`;
    const { data } = await this.request<SentryEvent[]>(path);
    return data;
  }

  async getEvent(
    issueId: string,
    eventId: string
  ): Promise<SentryEvent> {
    const path = `/organizations/${this.config.org}/issues/${issueId}/events/${eventId}/`;
    const { data } = await this.request<SentryEvent>(path);
    return data;
  }

  async getLatestEvent(issueId: string): Promise<SentryEvent> {
    const path = `/organizations/${this.config.org}/issues/${issueId}/events/latest/`;
    const { data } = await this.request<SentryEvent>(path);
    return data;
  }

  async testConnection(): Promise<boolean> {
    try {
      const path = `/organizations/${this.config.org}/`;
      await this.request(path);
      return true;
    } catch {
      return false;
    }
  }
}

export class SentryApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body: string
  ) {
    super(message);
    this.name = 'SentryApiError';
  }
}
