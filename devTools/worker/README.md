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

### Development

```bash
# Run directly with ts-node
npx ts-node devTools/worker/explorerJobsWorker.ts

# Or compile and run
yarn tsc --project devTools/worker/tsconfig.json
node devTools/worker/dist/explorerJobsWorker.js
```

### Production

The worker should be run as a long-running background service (e.g., via systemd, Docker, or a process manager like PM2).

```bash
# Example with PM2
pm2 start devTools/worker/explorerJobsWorker.ts --name "explorer-jobs-worker"
```

## Configuration

The worker uses these configurable constants (defined in the script):

- `MAX_ATTEMPTS`: Maximum number of retry attempts for failed jobs (default: 3)
- `CONCURRENCY`: Maximum concurrent R2 operations (default: 20)
- `POLL_INTERVAL_MS`: How often to check for new jobs when queue is empty (default: 2000ms)

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
