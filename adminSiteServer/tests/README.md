DB-Backed Admin Tests

Overview

- Runs against a Dockerized MySQL 8 brought up by `make dbtest`.
- Tests use a shared harness (`adminSiteServer/tests/testEnv.ts`) that:
    - Seeds a baseline user (`admin@example.com`).
    - Starts an `OwidAdminApp` on `localhost:8765` and logs in.
    - Provides helpers for requests and table row counts.
    - Cleans database state after each test while preserving baseline rows.

Why Not Parallel Yet

- Fixed server port: the admin app binds to a fixed port (8765). Running multiple files in parallel would cause port conflicts.
- Shared database instance: table-wide cleanup in one test could remove rows that another test needs if they run concurrently.
- Side effects: deploy queue writes to files and the async job queue touches shared tables; tests would need stricter scoping.

What’s Needed To Parallelize

- Per-worker database: create a separate test DB per Vitest worker (e.g., `owid_test_<worker>`), migrate it, and point both Knex instances (test and server) to that DB.
- Dynamic ports: bind each app instance to port 0 and discover the assigned port for that worker/file.
- Scoped data: enforce unique slugs/IDs per test (suffixes) and/or targeted cleanup that matches only data created by the current worker.
- Optional: named locks only for truly global operations to avoid accidental cross-file races.

Targeted Cleanup

- Cleanup deletes rows from relevant tables but keeps baseline tables intact (currently: `users`).
- This preserves seeded data while ensuring tests don’t leak state into subsequent tests.
