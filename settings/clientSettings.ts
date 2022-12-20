// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O
// Settings in here will be made available to the client-side code that is
// bundled and shipped out to our users.

// import dotenv from "dotenv"
// import findBaseDir from "./findBaseDir.js"

// const baseDir = findBaseDir(__dirname)
// if (baseDir) dotenv.config({ path: `${baseDir}/.env` })

import { parseIntOrUndefined } from "@ourworldindata/utils"

import * as env from "env"

// let process
// if (typeof process === "undefined") process = { env } as any

export const ENV: "development" | "production" =
    env.ENV === "production" ? "production" : "development"

export const BUGSNAG_API_KEY: string | undefined = env.BUGSNAG_API_KEY
export const ADMIN_SERVER_PORT: number =
    parseIntOrUndefined(env.ADMIN_SERVER_PORT) ?? 3030
export const ADMIN_SERVER_HOST: string = env.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    env.BAKED_BASE_URL ?? `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL: string =
    env.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const BAKED_GRAPHER_EXPORTS_BASE_URL: string =
    env.BAKED_GRAPHER_EXPORTS_BASE_URL ?? `${BAKED_GRAPHER_URL}/exports`
export const ADMIN_BASE_URL: string =
    env.ADMIN_BASE_URL ?? `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string = env.WORDPRESS_URL ?? ""

export const ALGOLIA_ID: string = env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string = env.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY: string =
    env.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    env.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY: string =
    env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

export const TOPICS_CONTENT_GRAPH: boolean =
    env.TOPICS_CONTENT_GRAPH === "true" ?? false

export const GDOCS_CLIENT_EMAIL: string = env.GDOCS_CLIENT_EMAIL ?? ""
export const GDOCS_BASIC_ARTICLE_TEMPLATE_URL: string =
    env.GDOCS_BASIC_ARTICLE_TEMPLATE_URL ?? ""
