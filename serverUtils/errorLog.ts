import * as Sentry from "@sentry/react"

export async function logErrorAndMaybeCaptureInSentry(
    err: any,
    context?: Parameters<typeof Sentry.captureException>[1]
): Promise<void> {
    console.error(err)

    if (!process.env.VITEST) Sentry.captureException(err, context)
}
