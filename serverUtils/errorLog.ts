import * as Sentry from "@sentry/react"

export async function logErrorAndMaybeCaptureInSentry(err: any) {
    console.error(err)

    if (!process.env.VITEST) Sentry.captureException(err)
}
