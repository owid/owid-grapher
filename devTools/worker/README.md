# Explorer Jobs Worker

This directory contains the asynchronous job processing worker for explorer view refreshes.

## Overview

The explorer jobs worker is a long-running background process that handles time-consuming explorer view refresh operations asynchronously. When an explorer is updated via the admin API, instead of processing the refresh inline (which can take minutes for large explorers), a job is queued and processed by this worker.

## Features

- **Async Processing**: Moves expensive operations out of the request/response cycle
- **Job Coalescing**: Multiple updates to the same explorer are coalesced - only the latest generation is processed
- **Retry Logic**: Failed jobs are retried with exponential backoff up to a maximum number of attempts
- **R2 Sync**: Handles R2 uploads/deletes outside of database transactions
- **Graceful Shutdown**: Responds to SIGINT/SIGTERM signals for clean shutdowns

## Running the Worker

The worker supports two modes of operation:

- **Single-run mode** (default): Processes one job and exits
- **Loop mode**: Runs continuously, polling for jobs

### Development

```bash
# Single-run mode (default) - process one job and exit
npx ts-node devTools/worker/explorerJobsWorker.ts

# Loop mode - continuous polling
npx ts-node devTools/worker/explorerJobsWorker.ts --loop

# Or compile and run
yarn tsc --project devTools/worker/tsconfig.json
node devTools/worker/dist/explorerJobsWorker.js
node devTools/worker/dist/explorerJobsWorker.js --loop
```

### Production

The worker can be deployed in multiple ways:

#### Option 1: PM2 with Cron (Recommended for periodic processing)

```bash
# Process jobs every minute
pm2 start devTools/worker/explorerJobsWorker.js --name "explorer-jobs-cron" --cron "* * * * *" --no-autorestart
```

#### Option 2: PM2 Continuous Service

```bash
# Long-running service with continuous polling
pm2 start devTools/worker/explorerJobsWorker.js --name "explorer-jobs-worker" -- --loop
```

#### Option 3: System Cron

```bash
# Add to crontab for periodic execution
*/5 * * * * /usr/bin/node /path/to/explorerJobsWorker.js
```

## Configuration

The worker uses these configurable constants (defined in the script):

- `MAX_ATTEMPTS`: Maximum number of retry attempts for failed jobs (default: 3)
- `CONCURRENCY`: Maximum concurrent R2 operations (default: 20)
- `POLL_INTERVAL_MS`: How often to check for new jobs when queue is empty in loop mode (default: 2000ms)

### Command Line Options

- `--loop`: Run in continuous loop mode (default: single-run mode)
- `--help`: Show help information

## Job Processing Flow

1. **Claim Job**: Atomically claim the next queued job using database row locking
2. **Staleness Check**: If explorer was updated after job was queued, skip (coalescing)
3. **DB Phase**: Update `explorer_views` table within a transaction
4. **R2 Sync**: Upload/delete chart configs to/from R2 (outside transaction)
5. **Success**: Mark explorer as "clean" and trigger static build if published
6. **Failure**: Retry with backoff or mark as failed after max attempts

## Job States

- `queued`: Job is waiting to be processed
- `running`: Job is currently being processed
- `done`: Job completed successfully
- `failed`: Job failed after maximum retry attempts

## Explorer States

- `clean`: Views are up-to-date
- `queued`: Views refresh is queued
- `refreshing`: Views refresh is in progress
- `failed`: Views refresh failed

## Monitoring

The worker logs its activities to stdout, including:

- Job processing start/completion
- Error details and retry attempts
- Configuration information on startup
- Graceful shutdown messages

## Database Tables

- `jobs`: Queue of background jobs
- `explorers`: Explorer refresh status tracking
- `explorer_views`: Generated chart configurations
- `chart_configs`: Chart configuration storage
