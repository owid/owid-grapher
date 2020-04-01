import { parseBool } from "utils/string"

// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O

export const ENV: string =
    process.env.ENV === "production" || process.env.NODE_ENV === "production"
        ? "production"
        : "development"

export const ADMIN_SERVER_HOST: string =
    process.env.ADMIN_SERVER_HOST || "localhost"
export const ADMIN_SERVER_PORT: number = process.env.ADMIN_SERVER_PORT
    ? parseInt(process.env.ADMIN_SERVER_PORT)
    : 3030
export const BAKED_DEV_SERVER_HOST: string =
    process.env.BAKED_DEV_SERVER_HOST || "localhost"
export const BAKED_DEV_SERVER_PORT: number = process.env.BAKED_DEV_SERVER_PORT
    ? parseInt(process.env.BAKED_DEV_SERVER_PORT)
    : 3099
export const WEBPACK_DEV_URL: string =
    process.env.WEBPACK_DEV_URL || "http://localhost:8090"
export const BAKED_BASE_URL: string =
    process.env.BAKED_BASE_URL ||
    `http://${BAKED_DEV_SERVER_HOST}:${BAKED_DEV_SERVER_PORT}`
export const BAKED_GRAPHER_URL: string =
    process.env.BAKED_GRAPHER_URL || `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL: string =
    process.env.ADMIN_BASE_URL ||
    `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string =
    process.env.WORDPRESS_URL || "https://owid.cloud"

// Settings for git export and version tracking of database
export const GITHUB_USERNAME: string =
    process.env.GITHUB_USERNAME || "owid-test"
export const GIT_DEFAULT_USERNAME: string =
    process.env.GIT_DEFAULT_USERNAME || "Our World in Data"
export const GIT_DEFAULT_EMAIL: string =
    process.env.GIT_DEFAULT_EMAIL || "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE: number = 20

export const ALGOLIA_ID: string = process.env.ALGOLIA_ID || ""
export const ALGOLIA_SEARCH_KEY: string = process.env.ALGOLIA_SEARCH_KEY || ""

export const STRIPE_PUBLIC_KEY: string =
    process.env.STRIPE_PUBLIC_KEY || "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    process.env.DONATE_API_URL || "http://localhost:9000/donate"
export const RECAPTCHA_SITE_KEY: string =
    process.env.RECAPTCHA_SITE_KEY || "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

// XXX hardcoded filtering to public parent tags
export const PUBLIC_TAG_PARENT_IDS: number[] = [
    1515,
    1507,
    1513,
    1504,
    1502,
    1509,
    1506,
    1501,
    1514,
    1511,
    1500,
    1503,
    1505,
    1508,
    1512,
    1510
]

// Feature flag for explorable charts
export const EXPLORER: boolean = process.env.EXPLORER
    ? parseBool(process.env.EXPLORER)
    : false

// Settings for optimizations that are applied in the baking step
export const OPTIMIZE_SVG_EXPORTS = process.env.OPTIMIZE_SVG_EXPORTS
    ? parseBool(process.env.OPTIMIZE_SVG_EXPORTS)
    : false
