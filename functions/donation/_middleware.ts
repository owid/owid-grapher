import sentryPlugin from "@cloudflare/pages-plugin-sentry"
import { CaptureConsole } from "@sentry/integrations"

interface SentryEnvVars {
    SENTRY_DSN: string
    ENV: "production" | "development"
}

const hasSentryEnvVars = (env: any): env is SentryEnvVars => {
    return (
        !!env.SENTRY_DSN &&
        !!env.ENV &&
        ["production", "development"].includes(env.ENV)
    )
}

export const onRequest: PagesFunction = (context) => {
    if (!hasSentryEnvVars(context.env)) {
        console.error(
            "Missing Sentry environment variables. Continuing without error logging..."
        )
        // Gracefully continue if Sentry is not configured.
        return context.next()
    }

    return sentryPlugin({
        dsn: context.env.SENTRY_DSN,
        integrations: [new CaptureConsole()],
        environment: context.env.ENV,
    })(context)
}
