// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O
// Settings in here will be made available to the client-side code that is
// bundled and shipped out to our users.

import dotenv from "dotenv"
import fs from "fs"

// only run the below code if we're in a node environment
if (fs.statSync !== undefined) {
    const pkgDir = require("pkg-dir")

    const baseDir = pkgDir.sync(__dirname)
    if (baseDir === undefined)
        throw new Error("could not locate base package.json")

    dotenv.config({ path: `${baseDir}/.env` })
}

import { parseIntOrUndefined } from "../clientUtils/Util"

export const ENV: "development" | "production" =
    process.env.ENV === "production" ? "production" : "development"

export const ADMIN_SERVER_PORT: number =
    parseIntOrUndefined(process.env.ADMIN_SERVER_PORT) ?? 3030
export const ADMIN_SERVER_HOST: string =
    process.env.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    process.env.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL: string =
    process.env.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL: string =
    process.env.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string =
    process.env.WORDPRESS_URL ?? "https://owid.cloud"

export const ALGOLIA_ID: string = process.env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string = process.env.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY: string =
    process.env.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    process.env.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY: string =
    process.env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"
