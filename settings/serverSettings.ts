// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import fs from "fs-extra"
import path from "path"

export const BASE_DIR = path.resolve(__dirname, "../..")
const absoluteSettingsPath = path.resolve(BASE_DIR, "serverSettings.json")
const localOverrides: any = fs.existsSync(absoluteSettingsPath)
    ? fs.readJsonSync(absoluteSettingsPath)
    : {}

export const ADMIN_SERVER_PORT: number =
    localOverrides.ADMIN_SERVER_PORT ?? 3030
export const ADMIN_SERVER_HOST: string =
    localOverrides.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL: string =
    localOverrides.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const BAKED_GRAPHER_URL: string =
    localOverrides.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const ADMIN_BASE_URL: string =
    localOverrides.ADMIN_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const WORDPRESS_URL: string =
    localOverrides.WORDPRESS_URL ?? "https://owid.cloud"

export const ALGOLIA_ID: string = localOverrides.ALGOLIA_ID ?? ""

export const RECAPTCHA_SITE_KEY: string =
    localOverrides.RECAPTCHA_SITE_KEY ??
    "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

export const OPTIMIZE_SVG_EXPORTS: boolean =
    localOverrides.OPTIMIZE_SVG_EXPORTS ?? false

export const GITHUB_USERNAME: string =
    localOverrides.GITHUB_USERNAME ?? "owid-test"
export const GIT_DEFAULT_USERNAME: string =
    localOverrides.GIT_DEFAULT_USERNAME ?? "Our World in Data"
export const GIT_DEFAULT_EMAIL: string =
    localOverrides.GIT_DEFAULT_EMAIL ?? "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE: number =
    localOverrides.BLOG_POSTS_PER_PAGE ?? 21
export const BLOG_SLUG: string = localOverrides.BLOG_SLUG ?? "blog"

export const DB_NAME: string = localOverrides.DB_NAME ?? "owid"
export const DB_USER: string = localOverrides.DB_USER ?? "root"
export const DB_PASS: string = localOverrides.DB_PASS ?? ""
export const DB_HOST: string = localOverrides.DB_HOST ?? "localhost"
export const DB_PORT: number = localOverrides.DB_PORT ?? 3306

export const ENV: string = localOverrides.ENV ?? "development"
export const BAKED_SITE_DIR: string =
    localOverrides.BAKED_SITE_DIR ?? `${BASE_DIR}/bakedSite` // Where the static build output goes
export const SECRET_KEY: string =
    localOverrides.SECRET_KEY ??
    "fejwiaof jewiafo jeioa fjieowajf isa fjidosajfgj"
export const WORDPRESS_DB_NAME: string =
    localOverrides.WORDPRESS_DB_NAME ?? DB_NAME
export const WORDPRESS_DB_USER: string =
    localOverrides.WORDPRESS_DB_USER ?? DB_USER
export const WORDPRESS_DB_PASS: string =
    localOverrides.WORDPRESS_DB_PASS ?? DB_PASS
export const WORDPRESS_DB_HOST: string =
    localOverrides.WORDPRESS_DB_HOST ?? DB_HOST
export const WORDPRESS_DB_PORT: number =
    localOverrides.WORDPRESS_DB_PORT ?? DB_PORT
export const WORDPRESS_API_USER: string =
    localOverrides.WORDPRESS_API_USER ?? ""
export const WORDPRESS_API_PASS: string =
    localOverrides.WORDPRESS_API_PASS ?? ""
export const SESSION_COOKIE_AGE: number =
    localOverrides.SESSION_COOKIE_AGE ?? 1209600
export const ALGOLIA_SECRET_KEY: string =
    localOverrides.ALGOLIA_SECRET_KEY ?? ""
export const STRIPE_SECRET_KEY: string = localOverrides.STRIPE_SECRET_KEY ?? ""

// Settings for automated email sending, e.g. for admin invite
export const EMAIL_HOST: string = localOverrides.EMAIL_HOST ?? "smtp.mail.com"
export const EMAIL_PORT: number = localOverrides.EMAIL_PORT ?? 443
export const EMAIL_HOST_USER: string = localOverrides.EMAIL_HOST_USER ?? "user"
export const EMAIL_HOST_PASSWORD: string =
    localOverrides.EMAIL_HOST_PASSWORD ?? "password"

// Wordpress target setting
export const WORDPRESS_DIR: string = localOverrides.WORDPRESS_DIR ?? ""
export const HTTPS_ONLY: boolean = localOverrides.HTTPS_ONLY ?? true

// Node slack webhook to report errors to using express-error-slac
export const SLACK_ERRORS_WEBHOOK_URL: string =
    localOverrides.SLACK_ERRORS_WEBHOOK_URL ?? ""
export const GIT_DATASETS_DIR: string =
    localOverrides.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR: string = localOverrides.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID: number =
    localOverrides.UNCATEGORIZED_TAG_ID ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE: boolean = localOverrides.BAKE_ON_CHANGE ?? false
export const DEPLOY_QUEUE_FILE_PATH: string =
    localOverrides.DEPLOY_QUEUE_FILE_PATH ?? `${BASE_DIR}/.queue`
export const DEPLOY_PENDING_FILE_PATH: string =
    localOverrides.DEPLOY_PENDING_FILE_PATH ?? `${BASE_DIR}/.pending`
export const CLOUDFLARE_AUD: string = localOverrides.CLOUDFLARE_AUD ?? ""
