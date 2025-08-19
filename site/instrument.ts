import * as Sentry from "@sentry/react"
import {
    COMMIT_SHA,
    ENV,
    LOAD_SENTRY,
    SENTRY_DSN,
} from "../settings/clientSettings.js"

if (LOAD_SENTRY) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENV,
        debug: ENV === "development",
        release: COMMIT_SHA,
        integrations: [
            Sentry.replayIntegration({
                maskAllText: false,
                maskAllInputs: false,
                blockAllMedia: false,
                mask: [".sentry-mask"],
            }),
        ],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
    })
}
