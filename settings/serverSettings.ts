// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

import path from "path"
import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"
import fs from "fs"
import ini from "ini"
import os from "os"

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

export const VITE_PREVIEW: boolean = serverSettings.VITE_PREVIEW === "true"

export const ADMIN_BASE_URL: string = clientSettings.ADMIN_BASE_URL

export const BAKED_GRAPHER_URL: string =
    serverSettings.BAKED_GRAPHER_URL ?? `${BAKED_BASE_URL}/grapher`

export const OPTIMIZE_SVG_EXPORTS: boolean =
    serverSettings.OPTIMIZE_SVG_EXPORTS === "true"

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
export const SESSION_COOKIE_AGE: number =
    parseIntOrUndefined(serverSettings.SESSION_COOKIE_AGE) ?? 1209600
export const ALGOLIA_SECRET_KEY: string =
    serverSettings.ALGOLIA_SECRET_KEY ?? ""
export const ALGOLIA_INDEXING: boolean =
    serverSettings.ALGOLIA_INDEXING === "true"

// Wordpress target setting
export const HTTPS_ONLY: boolean = serverSettings.HTTPS_ONLY !== "false"

export const GIT_DATASETS_DIR: string =
    serverSettings.GIT_DATASETS_DIR ?? `${BASE_DIR}/datasetsExport` //  Where the git exports go
export const TMP_DIR: string = serverSettings.TMP_DIR ?? "/tmp"
export const UNCATEGORIZED_TAG_ID: number =
    parseIntOrUndefined(serverSettings.UNCATEGORIZED_TAG_ID) ?? 375

// Should the static site output be baked when relevant database items change
export const BAKE_ON_CHANGE: boolean = serverSettings.BAKE_ON_CHANGE === "true"
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

// Load R2 credentials from rclone config
let rcloneConfig: any = {}
const rcloneConfigPath = path.join(os.homedir(), ".config/rclone/rclone.conf")
if (fs.existsSync(rcloneConfigPath)) {
    rcloneConfig = ini.parse(fs.readFileSync(rcloneConfigPath, "utf-8"))
}

// e.g. https://images-staging.owid.io/
export const IMAGE_HOSTING_R2_CDN_URL: string =
    serverSettings.IMAGE_HOSTING_R2_CDN_URL || ""
// e.g. owid-image-hosting-staging/development
export const IMAGE_HOSTING_R2_BUCKET_PATH: string =
    serverSettings.IMAGE_HOSTING_R2_BUCKET_PATH || ""
// e.g. development
export const IMAGE_HOSTING_R2_BUCKET_SUBFOLDER_PATH: string =
    IMAGE_HOSTING_R2_BUCKET_PATH.slice(
        IMAGE_HOSTING_R2_BUCKET_PATH.indexOf("/") + 1
    )
// extract R2 credentials from rclone config as defaults
export const R2_ENDPOINT: string =
    serverSettings.R2_ENDPOINT ||
    rcloneConfig["owid-r2"]?.endpoint ||
    "https://078fcdfed9955087315dd86792e71a7e.r2.cloudflarestorage.com"
export const R2_ACCESS_KEY_ID: string =
    serverSettings.R2_ACCESS_KEY_ID ||
    rcloneConfig["owid-r2"]?.access_key_id ||
    ""
export const R2_SECRET_ACCESS_KEY: string =
    serverSettings.R2_SECRET_ACCESS_KEY ||
    rcloneConfig["owid-r2"]?.secret_access_key ||
    ""
export const R2_REGION: string =
    serverSettings.R2_REGION || rcloneConfig["owid-r2"]?.region || "auto"

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

export const LEGACY_WORDPRESS_IMAGE_URL: string =
    serverSettings.LEGACY_WORDPRESS_IMAGE_URL ??
    "https://assets.ourworldindata.org/uploads"

// search evaluation
export const SEARCH_EVAL_URL: string =
    "https://pub-ec761fe0df554b02bc605610f3296000.r2.dev"
