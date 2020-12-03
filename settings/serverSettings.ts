// This is where server-side only, potentially sensitive settings enter from the environment
// DO NOT store sensitive strings in this file itself, as it is checked in to git!

// todo: handle when someone overrides these 3, the derived vars
const DB_NAME = "owid"
const DB_USER = "root"
const DB_PASS = ""
const DB_HOST = "localhost"
const DB_PORT = 3306
const BASE_DIR = __dirname + "/../../"

const defaultSettings = {
    ENV: "development",
    BASE_DIR,
    BAKED_SITE_DIR: `${BASE_DIR}/bakedSite`, // Where the static build output goes
    SECRET_KEY: "fejwiaof jewiafo jeioa fjieowajf isa fjidosajfgj",
    DB_NAME,
    DB_USER,
    DB_PASS,
    DB_HOST,
    DB_PORT,
    WORDPRESS_DB_NAME: DB_NAME,
    WORDPRESS_DB_USER: DB_USER,
    WORDPRESS_DB_PASS: DB_PASS,
    WORDPRESS_DB_HOST: DB_HOST,
    WORDPRESS_DB_PORT: DB_PORT,
    WORDPRESS_API_USER: "",
    WORDPRESS_API_PASS: "",
    SESSION_COOKIE_AGE: 1209600,
    ALGOLIA_SECRET_KEY: "",
    STRIPE_SECRET_KEY: "",
    // Settings for automated email sending, e.g. for admin invites
    EMAIL_HOST: "smtp.mail.com",
    EMAIL_PORT: 443,
    EMAIL_HOST_USER: "user",
    EMAIL_HOST_PASSWORD: "password",
    // Wordpress target settings
    WORDPRESS_DIR: "",
    HTTPS_ONLY: true,
    // Node slack webhook to report errors to using express-error-slack
    SLACK_ERRORS_WEBHOOK_URL: "",
    GIT_DATASETS_DIR: `${BASE_DIR}/datasetsExport`, //  Where the git exports go
    TMP_DIR: "/tmp",
    UNCATEGORIZED_TAG_ID: 375,
    // Should the static site output be baked when relevant database items change?
    BAKE_ON_CHANGE: false,
    DEPLOY_QUEUE_FILE_PATH: `${BASE_DIR}/.queue`,
    DEPLOY_PENDING_FILE_PATH: `${BASE_DIR}/.pending`,
    CLOUDFLARE_AUD: "",
}

const {
    ENV,
    BAKED_SITE_DIR,
    SECRET_KEY,
    WORDPRESS_DB_NAME,
    WORDPRESS_DB_USER,
    WORDPRESS_DB_PASS,
    WORDPRESS_DB_HOST,
    WORDPRESS_DB_PORT,
    WORDPRESS_API_USER,
    WORDPRESS_API_PASS,
    SESSION_COOKIE_AGE,
    ALGOLIA_SECRET_KEY,
    STRIPE_SECRET_KEY,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_HOST_USER,
    EMAIL_HOST_PASSWORD,
    WORDPRESS_DIR,
    HTTPS_ONLY,
    SLACK_ERRORS_WEBHOOK_URL,
    GIT_DATASETS_DIR,
    TMP_DIR,
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
    CLOUDFLARE_AUD,
} = {
    ...defaultSettings,
    // todo: load overrides
}

export {
    DB_NAME,
    DB_USER,
    DB_PASS,
    DB_HOST,
    DB_PORT,
    BASE_DIR,
    ENV,
    BAKED_SITE_DIR,
    SECRET_KEY,
    WORDPRESS_DB_NAME,
    WORDPRESS_DB_USER,
    WORDPRESS_DB_PASS,
    WORDPRESS_DB_HOST,
    WORDPRESS_DB_PORT,
    WORDPRESS_API_USER,
    WORDPRESS_API_PASS,
    SESSION_COOKIE_AGE,
    ALGOLIA_SECRET_KEY,
    STRIPE_SECRET_KEY,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_HOST_USER,
    EMAIL_HOST_PASSWORD,
    WORDPRESS_DIR,
    HTTPS_ONLY,
    SLACK_ERRORS_WEBHOOK_URL,
    GIT_DATASETS_DIR,
    TMP_DIR,
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    DEPLOY_QUEUE_FILE_PATH,
    DEPLOY_PENDING_FILE_PATH,
    CLOUDFLARE_AUD,
}
