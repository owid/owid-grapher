// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O

// webpack is configured to provide our clientSettings as `process.env.clientSettings`
// (through DefinePlugin), so we can just use these here, and fall back to the defaults
// if a setting is not set in clientSettings.json
const clientSettings: any = process.env.clientSettings ?? {}

export const ADMIN_SERVER_PORT: number =
    clientSettings.ADMIN_SERVER_PORT ?? 3030
export const ADMIN_SERVER_HOST: string =
    clientSettings.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    clientSettings.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const ENV: string = clientSettings.ENV ?? "development"
export const BAKED_GRAPHER_URL: string =
    clientSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL: string =
    clientSettings.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string =
    clientSettings.WORDPRESS_URL ?? "https://owid.cloud"

export const ALGOLIA_ID: string = clientSettings.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string =
    clientSettings.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY: string =
    clientSettings.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    clientSettings.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY: string =
    clientSettings.RECAPTCHA_SITE_KEY ??
    "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"
export const OPTIMIZE_SVG_EXPORTS: boolean =
    clientSettings.OPTIMIZE_SVG_EXPORTS ?? false
