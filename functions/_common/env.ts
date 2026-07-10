export interface Env {
    ASSETS: Fetcher
    url: URL
    GRAPHER_CONFIG_R2_BUCKET?: R2Bucket
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK?: R2Bucket
    GRAPHER_CONFIG_R2_BUCKET_PATH?: string
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH?: string
    MAILGUN_SENDING_KEY: string
    MAILGUN_DOMAIN: string
    MAILCHIMP_API_KEY: string
    MAILCHIMP_API_SERVER: string
    MAILCHIMP_DONOR_LIST_ID: string
    MAILCHIMP_NEWSLETTER_LIST_ID?: string
    MAILCHIMP_OWID_BRIEF_INTEREST_ID?: string
    // Postmark server API token used to send the email notifications
    // welcome emails. If unset, sending is skipped (useful for local
    // development).
    POSTMARK_SERVER_TOKEN?: string
    // Override for Postmark's API base URL. Point it at the local Postmark
    // catcher (yarn postmarkCatcher) to inspect emails during development
    // without sending anything.
    POSTMARK_API_BASE_URL?: string
    EMAIL_NOTIFICATIONS_DB?: D1Database
    // Cloudflare rate limiting binding. Not configurable for Pages projects
    // (only Workers), so it's currently always undefined; until we migrate to
    // Workers, rate limiting of the email notifications API is done with a
    // zone-level WAF rate limiting rule instead.
    EMAIL_NOTIFICATIONS_RATE_LIMITER?: RateLimit
    CF_PAGES_BRANCH: string
    CLOUDFLARE_IMAGES_API_KEY: string
    CLOUDFLARE_IMAGES_URL: string
    CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_PROTOCOL_KEY: string
    CLOUDFLARE_GOOGLE_ANALYTICS_MEASUREMENT_ID: string
    CLOUDFLARE_GOOGLE_ANALYTICS_SAMPLING_RATE: string
    ENV: string
    DATA_API_URL_COMPLETE?: string
    DATA_API_URL_PARTIAL_PREFIX?: string
    DATA_API_URL_PARTIAL_POSTFIX?: string
    SENTRY_DSN: string
    SLACK_BOT_OAUTH_TOKEN?: string
    SLACK_ERROR_CHANNEL_ID?: string
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_API_KEY: string
    TURNSTILE_SECRET_KEY: string
    ALGOLIA_ID: string
    ALGOLIA_SEARCH_KEY: string
    ALGOLIA_INDEX_PREFIX?: string
    CATALOG_URL: string
    USER_SURVEYS_R2?: R2Bucket
}
// We collect the possible extensions here so we can easily take them into account
// when handling redirects
export const extensions = {
    configJson: ".config.json",
    png: ".png",
    svg: ".svg",
    csv: ".csv",
    metadata: ".metadata.json",
    readme: ".readme.md",
    zip: ".zip",
    values: ".values.json",
    searchResult: ".search-result.json",
}
export type Etag = string
