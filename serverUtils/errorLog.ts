import * as Sentry from "@sentry/react"

export async function logErrorAndMaybeCaptureInSentry(err: any) {
    console.error(err)
    Sentry.captureException(err)
}
