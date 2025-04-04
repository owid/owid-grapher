export interface Env {
    ASSETS: Fetcher
    url: URL
    GRAPHER_CONFIG_R2_BUCKET_URL: string
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK_URL: string
    GRAPHER_CONFIG_R2_BUCKET_PATH: string
    GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH: string
    MAILGUN_SENDING_KEY: string
    MAILGUN_DOMAIN: string
    MAILCHIMP_API_KEY: string
    MAILCHIMP_API_SERVER: string
    MAILCHIMP_DONOR_LIST_ID: string
    CF_PAGES_BRANCH: string
    CLOUDFLARE_IMAGES_API_KEY: string
    CLOUDFLARE_IMAGES_URL: string
    ENV: string
    SENTRY_DSN: string
    SLACK_BOT_OAUTH_TOKEN?: string
    SLACK_ERROR_CHANNEL_ID?: string
    STRIPE_WEBHOOK_SECRET: string
    STRIPE_API_KEY: string
    RECAPTCHA_SECRET_KEY: string
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
}
export type Etag = string
