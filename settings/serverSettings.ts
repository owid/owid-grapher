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
export const BAKED_BASE_URL: string = clientSettings.BAKED_BASE_URL

export const VITE_PREVIEW: boolean =
    serverSettings.VITE_PREVIEW === "true" ?? false

export const ADMIN_BASE_URL: string = clientSettings.ADMIN_BASE_URL
export const WORDPRESS_URL: string = clientSettings.WORDPRESS_URL

export const BAKED_GRAPHER_URL: string =
    serverSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const BAKED_WORDPRESS_UPLOADS_URL: string =
    serverSettings.BAKED_WORDPRESS_UPLOADS_URL ?? `${BAKED_BASE_URL}/uploads`

export const OPTIMIZE_SVG_EXPORTS: boolean =
    serverSettings.OPTIMIZE_SVG_EXPORTS === "true" ?? false

export const GITHUB_USERNAME: string =
    serverSettings.GITHUB_USERNAME ?? "owid-test"
export const GIT_DEFAULT_USERNAME: string =
    serverSettings.GIT_DEFAULT_USERNAME ?? "Our World in Data"
export const GIT_DEFAULT_EMAIL: string =
    serverSettings.GIT_DEFAULT_EMAIL ?? "info@ourworldindata.org"

export const BUGSNAG_API_KEY: string | undefined =
    serverSettings.BUGSNAG_API_KEY
export const BUGSNAG_NODE_API_KEY: string | undefined =
    serverSettings.BUGSNAG_NODE_API_KEY

export const BLOG_POSTS_PER_PAGE: number =
    parseIntOrUndefined(serverSettings.BLOG_POSTS_PER_PAGE) ?? 21
export const BLOG_SLUG: string = serverSettings.BLOG_SLUG ?? "latest"

export const GRAPHER_DB_NAME: string = serverSettings.GRAPHER_DB_NAME ?? "owid"
export const GRAPHER_DB_USER: string = serverSettings.GRAPHER_DB_USER ?? "root"
export const GRAPHER_DB_PASS: string = serverSettings.GRAPHER_DB_PASS ?? ""
export const GRAPHER_DB_HOST: string =
    serverSettings.GRAPHER_DB_HOST ?? "localhost"
// The OWID stack uses 3307, but incase it's unset, assume user is running a local setup
export const GRAPHER_DB_PORT: number =
    parseIntOrUndefined(serverSettings.GRAPHER_DB_PORT) ?? 3306

export const GRAPHER_TEST_DB_NAME: string =
    serverSettings.GRAPHER_TEST_DB_NAME ?? "owid"
export const GRAPHER_TEST_DB_USER: string =
    serverSettings.GRAPHER_TEST_DB_USER ?? "root"
export const GRAPHER_TEST_DB_PASS: string =
    serverSettings.GRAPHER_TEST_DB_PASS ?? ""
export const GRAPHER_TEST_DB_HOST: string =
    serverSettings.GRAPHER_TEST_DB_HOST ?? "localhost"
// The OWID stack uses 3307, but incase it's unset, assume user is running a local setup
export const GRAPHER_TEST_DB_PORT: number =
    parseIntOrUndefined(serverSettings.GRAPHER_TEST_DB_PORT) ?? 3306

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

export const GIT_DATASETS_DIR: string =
    serverSettings.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR: string = serverSettings.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID: number =
    parseIntOrUndefined(serverSettings.UNCATEGORIZED_TAG_ID) ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE: boolean =
    serverSettings.BAKE_ON_CHANGE === "true" ?? false
export const DEPLOY_QUEUE_FILE_PATH: string =
    serverSettings.DEPLOY_QUEUE_FILE_PATH ?? `${BASE_DIR}/.queue`
export const DEPLOY_PENDING_FILE_PATH: string =
    serverSettings.DEPLOY_PENDING_FILE_PATH ?? `${BASE_DIR}/.pending`
export const CLOUDFLARE_AUD: string = serverSettings.CLOUDFLARE_AUD ?? ""

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

export const GDOCS_IMAGES_BACKPORTING_TARGET_FOLDER: string =
    serverSettings.GDOCS_IMAGES_BACKPORTING_TARGET_FOLDER ?? ""

export const GDOCS_DONATE_FAQS_DOCUMENT_ID: string =
    serverSettings.GDOCS_DONATE_FAQS_DOCUMENT_ID ??
    "194PNSFjgSlt9Zm5xYuDOF0l_GLKZbVxH2co3zCok_cE"

export const GDOCS_SHARED_DRIVE_ID = serverSettings.GDOCS_SHARED_DRIVE_ID ?? ""

export const GDOCS_DETAILS_ON_DEMAND_ID =
    serverSettings.GDOCS_DETAILS_ON_DEMAND_ID ?? ""

export const IMAGE_HOSTING_SPACE_URL: string =
    serverSettings.IMAGE_HOSTING_SPACE_URL || ""
export const IMAGE_HOSTING_CDN_URL: string =
    serverSettings.IMAGE_HOSTING_CDN_URL || ""
// e.g. owid-image-hosting-staging/development
export const IMAGE_HOSTING_BUCKET_PATH: string =
    serverSettings.IMAGE_HOSTING_BUCKET_PATH || ""
// e.g. development
export const IMAGE_HOSTING_BUCKET_SUBFOLDER_PATH: string =
    IMAGE_HOSTING_BUCKET_PATH.slice(IMAGE_HOSTING_BUCKET_PATH.indexOf("/") + 1)
export const IMAGE_HOSTING_SPACE_ACCESS_KEY_ID: string =
    serverSettings.IMAGE_HOSTING_SPACE_ACCESS_KEY_ID || ""
export const IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY: string =
    serverSettings.IMAGE_HOSTING_SPACE_SECRET_ACCESS_KEY || ""
export const IMAGE_HOSTING_SPACE_REGION: string =
    serverSettings.IMAGE_HOSTING_SPACE_REGION || "auto"

export const DATA_API_URL: string = clientSettings.DATA_API_URL

export const BUILDKITE_API_ACCESS_TOKEN: string =
    serverSettings.BUILDKITE_API_ACCESS_TOKEN ?? ""
export const BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG: string =
    serverSettings.BUILDKITE_DEPLOY_CONTENT_PIPELINE_SLUG ||
    "owid-deploy-content-master"
export const BUILDKITE_BRANCH: string =
    serverSettings.BUILDKITE_BRANCH || "master"
export const BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL: string =
    serverSettings.BUILDKITE_DEPLOY_CONTENT_SLACK_CHANNEL || "C06EWA0DK4H" // #content-updates

export const OPENAI_API_KEY: string = serverSettings.OPENAI_API_KEY ?? ""

export const SLACK_BOT_OAUTH_TOKEN: string =
    serverSettings.SLACK_BOT_OAUTH_TOKEN ?? ""
