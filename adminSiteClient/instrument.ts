import * as Sentry from "@sentry/react"
import {
    COMMIT_SHA,
    ENV,
    SENTRY_ADMIN_DSN,
} from "../settings/clientSettings.js"

if (!process.env.VITEST) {
    Sentry.init({
        dsn: SENTRY_ADMIN_DSN,
        environment: ENV,
        release: COMMIT_SHA,
    })
}
