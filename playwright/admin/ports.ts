// Kept free of other imports: the Playwright config reads these to build the
// environment of the test server, which must be set before any settings
// module is loaded.
export const HOST = "localhost"
// ADMIN_TEST_PORT moves the three ports, e.g. to run two suites side by side
// (each also needs its own GRAPHER_TEST_DB_NAME)
export const ADMIN_SERVER_PORT = Number(process.env.ADMIN_TEST_PORT || 8765)
export const VITE_PORT = ADMIN_SERVER_PORT + 1
export const DATA_API_PORT = ADMIN_SERVER_PORT + 2

/**
 * By default the test server builds the admin client once and serves the
 * bundle, which keeps page loads fast when many tests run in parallel. Set
 * ADMIN_TEST_VITE_DEV=1 to serve it from a Vite dev server instead, which
 * starts faster and picks up edits to the admin code without a restart.
 */
export const useViteDevServer = process.env.ADMIN_TEST_VITE_DEV === "1"

/** Kept apart from `dist` so that local bakes never pick up the test build */
export const TEST_VITE_DIST_DIR = `tmp-playwright-admin-dist/${ADMIN_SERVER_PORT}`

/** Environment for the test server, read by both server and client settings */
export const testServerEnv: Record<string, string> = {
    ADMIN_SERVER_PORT: String(ADMIN_SERVER_PORT),
    VITE_PORT: String(VITE_PORT),
    VITE_PREVIEW: String(!useViteDevServer),
    VITE_DIST_DIR: TEST_VITE_DIST_DIR,
    DATA_API_URL: `http://${HOST}:${DATA_API_PORT}/v1/indicators`,
    // nothing listens here: the catalog is only used for optional entity
    // sorting, and the tests must not reach the real one
    CATALOG_URL: `http://${HOST}:${DATA_API_PORT}/catalog`,
}
