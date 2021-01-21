// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import fs from "fs-extra"
import path from "path"

export const BASE_DIR = path.resolve(__dirname, "../..")
const absoluteSettingsPath = path.resolve(BASE_DIR, "serverSettings.json")
const localOverrides: any = fs.existsSync(absoluteSettingsPath)
    ? fs.readJsonSync(absoluteSettingsPath)
    : {}

export const ADMIN_SERVER_PORT = localOverrides.ADMIN_SERVER_PORT ?? 3030
export const ADMIN_SERVER_HOST = localOverrides.ADMIN_SERVER_HOST ?? "localhost"
export const BAKED_BASE_URL =
    localOverrides.BAKED_BASE_URL ??
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`

export const DB_NAME = localOverrides.DB_NAME ?? "owid"
export const DB_USER = localOverrides.DB_USER ?? "root"
export const DB_PASS = localOverrides.DB_PASS ?? ""
export const DB_HOST = localOverrides.DB_HOST ?? "localhost"
export const DB_PORT = localOverrides.DB_PORT ?? 3306

export const ENV = localOverrides.ENV ?? "development"
export const BAKED_SITE_DIR =
    localOverrides.BAKED_SITE_DIR ?? `${BASE_DIR}/bakedSite` // Where the static build output goes
export const SECRET_KEY =
    localOverrides.SECRET_KEY ??
    "fejwiaof jewiafo jeioa fjieowajf isa fjidosajfgj"
export const WORDPRESS_DB_NAME = localOverrides.WORDPRESS_DB_NAME ?? DB_NAME
export const WORDPRESS_DB_USER = localOverrides.WORDPRESS_DB_USER ?? DB_USER
export const WORDPRESS_DB_PASS = localOverrides.WORDPRESS_DB_PASS ?? DB_PASS
export const WORDPRESS_DB_HOST = localOverrides.WORDPRESS_DB_HOST ?? DB_HOST
export const WORDPRESS_DB_PORT = localOverrides.WORDPRESS_DB_PORT ?? DB_PORT
export const WORDPRESS_API_USER = localOverrides.WORDPRESS_API_USER ?? ""
export const WORDPRESS_API_PASS = localOverrides.WORDPRESS_API_PASS ?? ""
export const SESSION_COOKIE_AGE = localOverrides.SESSION_COOKIE_AGE ?? 1209600
export const ALGOLIA_SECRET_KEY = localOverrides.ALGOLIA_SECRET_KEY ?? ""
export const STRIPE_SECRET_KEY = localOverrides.STRIPE_SECRET_KEY ?? ""

// Settings for automated email sending, e.g. for admin invite
export const EMAIL_HOST = localOverrides.EMAIL_HOST ?? "smtp.mail.com"
export const EMAIL_PORT = localOverrides.EMAIL_PORT ?? 443
export const EMAIL_HOST_USER = localOverrides.EMAIL_HOST_USER ?? "user"
export const EMAIL_HOST_PASSWORD =
    localOverrides.EMAIL_HOST_PASSWORD ?? "password"

// Wordpress target setting
export const WORDPRESS_DIR = localOverrides.WORDPRESS_DIR ?? ""
export const HTTPS_ONLY = localOverrides.HTTPS_ONLY ?? true

// Node slack webhook to report errors to using express-error-slac
export const SLACK_ERRORS_WEBHOOK_URL =
    localOverrides.SLACK_ERRORS_WEBHOOK_URL ?? ""
export const GIT_DATASETS_DIR =
    localOverrides.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR = localOverrides.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID = localOverrides.UNCATEGORIZED_TAG_ID ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE = localOverrides.BAKE_ON_CHANGE ?? false
export const DEPLOY_QUEUE_FILE_PATH =
    localOverrides.DEPLOY_QUEUE_FILE_PATH ?? `${BASE_DIR}/.queue`
export const DEPLOY_PENDING_FILE_PATH =
    localOverrides.DEPLOY_PENDING_FILE_PATH ?? `${BASE_DIR}/.pending`
export const CLOUDFLARE_AUD = localOverrides.CLOUDFLARE_AUD ?? ""
