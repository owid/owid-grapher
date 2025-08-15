// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O
// Settings in here will be made available to the client-side code that is
// bundled and shipped out to our users.

import "./loadDotenv.js"

const parseIntOrUndefined = (value: string | undefined): number | undefined => {
    try {
        return value ? parseInt(value) : undefined
    } catch {
        return undefined
    }
}

type Environment = "development" | "staging" | "production"
export const ENV: Environment =
    (process.env.ENV as Environment) || "development"
export const IS_ARCHIVE: boolean = process.env.IS_ARCHIVE === "true"
export const COMMIT_SHA = process.env.COMMIT_SHA

export const SENTRY_DSN: string | undefined = process.env.SENTRY_DSN
export const SENTRY_ADMIN_DSN: string | undefined = process.env.SENTRY_ADMIN_DSN
export const ADMIN_SERVER_PORT: number =
    parseIntOrUndefined(process.env.ADMIN_SERVER_PORT) ?? 3030
export const ADMIN_SERVER_HOST: string =
    process.env.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    process.env.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL: string =
    process.env.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const GRAPHER_DYNAMIC_THUMBNAIL_URL: string =
    process.env.GRAPHER_DYNAMIC_THUMBNAIL_URL ?? `${BAKED_GRAPHER_URL}`

export const EXPLORER_DYNAMIC_THUMBNAIL_URL: string =
    process.env.EXPLORER_DYNAMIC_THUMBNAIL_URL ?? `${BAKED_BASE_URL}/explorers`

export const GRAPHER_DYNAMIC_CONFIG_URL: string =
    process.env.GRAPHER_DYNAMIC_CONFIG_URL ?? `${BAKED_GRAPHER_URL}`

export const EXPLORER_DYNAMIC_CONFIG_URL: string =
    process.env.EXPLORER_DYNAMIC_CONFIG_URL ?? `${BAKED_BASE_URL}/explorers`

export const MULTI_DIM_DYNAMIC_CONFIG_URL: string =
    process.env.MULTI_DIM_DYNAMIC_CONFIG_URL ?? `${BAKED_BASE_URL}/multi-dim`

export const ADMIN_BASE_URL: string =
    process.env.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
// e.g. "https://api.ourworldindata.org/v1/indicators" or "https://api-staging.owid.io/user/v1/indicators"
export const DATA_API_URL: string =
    process.env.DATA_API_URL ?? "https://api.ourworldindata.org/v1/indicators"

export const ALGOLIA_ID: string = process.env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string = process.env.ALGOLIA_SEARCH_KEY ?? ""
export const ALGOLIA_INDEX_PREFIX: string =
    process.env.ALGOLIA_INDEX_PREFIX ?? ""

export const CLOUDFLARE_IMAGES_URL = process.env.CLOUDFLARE_IMAGES_URL ?? ""

export const DONATE_API_URL: string =
    process.env.DONATE_API_URL ?? "http://localhost:8788/donation/donate"

export const RECAPTCHA_SITE_KEY: string =
    process.env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

// e.g. "GTM-N2D4V8S" (our production GTM container)
export const GOOGLE_TAG_MANAGER_ID: string =
    process.env.GOOGLE_TAG_MANAGER_ID ?? ""

export const TOPICS_CONTENT_GRAPH: boolean =
    process.env.TOPICS_CONTENT_GRAPH === "true"

export const GDOCS_CLIENT_EMAIL: string = process.env.GDOCS_CLIENT_EMAIL ?? ""
export const GDOCS_ARTICLE_DUPLICATION_TEMPLATE_ID: string =
    process.env.GDOCS_ARTICLE_DUPLICATION_TEMPLATE_ID ?? ""
export const GDOCS_DATA_INSIGHT_DUPLICATION_TEMPLATE_ID: string =
    process.env.GDOCS_DATA_INSIGHT_DUPLICATION_TEMPLATE_ID ?? ""
export const GDOCS_DATA_INSIGHT_API_TEMPLATE_ID: string =
    process.env.GDOCS_DATA_INSIGHT_API_TEMPLATE_ID ?? ""

// Link to production wizard.  You need Tailscale to access it in production.
export const ETL_WIZARD_URL: string =
    process.env.ETL_WIZARD_URL ?? `http://${ADMIN_SERVER_HOST}:8053`

// Production ETL API runs on http://etl-prod-2:8083/v1 (you need Tailscale to access it)
export const ETL_API_URL: string =
    process.env.ETL_API_URL ?? `http://${ADMIN_SERVER_HOST}:8081/api/v1`

export const PUBLISHED_AT_FORMAT = "ddd, MMM D, YYYY HH:mm"

/** A map of possible features which can be enabled or disabled. */
export const Features = {
    ExampleFeature: "ExampleFeature",
} as const

type Feature = (typeof Features)[keyof typeof Features]

// process.env.FEATURE_FLAGS is a comma-separated list of flags, and they need
// to be a valid value in the Features object to be considered.
const featureFlagsRaw =
    (typeof process.env.FEATURE_FLAGS === "string" &&
        process.env.FEATURE_FLAGS.trim()?.split(",")) ||
    []
export const FEATURE_FLAGS: Set<Feature> = new Set(
    Object.values(Features).filter((feature) =>
        featureFlagsRaw.includes(feature)
    )
)

export const SLACK_DI_PITCHES_CHANNEL_ID: string =
    process.env.SLACK_DI_PITCHES_CHANNEL_ID ?? ""

export const IS_RUNNING_INSIDE_VITEST: boolean = !!process.env.VITEST

/// Generated properties only, these cannot be overridden directly
// Whether to only enable cookie-less tracking & never show the cookie notice
export const REDUCED_TRACKING = IS_ARCHIVE
export const LOAD_SENTRY = !REDUCED_TRACKING && !IS_RUNNING_INSIDE_VITEST
