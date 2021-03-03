// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O

// webpack is configured to provide our clientSettings as `process.env.clientSettings`
// (through DefinePlugin), so we can just use these here, and fall back to the defaults
// if a setting is not set in clientSettings.json

import dotenv from "dotenv"
dotenv.config()

export const ENV = process.env.ENV ?? "development"

export const ADMIN_SERVER_PORT = process.env.ADMIN_SERVER_PORT ?? 3030
export const ADMIN_SERVER_HOST = process.env.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL =
    process.env.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL =
    process.env.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL =
    process.env.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL = process.env.WORDPRESS_URL ?? "https://owid.cloud"

export const ALGOLIA_ID = process.env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY = process.env.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY =
    process.env.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL =
    process.env.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY =
    process.env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"
export const OPTIMIZE_SVG_EXPORTS = process.env.OPTIMIZE_SVG_EXPORTS ?? false
