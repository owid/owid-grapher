// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O

// webpack is configured to provide our clientSettings as `process.env.clientSettings`
// (through DefinePlugin), so we can just use these here, and fall back to the defaults
// if a setting is not set in clientSettings.json
const clientSettings: any = process.env.clientSettings ?? {}

export const ADMIN_SERVER_PORT = clientSettings.ADMIN_SERVER_PORT ?? 3030
export const ADMIN_SERVER_HOST = clientSettings.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL =
    clientSettings.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const ENV = clientSettings.ENV ?? "development"
export const BAKED_GRAPHER_URL =
    clientSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL =
    clientSettings.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL =
    clientSettings.WORDPRESS_URL ?? "https://owid.cloud"

export const GRAPHER_VERSION = clientSettings.GRAPHER_VERSION ?? "1.0.0" // Ideally the Git hash
export const GITHUB_USERNAME = clientSettings.GITHUB_USERNAME ?? "owid-test"
export const GIT_DEFAULT_USERNAME =
    clientSettings.GIT_DEFAULT_USERNAME ?? "Our World in Data"
export const GIT_DEFAULT_EMAIL =
    clientSettings.GIT_DEFAULT_EMAIL ?? "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE = clientSettings.BLOG_POSTS_PER_PAGE ?? 21
export const BLOG_SLUG = clientSettings.BLOG_SLUG ?? "blog"

export const ALGOLIA_ID = clientSettings.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY = clientSettings.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY =
    clientSettings.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL =
    clientSettings.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY =
    clientSettings.RECAPTCHA_SITE_KEY ??
    "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"
export const OPTIMIZE_SVG_EXPORTS = clientSettings.OPTIMIZE_SVG_EXPORTS ?? false
