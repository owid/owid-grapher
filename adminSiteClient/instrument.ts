import * as Sentry from "@sentry/react"

Sentry.init({
    dsn: process.env.SENTRY_ADMIN_DSN,
    environment: process.env.ENV,
    release: process.env.COMMIT_SHA,
})
