// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O
// Settings in here will be made available to the client-side code that is
// bundled and shipped out to our users.

import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"

if (typeof __dirname !== "undefined") {
    // only run this code in node, not in the browser.
    // in the browser, process.env is already populated by vite.
    const baseDir = findBaseDir(__dirname)
    if (baseDir) dotenv.config({ path: `${baseDir}/.env` })
}

import { parseIntOrUndefined } from "@ourworldindata/utils"

export const ENV: "development" | "production" =
    process.env.ENV === "production" ? "production" : "development"

export const BUGSNAG_API_KEY: string | undefined = process.env.BUGSNAG_API_KEY
export const ADMIN_SERVER_PORT: number =
    parseIntOrUndefined(process.env.ADMIN_SERVER_PORT) ?? 3030
export const ADMIN_SERVER_HOST: string =
    process.env.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    process.env.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL: string =
    process.env.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const BAKED_GRAPHER_EXPORTS_BASE_URL: string =
    process.env.BAKED_GRAPHER_EXPORTS_BASE_URL ?? `${BAKED_GRAPHER_URL}/exports`
export const BAKED_SITE_EXPORTS_BASE_URL: string =
    process.env.BAKED_SITE_EXPORTS_BASE_URL ?? `${BAKED_BASE_URL}/exports`

export const ADMIN_BASE_URL: string =
    process.env.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
// e.g. "https://api.ourworldindata.org/v1/indicators/" or "https://api-staging.owid.io/user/v1/indicators/"
export const DATA_API_URL: string =
    process.env.DATA_API_URL ?? "https://api.ourworldindata.org/v1/indicators/"
export const WORDPRESS_URL: string = process.env.WORDPRESS_URL ?? ""

export const ALGOLIA_ID: string = process.env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string = process.env.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY: string =
    process.env.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    process.env.DONATE_API_URL ?? "http://localhost:8788/donate/donate"

export const RECAPTCHA_SITE_KEY: string =
    process.env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

// e.g. "GTM-N2D4V8S" (our production GTM container)
export const GOOGLE_TAG_MANAGER_ID: string =
    process.env.GOOGLE_TAG_MANAGER_ID ?? ""

export const TOPICS_CONTENT_GRAPH: boolean =
    process.env.TOPICS_CONTENT_GRAPH === "true" ?? false

export const GDOCS_CLIENT_EMAIL: string = process.env.GDOCS_CLIENT_EMAIL ?? ""
export const GDOCS_BASIC_ARTICLE_TEMPLATE_URL: string =
    process.env.GDOCS_BASIC_ARTICLE_TEMPLATE_URL ?? ""

export const IMAGE_HOSTING_SPACE_URL: string =
    process.env.IMAGE_HOSTING_SPACE_URL || ""
export const IMAGE_HOSTING_CDN_URL: string =
    process.env.IMAGE_HOSTING_CDN_URL || ""
// e.g. owid-image-hosting/development
export const IMAGE_HOSTING_BUCKET_PATH: string =
    process.env.IMAGE_HOSTING_BUCKET_PATH || ""
// e.g. development
export const IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH: string =
    IMAGE_HOSTING_BUCKET_PATH.slice(IMAGE_HOSTING_BUCKET_PATH.indexOf("/") + 1)

// Fast-track settings, by default points to staging version. You need Tailscale to access it.
export const FASTTRACK_URL: string =
    process.env.FASTTRACK_URL ?? "http://owid-analytics:8083/"

export const GDOCS_DETAILS_ON_DEMAND_ID: string =
    process.env.GDOCS_DETAILS_ON_DEMAND_ID ?? ""
