// Creates a worker using the workerpool library.
// This way, we can spawn multiple threads that work away at our tasks in parallel.

import workerpool from "workerpool"

import * as utils from "./utils.js"

// utils.js reaches db/cleanup.ts (via db/model/Variable.js), which registers
// SIGINT and SIGTERM handlers at import time. A JS signal handler suppresses
// Node's default kill-on-signal and queues the exit onto the event loop
// instead - and a worker wedged inside oxfmt's native formatter, the whole
// reason these are processes rather than threads, never drains that loop. So
// workerpool's `worker.kill()` (a bare SIGTERM) would leave it alive and the
// pool could never recover. Dropping the handlers restores the default
// disposition; the worker renders from dumped files and never opens the
// database, so it has nothing to clean up.
process.removeAllListeners("SIGINT")
process.removeAllListeners("SIGTERM")

// create a worker and register public functions
workerpool.worker({
    renderAndVerifySvg: utils.renderAndVerifySvg,
    renderSvgAndSave: utils.renderSvgAndSave,
})
