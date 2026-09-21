import { afterAll, beforeAll } from "vitest"
import { createTestHarness, type TestHarness } from "wrangler"

const STARTUP_TIMEOUT_MS = 60_000
const TEARDOWN_TIMEOUT_MS = 30_000

/**
 * Boots a workerd runtime for the enclosing test file, registering the vitest
 * hooks that start and close it
 *
 * The hooks get explicit budgets: vitest's inherited 10s default was never
 * sized for booting workerd, which exceeds it under load.
 */
export function setUpTestHarness(configPath: string): TestHarness {
    const server = createTestHarness({ workers: [{ configPath }] })

    beforeAll(async () => {
        await server.listen()
    }, STARTUP_TIMEOUT_MS)

    afterAll(async () => {
        await server.close()
    }, TEARDOWN_TIMEOUT_MS)

    return server
}
