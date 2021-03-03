// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import path from "path"
import dotenv from "dotenv"
dotenv.config()

import * as clientSettings from "./clientSettings"

const serverSettings: any = process.env ?? {}

export const BASE_DIR = path.resolve(__dirname, "../..")

export const ADMIN_SERVER_PORT = clientSettings.ADMIN_SERVER_PORT
export const ADMIN_SERVER_HOST = clientSettings.ADMIN_SERVER_HOST
export const BAKED_BASE_URL = clientSettings.BAKED_BASE_URL

export const ADMIN_BASE_URL = clientSettings.ADMIN_BASE_URL
export const WORDPRESS_URL = clientSettings.WORDPRESS_URL

export const BAKED_GRAPHER_URL =
    serverSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const OPTIMIZE_SVG_EXPORTS = serverSettings.OPTIMIZE_SVG_EXPORTS ?? false

export const GITHUB_USERNAME = serverSettings.GITHUB_USERNAME ?? "owid-test"
export const GIT_DEFAULT_USERNAME =
    serverSettings.GIT_DEFAULT_USERNAME ?? "Our World in Data"
export const GIT_DEFAULT_EMAIL =
    serverSettings.GIT_DEFAULT_EMAIL ?? "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE = serverSettings.BLOG_POSTS_PER_PAGE ?? 21
export const BLOG_SLUG = serverSettings.BLOG_SLUG ?? "blog"

export const DB_NAME = serverSettings.DB_NAME ?? "owid"
export const DB_USER = serverSettings.DB_USER ?? "root"
export const DB_PASS = serverSettings.DB_PASS ?? ""
export const DB_HOST = serverSettings.DB_HOST ?? "localhost"
export const DB_PORT = serverSettings.DB_PORT ?? 3306

export const ENV = serverSettings.ENV ?? "development"
export const BAKED_SITE_DIR =
    serverSettings.BAKED_SITE_DIR ?? `${BASE_DIR}/bakedSite` // Where the static build output goes
export const SECRET_KEY =
    serverSettings.SECRET_KEY ??
    "fejwiaof jewiafo jeioa fjieowajf isa fjidosajfgj"
export const WORDPRESS_DB_NAME = serverSettings.WORDPRESS_DB_NAME ?? DB_NAME
export const WORDPRESS_DB_USER = serverSettings.WORDPRESS_DB_USER ?? DB_USER
export const WORDPRESS_DB_PASS = serverSettings.WORDPRESS_DB_PASS ?? DB_PASS
export const WORDPRESS_DB_HOST = serverSettings.WORDPRESS_DB_HOST ?? DB_HOST
export const WORDPRESS_DB_PORT = serverSettings.WORDPRESS_DB_PORT ?? DB_PORT
export const WORDPRESS_API_USER = serverSettings.WORDPRESS_API_USER ?? ""
export const WORDPRESS_API_PASS = serverSettings.WORDPRESS_API_PASS ?? ""
export const SESSION_COOKIE_AGE = serverSettings.SESSION_COOKIE_AGE ?? 1209600
export const ALGOLIA_SECRET_KEY = serverSettings.ALGOLIA_SECRET_KEY ?? ""
export const STRIPE_SECRET_KEY = serverSettings.STRIPE_SECRET_KEY ?? ""

// Settings for automated email sending, e.g. for admin invite
export const EMAIL_HOST = serverSettings.EMAIL_HOST ?? "smtp.mail.com"
export const EMAIL_PORT = serverSettings.EMAIL_PORT ?? 443
export const EMAIL_HOST_USER = serverSettings.EMAIL_HOST_USER ?? "user"
export const EMAIL_HOST_PASSWORD =
    serverSettings.EMAIL_HOST_PASSWORD ?? "password"

// Wordpress target setting
export const WORDPRESS_DIR = serverSettings.WORDPRESS_DIR ?? ""
export const HTTPS_ONLY = serverSettings.HTTPS_ONLY ?? true

// Node slack webhook to report errors to using express-error-slac
export const SLACK_ERRORS_WEBHOOK_URL =
    serverSettings.SLACK_ERRORS_WEBHOOK_URL ?? ""
export const GIT_DATASETS_DIR =
    serverSettings.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR = serverSettings.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID = serverSettings.UNCATEGORIZED_TAG_ID ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE = serverSettings.BAKE_ON_CHANGE ?? false
export const DEPLOY_QUEUE_FILE_PATH =
    serverSettings.DEPLOY_QUEUE_FILE_PATH ?? `${BASE_DIR}/.queue`
export const DEPLOY_PENDING_FILE_PATH =
    serverSettings.DEPLOY_PENDING_FILE_PATH ?? `${BASE_DIR}/.pending`
export const CLOUDFLARE_AUD = serverSettings.CLOUDFLARE_AUD ?? ""
