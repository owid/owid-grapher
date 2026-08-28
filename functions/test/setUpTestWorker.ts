import { afterAll, beforeAll } from "vitest"
import { unstable_startWorker } from "wrangler"

type TestWorker = Awaited<ReturnType<typeof unstable_startWorker>>

type WorkerFetch = (
    pathname: string,
    init?: Parameters<TestWorker["fetch"]>[1]
) => ReturnType<TestWorker["fetch"]>

const STARTUP_TIMEOUT_MS = 60_000
const TEARDOWN_TIMEOUT_MS = 30_000

/**
 * Boots a workerd runtime for the enclosing test file, registering the vitest
 * hooks that start and dispose it
 */
export function setUpTestWorker(configPath: string): WorkerFetch {
    let startup: Promise<TestWorker> | undefined

    beforeAll(async () => {
        // The assignment precedes the await because vitest abandons a slow
        // hook but not the startup it began.
        startup = unstable_startWorker({
            config: configPath,
            dev: { logLevel: "none" },
        })
        await startup
    }, STARTUP_TIMEOUT_MS)

    afterAll(async () => {
        const worker = await startup?.catch(() => undefined)
        await worker?.dispose()
    }, TEARDOWN_TIMEOUT_MS)

    return async (pathname, init) => {
        const worker = await startup
        if (!worker)
            throw new Error(
                `no worker for ${configPath}: setUpTestWorker must be called at file scope`
            )
        return worker.fetch(`http://example.com${pathname}`, init)
    }
}
