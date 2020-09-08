import { parseBool } from "utils/string"

// All of this information is available to the client-side code
// DO NOT retrieve sensitive information from the environment in here! :O

const env = typeof process !== "undefined" ? process.env : undefined

export const ENV: "production" | "development" =
    env?.ENV === "production" || env?.NODE_ENV === "production"
        ? "production"
        : "development"

export const ADMIN_SERVER_HOST: string = env?.ADMIN_SERVER_HOST || "localhost"
export const ADMIN_SERVER_PORT: number = env?.ADMIN_SERVER_PORT
    ? parseInt(env?.ADMIN_SERVER_PORT)
    : 3030
export const WEBPACK_DEV_URL: string =
    env?.WEBPACK_DEV_URL || "http://localhost:8090"
export const BAKED_BASE_URL: string =
    env?.BAKED_BASE_URL || `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const BAKED_GRAPHER_URL: string =
    env?.BAKED_GRAPHER_URL || `${BAKED_BASE_URL}/grapher`
export const ADMIN_BASE_URL: string =
    env?.ADMIN_BASE_URL || `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
export const WORDPRESS_URL: string = env?.WORDPRESS_URL || "https://owid.cloud"

export const GRAPHER_VERSION: string = "1.0.0" // Ideally the Git hash

// Settings for git export and version tracking of database
export const GITHUB_USERNAME: string = env?.GITHUB_USERNAME || "owid-test"
export const GIT_DEFAULT_USERNAME: string =
    env?.GIT_DEFAULT_USERNAME || "Our World in Data"
export const GIT_DEFAULT_EMAIL: string =
    env?.GIT_DEFAULT_EMAIL || "info@ourworldindata.org"

export const BLOG_POSTS_PER_PAGE: number = 20
export const BLOG_SLUG: string = "blog"

export const ALGOLIA_ID: string = env?.ALGOLIA_ID || ""
export const ALGOLIA_SEARCH_KEY: string = env?.ALGOLIA_SEARCH_KEY || ""

export const STRIPE_PUBLIC_KEY: string =
    env?.STRIPE_PUBLIC_KEY || "pk_test_nIHvmH37zsoltpw3xMssPIYq"
export const DONATE_API_URL: string =
    env?.DONATE_API_URL || "http://localhost:9000/donate"
export const RECAPTCHA_SITE_KEY: string =
    env?.RECAPTCHA_SITE_KEY || "6LcJl5YUAAAAAATQ6F4vl9dAWRZeKPBm15MAZj4Q"

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
    1510,
]

// Feature flag for explorable charts
export const EXPLORER: boolean = env?.EXPLORER
    ? parseBool(env?.EXPLORER)
    : false

// Feature flag for COVID Dashboard
export const COVID_DASHBOARD: boolean = env?.COVID_DASHBOARD
    ? parseBool(env?.COVID_DASHBOARD)
    : false

// Settings for optimizations that are applied in the baking step
export const OPTIMIZE_SVG_EXPORTS = env?.OPTIMIZE_SVG_EXPORTS
    ? parseBool(env?.OPTIMIZE_SVG_EXPORTS)
    : false
