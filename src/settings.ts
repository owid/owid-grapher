import * as path from 'path'
import * as parseUrl from 'url-parse'
import * as urljoin from 'url-join'
require('dotenv').config()

interface Settings {
    // These settings are loaded from .env
    DB_NAME: string
    DB_USER: string
    DB_PASS: string
    DB_HOST: string
    DB_PORT: number
    ENV: 'production'|'development'

    WEBPACK_DEV_URL: string
    WEBPACK_OUTPUT_PATH: string

    BAKED_GRAPHER_URL: string
    BAKED_ASSETS_URL: string
    BASE_DIR: string
    SECRET_KEY: string

    ADMIN_SERVER_HOST: string
    ADMIN_SERVER_PORT: number
    ADMIN_BASE_URL: string
    ADMIN_ASSETS_URL: string

    SLACK_ERRORS_WEBHOOK_URL?: string
    SESSION_COOKIE_AGE: number

    WORDPRESS_DB_NAME: string
    WORDPRESS_DIR: string
    WORDPRESS_URL: string

    EMAIL_HOST: string
    EMAIL_PORT: number
    EMAIL_HOST_USER: string
    EMAIL_HOST_PASSWORD: string
    EMAIL_USE_TLS: boolean

    // Where we store data exports in the form of git repos
    GIT_DEFAULT_USERNAME: string
    GIT_DEFAULT_EMAIL: string
    GITHUB_USERNAME: string
    TMP_DIR: string

    // These settings are inferred from other settings
    BUILD_GRAPHER_PATH: string
    BAKED_GRAPHER_DIR: string
    GIT_DATASETS_DIR: string

    // The special tag that represents all untagged stuff
    UNCATEGORIZED_TAG_ID: number

    HTTPS_ONLY: boolean
    BAKED_BASE_URL: string
    BAKED_WORDPRESS_DIR: string

    BLOG_POSTS_PER_PAGE: number
    BAKED_DEV_SERVER_HOST: string
    BAKED_DEV_SERVER_PORT: number
}

const {env} = process

const BASE_DIR = env.BASE_DIR || path.join(__dirname, "../../")

function expect(key: string): string {
    const val = env[key]
    if (val === undefined) {
        throw new Error(`OWID requires an environment variable for ${key}`)
    } else {
        return val
    }
}

const ENV = (env.ENV === "production" || env.NODE_ENV === "production") ? "production" : "development"

const ADMIN_SERVER_HOST = env.ADMIN_SERVER_HOST || "localhost"
const ADMIN_SERVER_PORT = env.ADMIN_SERVER_PORT ? parseInt(env.ADMIN_SERVER_PORT) : 3030

const BAKED_DEV_SERVER_HOST = env.BAKED_DEV_SERVER_HOST || "localhost"
const BAKED_DEV_SERVER_PORT = env.BAKED_DEV_SERVER_PORT ? parseInt(env.BAKED_DEV_SERVER_PORT) : 3099

const WEBPACK_DEV_URL = env.WEBPACK_DEV_URL || "http://localhost:8090"
const WEBPACK_OUTPUT_PATH = env.WEBPACK_OUTPUT_PATH || path.join(BASE_DIR, 'dist/webpack')
const BAKED_BASE_URL = env.BAKED_BASE_URL || `http://${BAKED_DEV_SERVER_HOST}:${BAKED_DEV_SERVER_PORT}`

const settings: Settings = {
    ENV: ENV,
    BASE_DIR: BASE_DIR,

    // Url for webpack-dev-server, must match the one in webpack.config.js
    WEBPACK_DEV_URL: WEBPACK_DEV_URL,

    // Output path for webpack in production mode
    WEBPACK_OUTPUT_PATH: WEBPACK_OUTPUT_PATH,

    SECRET_KEY: ENV === "production" ? expect('SECRET_KEY') : "not a very secret key at all",

    ADMIN_SERVER_HOST: ADMIN_SERVER_HOST,
    ADMIN_SERVER_PORT: ADMIN_SERVER_PORT,
    ADMIN_BASE_URL: env.ADMIN_BASE_URL || `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`,
    ADMIN_ASSETS_URL: env.ADMIN_ASSETS_URL || WEBPACK_DEV_URL,

    DB_NAME: expect('DB_NAME'),
    DB_USER: env.DB_USER || "root",
    DB_PASS: env.DB_PASS || "",
    DB_HOST: env.DB_HOST || "localhost",
    DB_PORT: env.DB_PORT ? parseInt(env.DB_PORT) : 3306, 

    WORDPRESS_DB_NAME: env.WORDPRESS_DB_NAME || "",
    WORDPRESS_DIR: env.WORDPRESS_DIR || "",
    WORDPRESS_URL: env.WORDPRESS_URL || "https://owid.cloud",

    // Node slack webhook to report errors to using express-error-slack
    SLACK_ERRORS_WEBHOOK_URL: env.SLACK_ERRORS_WEBHOOK_URL || undefined,

    // For sending any kind of automated email
    EMAIL_HOST: env.EMAIL_HOST || 'smtp.mail.com',
    EMAIL_PORT: env.EMAIL_PORT ? parseInt(env.EMAIL_PORT) : 443,
    EMAIL_HOST_USER: env.EMAIL_HOST_USER || 'user',
    EMAIL_HOST_PASSWORD: env.EMAIL_HOST_PASSWORD || 'password',
    EMAIL_USE_TLS: env.EMAIL_USE_TLS === "false" ? false : true,

    // For defining absolute urls in the baked output
    BAKED_BASE_URL: BAKED_BASE_URL,
    BAKED_ASSETS_URL: env.BAKED_ASSETS_URL || WEBPACK_DEV_URL,
    BAKED_GRAPHER_URL: env.BAKED_GRAPHER_URL || `${BAKED_BASE_URL}/grapher`,

    // Where the static build output goes
    BAKED_WORDPRESS_DIR: env.BAKED_DIR || "/Users/mispy/wp-static",
    BAKED_GRAPHER_DIR: env.BAKED_GRAPHER_DIR || path.join(BASE_DIR, "public"),

    // The development server that bakes and serves individual urls
    BAKED_DEV_SERVER_HOST: BAKED_DEV_SERVER_HOST,
    BAKED_DEV_SERVER_PORT: BAKED_DEV_SERVER_PORT,

    GIT_DATASETS_DIR: env.GIT_DATASETS_DIR || path.join(BASE_DIR, "datasetsExport"),
    SESSION_COOKIE_AGE: process.env.SESSION_COOKIE_AGE ? parseInt(process.env.SESSION_COOKIE_AGE) : 1209600,

    // Settings for git export and version tracking of database
    GITHUB_USERNAME: env.GITHUB_USERNAME || "owid-test",
    GIT_DEFAULT_USERNAME: env.GIT_DEFAULT_USERNAME || "Our World in Data",
    GIT_DEFAULT_EMAIL: env.GIT_DEFAULT_EMAIL || "info@ourworldindata.org",
    TMP_DIR: env.TMP_DIR || "/tmp",

    BUILD_GRAPHER_PATH: env.BAKED_GRAPHER_URL ? parseUrl(env.BAKED_GRAPHER_URL).pathname : "http://localhost:3030/grapher",

    UNCATEGORIZED_TAG_ID: env.UNCATEGORIZED_TAG_ID ? parseInt(env.UNCATEGORIZED_TAG_ID as any) : 375,
    HTTPS_ONLY: true,

    BLOG_POSTS_PER_PAGE: 21,
}

export = settings