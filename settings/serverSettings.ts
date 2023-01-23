// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import path from "path"
import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"

const baseDir = findBaseDir(__dirname)
if (baseDir === undefined) throw new Error("could not locate base package.json")

dotenv.config({ path: `${baseDir}/.env` })

import * as clientSettings from "./clientSettings.js"
import { parseIntOrUndefined } from "@ourworldindata/utils"

const serverSettings = process.env ?? {}

export const BASE_DIR: string = baseDir
export const ENV: "development" | "production" = clientSettings.ENV

export const ADMIN_SERVER_PORT: number = clientSettings.ADMIN_SERVER_PORT
export const ADMIN_SERVER_HOST: string = clientSettings.ADMIN_SERVER_HOST
export const DATA_API_FOR_ADMIN_UI: string | undefined =
    serverSettings.DATA_API_FOR_ADMIN_UI
export const DATA_API_FOR_BAKING: string | undefined =
    serverSettings.DATA_API_FOR_BAKING
export const BAKED_BASE_URL: string = clientSettings.BAKED_BASE_URL

export const ADMIN_BASE_URL: string = clientSettings.ADMIN_BASE_URL
export const WORDPRESS_URL: string = clientSettings.WORDPRESS_URL

export const BAKED_GRAPHER_URL: string =
    serverSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const OPTIMIZE_SVG_EXPORTS: boolean =
    serverSettings.OPTIMIZE_SVG_EXPORTS === "true" ?? false

export const GITHUB_USERNAME: string =
    serverSettings.GITHUB_USERNAME ?? "owid-test"
export const GIT_DEFAULT_USERNAME: string =
    serverSettings.GIT_DEFAULT_USERNAME ?? "Our World in Data"
export const GIT_DEFAULT_EMAIL: string =
    serverSettings.GIT_DEFAULT_EMAIL ?? "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE: number =
    parseIntOrUndefined(serverSettings.BLOG_POSTS_PER_PAGE) ?? 21
export const BLOG_SLUG: string = serverSettings.BLOG_SLUG ?? "blog"

export const GRAPHER_DB_NAME: string = serverSettings.GRAPHER_DB_NAME ?? "owid"
export const GRAPHER_DB_USER: string = serverSettings.GRAPHER_DB_USER ?? "root"
export const GRAPHER_DB_PASS: string = serverSettings.GRAPHER_DB_PASS ?? ""
export const GRAPHER_DB_HOST: string =
    serverSettings.GRAPHER_DB_HOST ?? "localhost"
// The OWID stack uses 3307, but incase it's unset, assume user is running a local setup
export const GRAPHER_DB_PORT: number =
    parseIntOrUndefined(serverSettings.GRAPHER_DB_PORT) ?? 3306

export const BAKED_SITE_DIR: string =
    serverSettings.BAKED_SITE_DIR ?? path.resolve(BASE_DIR, "bakedSite") // Where the static build output goes
export const SECRET_KEY: string =
    serverSettings.SECRET_KEY ??
    "fejwiaof jewiafo jeioa fjieowajf isa fjidosajfgj"
export const WORDPRESS_DB_NAME: string = serverSettings.WORDPRESS_DB_NAME ?? ""
export const WORDPRESS_DB_USER: string = serverSettings.WORDPRESS_DB_USER ?? ""
export const WORDPRESS_DB_PASS: string = serverSettings.WORDPRESS_DB_PASS ?? ""
export const WORDPRESS_DB_HOST: string = serverSettings.WORDPRESS_DB_HOST ?? ""
export const WORDPRESS_DB_PORT: number | undefined = parseIntOrUndefined(
    serverSettings.WORDPRESS_DB_PORT
)
export const WORDPRESS_API_USER: string =
    serverSettings.WORDPRESS_API_USER ?? ""
export const WORDPRESS_API_PASS: string =
    serverSettings.WORDPRESS_API_PASS ?? ""
export const SESSION_COOKIE_AGE: number =
    parseIntOrUndefined(serverSettings.SESSION_COOKIE_AGE) ?? 1209600
export const ALGOLIA_SECRET_KEY: string =
    serverSettings.ALGOLIA_SECRET_KEY ?? ""
export const ALGOLIA_INDEXING: boolean =
    serverSettings.ALGOLIA_INDEXING === "true" ?? false

// Wordpress target setting
export const WORDPRESS_DIR: string = serverSettings.WORDPRESS_DIR ?? "wordpress"
export const HTTPS_ONLY: boolean = serverSettings.HTTPS_ONLY !== "false" ?? true

// Node slack webhook to report errors to using express-error-slack
export const SLACK_ERRORS_WEBHOOK_URL: string | undefined =
    serverSettings.SLACK_ERRORS_WEBHOOK_URL || undefined
export const SLACK_CONTENT_ERRORS_WEBHOOK_URL: string | undefined =
    serverSettings.SLACK_CONTENT_ERRORS_WEBHOOK_URL || undefined
export const GIT_DATASETS_DIR: string =
    serverSettings.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR: string = serverSettings.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID: number =
    parseIntOrUndefined(serverSettings.UNCATEGORIZED_TAG_ID) ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE: boolean =
    serverSettings.BAKE_ON_CHANGE === "true" ?? false
export const MAX_NUM_BAKE_PROCESSES: number = Number.parseInt(
    serverSettings.MAX_NUM_BAKE_PROCESSES ?? "4",
    10
)
export const DEPLOY_QUEUE_FILE_PATH: string =
    serverSettings.DEPLOY_QUEUE_FILE_PATH ?? `${BASE_DIR}/.queue`
export const DEPLOY_PENDING_FILE_PATH: string =
    serverSettings.DEPLOY_PENDING_FILE_PATH ?? `${BASE_DIR}/.pending`
export const CLOUDFLARE_AUD: string = serverSettings.CLOUDFLARE_AUD ?? ""

export const DATA_FILES_CHECKSUMS_DIRECTORY: string =
    serverSettings.DATA_FILES_CHECKSUMS_DIRECTORY ??
    `${BASE_DIR}/data_files_checksums`

// Either remote catalog `https://owid-catalog.nyc3.digitaloceanspaces.com/` or local catalog `.../etl/data/`
// Note that Cloudflare proxy on `https://catalog.ourworldindata.org` does not support range requests yet
// It is empty (turned off) by default for now, in the future it should be
// `https://owid-catalog.nyc3.digitaloceanspaces.com/` by default
export const CATALOG_PATH: string = serverSettings.CATALOG_PATH ?? ""

// make and bash handle spaces in env variables differently.
// no quotes - wait-for-mysql.sh will break: "PRIVATE: command not found"
// quotes - wait-for-mysql.sh will work, but the variable will be double-quoted in node: '"-----BEGIN PRIVATE etc..."'
// escaped spaces - wait-for-mysql.sh will work, but the backslashes will exist in node: "-----BEGIN\ PRIVATE\ etc..."
export const GDOCS_PRIVATE_KEY: string = (
    serverSettings.GDOCS_PRIVATE_KEY ?? ""
)
    .replaceAll('"', "")
    .replaceAll("'", "")
export const GDOCS_CLIENT_EMAIL: string = clientSettings.GDOCS_CLIENT_EMAIL
export const GDOCS_CLIENT_ID: string = serverSettings.GDOCS_CLIENT_ID ?? ""
export const GDOCS_BACKPORTING_TARGET_FOLDER: string =
    serverSettings.GDOCS_BACKPORTING_TARGET_FOLDER ?? ""
