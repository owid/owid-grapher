import { SENTRY_DATA_COLLECTION } from "@ourworldindata/utils"
import type { CloudflareOptions } from "@sentry/cloudflare"
import { Env } from "./env.js"

/** Sentry options shared by the Pages middleware and standalone Workers. */
export function sentryOptions(
    env: Pick<Env, "SENTRY_DSN" | "ENV">
): CloudflareOptions {
    return {
        dataCollection: SENTRY_DATA_COLLECTION,
        dsn: env.SENTRY_DSN,
        environment: env.ENV,
        tracesSampleRate: 0.01,
    }
}
