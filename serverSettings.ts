// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import { ENV } from "settings"
import * as path from "path"
import { parseBool } from "utils/string"

function expect(key: string): string {
    const val = process.env[key]
    if (val === undefined) {
        throw new Error(`OWID requires an environment variable for ${key}`)
    } else {
        return val
    }
}

export const BASE_DIR: string = __dirname
export const SECRET_KEY: string =
    ENV === "production" ? expect("SECRET_KEY") : "not a very secret key at all"
export const SESSION_COOKIE_AGE: number = process.env.SESSION_COOKIE_AGE
    ? parseInt(process.env.SESSION_COOKIE_AGE)
    : 1209600
export const ALGOLIA_SECRET_KEY: string = process.env.ALGOLIA_SECRET_KEY || ""
export const STRIPE_SECRET_KEY: string = process.env.STRIPE_SECRET_KEY || ""

// Grapher database settings
export const DB_NAME: string = process.env.DB_NAME || ""
export const DB_USER: string = process.env.DB_USER || "root"
export const DB_PASS: string = process.env.DB_PASS || ""
export const DB_HOST: string = process.env.DB_HOST || "localhost"
export const DB_PORT: number = process.env.DB_PORT
    ? parseInt(process.env.DB_PORT)
    : 3306

// Wordpress database settings
export const WORDPRESS_DB_NAME: string =
    process.env.WORDPRESS_DB_NAME || process.env.DB_NAME || ""
export const WORDPRESS_DB_USER: string =
    process.env.WORDPRESS_DB_USER || process.env.DB_USER || "root"
export const WORDPRESS_DB_PASS: string =
    process.env.WORDPRESS_DB_PASS || process.env.DB_PASS || ""
export const WORDPRESS_DB_HOST: string =
    process.env.WORDPRESS_DB_HOST || process.env.DB_HOST || "localhost"
export const WORDPRESS_DB_PORT: number = process.env.WORDPRESS_DB_PORT
    ? parseInt(process.env.WORDPRESS_DB_PORT)
    : process.env.DB_PORT
    ? parseInt(process.env.DB_PORT)
    : 3306
export const WORDPRESS_API_USER: string = process.env.WORDPRESS_API_USER || ""
export const WORDPRESS_API_PASS: string = process.env.WORDPRESS_API_PASS || ""

// Where the static build output goes
export const BAKED_SITE_DIR: string =
    process.env.BAKED_SITE_DIR || path.join(BASE_DIR, "bakedSite")
export const WEBPACK_OUTPUT_PATH: string =
    process.env.WEBPACK_OUTPUT_PATH || path.join(BASE_DIR, "dist/webpack")

// Settings for automated email sending, e.g. for admin invites
export const EMAIL_HOST: string = process.env.EMAIL_HOST || "smtp.mail.com"
export const EMAIL_PORT: number = process.env.EMAIL_PORT
    ? parseInt(process.env.EMAIL_PORT)
    : 443
export const EMAIL_HOST_USER: string = process.env.EMAIL_HOST_USER || "user"
export const EMAIL_HOST_PASSWORD: string =
    process.env.EMAIL_HOST_PASSWORD || "password"

// Wordpress target settings
export const WORDPRESS_DIR: string = process.env.WORDPRESS_DIR || ""
export const HTTPS_ONLY: boolean = true

// Node slack webhook to report errors to using express-error-slack
export const SLACK_ERRORS_WEBHOOK_URL: string =
    process.env.SLACK_ERRORS_WEBHOOK_URL || ""

// Where the git exports go
export const GIT_DATASETS_DIR: string =
    process.env.GIT_DATASETS_DIR || path.join(BASE_DIR, "datasetsExport")
export const TMP_DIR: string = process.env.TMP_DIR || "/tmp"

export const UNCATEGORIZED_TAG_ID: number = process.env.UNCATEGORIZED_TAG_ID
    ? parseInt(process.env.UNCATEGORIZED_TAG_ID as any)
    : 375

// Should the static site output be baked when relevant database items change?
export const BAKE_ON_CHANGE: boolean = process.env.BAKE_ON_CHANGE
    ? parseBool(process.env.BAKE_ON_CHANGE)
    : ENV === "production"
    ? true
    : false

// Deploy queue settings
export const DEPLOY_QUEUE_FILE_PATH =
    process.env.DEPLOY_QUEUE_FILE_PATH || path.join(BASE_DIR, "./.queue")
export const DEPLOY_PENDING_FILE_PATH =
    process.env.DEPLOY_PENDING_FILE_PATH || path.join(BASE_DIR, "./.pending")

export const CLOUDFLARE_AUD = process.env.CLOUDFLARE_AUD || ""
