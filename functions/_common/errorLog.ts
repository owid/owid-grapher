import * as Sentry from "@sentry/cloudflare"

export function logErrorAndCaptureInSentry(
    message: string,
    error: unknown
): void {
    console.error(message, error)
    Sentry.captureException(error)
}
