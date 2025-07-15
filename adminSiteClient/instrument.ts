import * as Sentry from "@sentry/react"
import {
    COMMIT_SHA,
    ENV,
    SENTRY_ADMIN_DSN,
} from "../settings/clientSettings.js"

// This is a weird no-op, but we need to import the node types here to get
// the types for `process.env` to work correctly.
import "node"

if (!process.env.VITEST) {
    Sentry.init({
        dsn: SENTRY_ADMIN_DSN,
        environment: ENV,
        release: COMMIT_SHA,
    })
}
