# slog

Fast, scriptable CLI for querying Sentry issues and events. Designed for developers and AI agents.

## Features

- Query and filter Sentry issues using native search syntax
- Inspect event details including stacktraces and breadcrumbs
- Tail new events in real-time (polling-based)
- Human-readable tables or machine-friendly JSON output
- Built-in sensitive data redaction for AI safety
- Field allowlisting for controlled output
- Rate limiting and pagination handled automatically

## Installation

### Prerequisites

- Node.js 18+ or [Bun](https://bun.sh) runtime

### Install from npm

```bash
npm install -g @iamjoshing/slog
```

### Install from source

```bash
git clone https://github.com/IamJoshing/slogs.git
cd slogs
npm install
npm link
```

## Configuration

### 1. Get Your Organization Slug

Your `SENTRY_ORG` is the organization slug from your Sentry URL:

```
https://<your-org-slug>.sentry.io/...
         ^^^^^^^^^^^^^^
         This is your SENTRY_ORG
```

For example, if your Sentry URL is `https://acme-corp.sentry.io/issues/`, your org slug is `acme-corp`.

### 2. Create an Auth Token

1. Go to your Sentry auth tokens page:
   ```
   https://<your-org-slug>.sentry.io/settings/account/api/auth-tokens/
   ```
2. Click **Create New Token**
3. Give it a name (e.g., "slog CLI")
4. Select the required scopes:
   - `project:read`
   - `event:read`
   - `org:read`
5. Click **Create Token** and copy the token (starts with `sntrys_`)

### 3. Set Environment Variables

```bash
export SENTRY_AUTH_TOKEN="sntrys_your_token_here"
export SENTRY_ORG="your-org-slug"

# Optional: For self-hosted Sentry
export SENTRY_BASE_URL="https://your-sentry.com/api/0"
```

You can add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or use a `.env` file.

## Usage

### List Issues

```bash
# List unresolved issues from last 24 hours (default)
slog issues

# List errors from production in the last hour
slog issues --query "is:unresolved level:error" --env production --since 1h

# Get issues as JSON for piping
slog issues --format json --limit 10

# List issues for a specific project
slog issues --project my-project --since 7d
```

### View Events

```bash
# List recent events for an issue
slog events ISSUE-123

# Get full event details with stacktraces
slog events ISSUE-123 --expand

# Output as JSON for processing
slog events ISSUE-123 --format json --expand
```

### Tail Events

```bash
# Watch for new unresolved errors
slog tail

# Tail production errors with custom poll interval
slog tail --env production --interval 5

# Output new events as JSON (useful for piping to processors)
slog tail --format json --query "level:error"
```

## AI Agent Safety

### Redaction

Use `--redact` to automatically remove sensitive data:

```bash
# Redact emails, tokens, API keys, and other secrets
slog events ISSUE-123 --format json --redact
```

Redacted patterns include:
- Email addresses
- Bearer/Basic auth tokens
- JWT tokens
- API keys (various formats)
- AWS credentials
- Sentry auth tokens
- Passwords in URLs
- Sensitive HTTP headers

### Field Allowlisting

Use `--fields` to output only specific fields:

```bash
# Only include specific fields in output
slog issues --format json --fields "id,title,level,lastSeen"

# Combine with redaction
slog events ISSUE-123 --format json --redact --fields "eventID,title,dateCreated"
```

## Examples

### List unresolved production errors from last 24h

```bash
slog issues --query "is:unresolved level:error" --env production --since 24h
```

### Show latest events for an issue with full details

```bash
slog events PROJ-1234 --expand --limit 5
```

### Tail new errors and pipe to another program

```bash
slog tail --format json | jq '.title'
```

### Export issues as JSON for LLM analysis

```bash
slog issues --format json --redact --limit 50 > issues.json
```

### Get specific fields for automation

```bash
slog issues --format json --fields "shortId,title,count,lastSeen" | jq -r '.[] | "\(.shortId): \(.title)"'
```

## Command Reference

### `slog issues`

List issues (error groups) from Sentry.

| Flag | Description | Default |
|------|-------------|---------|
| `-q, --query <query>` | Sentry search query | - |
| `-e, --env <env>` | Filter by environment | - |
| `-s, --since <time>` | Time period (1h, 24h, 7d) | 24h |
| `-l, --limit <n>` | Max issues to return | 25 |
| `-p, --project <slug>` | Filter by project | - |
| `-f, --format <fmt>` | Output format (table/json) | table |
| `--redact` | Redact sensitive data | false |
| `--fields <list>` | Comma-separated field list | - |

### `slog events <issue_id>`

List recent events for a specific issue.

| Flag | Description | Default |
|------|-------------|---------|
| `-l, --limit <n>` | Max events to return | 10 |
| `-x, --expand` | Include stacktrace/breadcrumbs | false |
| `-f, --format <fmt>` | Output format (table/json) | table |
| `--redact` | Redact sensitive data | false |
| `--fields <list>` | Comma-separated field list | - |

### `slog tail`

Poll for new events and print them as they appear.

| Flag | Description | Default |
|------|-------------|---------|
| `-q, --query <query>` | Sentry search query | is:unresolved |
| `-e, --env <env>` | Filter by environment | - |
| `-p, --project <slug>` | Filter by project | - |
| `-i, --interval <sec>` | Poll interval in seconds | 10 |
| `-f, --format <fmt>` | Output format (table/json) | table |
| `--redact` | Redact sensitive data | false |
| `--fields <list>` | Comma-separated field list | - |

## Sentry Search Syntax

slog supports Sentry's native search syntax:

```bash
# By status
is:unresolved
is:resolved
is:ignored

# By level
level:error
level:warning
level:info

# By assignment
is:assigned
is:unassigned
assigned:me

# By date
lastSeen:-24h
firstSeen:-7d

# By count
times_seen:>100

# Combine queries
"is:unresolved level:error environment:production"
```

## Project Structure

```
slog/
├── bin/
│   └── slog              # CLI entrypoint
├── src/
│   ├── api/
│   │   └── client.ts     # Sentry API client
│   ├── commands/
│   │   ├── issues.ts     # Issues command
│   │   ├── events.ts     # Events command
│   │   └── tail.ts       # Tail command
│   ├── utils/
│   │   ├── format.ts     # Output formatters
│   │   └── redact.ts     # Redaction utilities
│   ├── cli.ts            # CLI definition
│   ├── config.ts         # Configuration loader
│   └── types.ts          # TypeScript types
├── package.json
└── tsconfig.json
```

## License

MIT
