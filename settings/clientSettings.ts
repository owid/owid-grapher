export abstract class ClientSettings<T extends Record<string, PrimitiveType>> {
    defaults: T
    private settingsObj: Partial<T>

    constructor(defaults: T, settingsObject: Record<string, unknown>) {
        this.defaults = defaults
        this.settingsObj = this.prune(settingsObject)
    }

    // In comes an unsanitized settings object, which may contain secret serverSettings that we absolutely don't want to expose to the client.
    prune(settings: Record<string, unknown>): Partial<T> {
        const picked = pick(settings, Object.keys(this.defaults))
        for (const key in picked) {
            const actualType = typeof picked[key]
            const expectedType = typeof this.defaults[key]
            if (actualType !== expectedType) {
                if (expectedType === "string") picked[key] = String(picked[key])
                else if (expectedType === "number") {
                    picked[key] = Number(picked[key])
                    if (Number.isNaN(picked[key]))
                        throw new Error(
                            `Expected setting ${key} to be a number, but got "${settings[key]}"`
                        )
                } else if (expectedType === "boolean")
                    picked[key] = picked[key] === "true"
            }
        }
        return picked as Partial<T>
    }

    toMergedObject(): T {
        return {
            ...this.defaults,
            ...this.settingsObj,
        }
    }

    toSparseJsonString(): string {
        return JSON.stringify(this.settingsObj)
    }
}

// ----

// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O
// Settings in here will be made available to the client-side code that is
// bundled and shipped out to our users.

import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"

const baseDir = findBaseDir(__dirname)
if (baseDir) dotenv.config({ path: `${baseDir}/.env` })

import { parseIntOrUndefined, PrimitiveType, pick } from "@ourworldindata/utils"

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
export const ADMIN_BASE_URL: string =
    process.env.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string = process.env.WORDPRESS_URL ?? ""

export const ALGOLIA_ID: string = process.env.ALGOLIA_ID ?? ""
export const ALGOLIA_SEARCH_KEY: string = process.env.ALGOLIA_SEARCH_KEY ?? ""

export const STRIPE_PUBLIC_KEY: string =
    process.env.STRIPE_PUBLIC_KEY ?? "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    process.env.DONATE_API_URL ?? "http://localhost:9000/donate"

export const RECAPTCHA_SITE_KEY: string =
    process.env.RECAPTCHA_SITE_KEY ?? "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

export const TOPICS_CONTENT_GRAPH: boolean =
    process.env.TOPICS_CONTENT_GRAPH === "true" ?? false

export const GDOCS_CLIENT_EMAIL: string = process.env.GDOCS_CLIENT_EMAIL ?? ""
export const GDOCS_BASIC_ARTICLE_TEMPLATE_URL: string =
    process.env.GDOCS_BASIC_ARTICLE_TEMPLATE_URL ?? ""

// Fast-track settings, by default points to staging version. You need Tailscale to access it.
export const FASTTRACK_URL: string =
    process.env.FASTTRACK_URL ?? "http://owid-analytics:8083/"
