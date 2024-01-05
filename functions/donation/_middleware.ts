import sentryPlugin from "@cloudflare/pages-plugin-sentry"
import { CaptureConsole } from "@sentry/integrations"

interface SentryEnvVars {
    SENTRY_DSN: string
}

const hasSentryEnvVars = (env: any): env is SentryEnvVars => {
    return !!env.SENTRY_DSN
}

export const onRequest: PagesFunction = (context) => {
    if (!hasSentryEnvVars(context.env)) {
        console.error(
            "Missing SENTRY_DSN environment variable. Continuing without error logging..."
        )
        // Gracefully continue if Sentry is not configured.
        return context.next()
    }

    return sentryPlugin({
        dsn: context.env.SENTRY_DSN,
        integrations: [new CaptureConsole()],
    })(context)
}
