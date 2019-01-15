require('dotenv').config()

interface Settings {
    ASSETS_URL: string
    WORDPRESS_URL: string
    WORDPRESS_DB_NAME: string
    WORDPRESS_DIR: string
    GRAPHER_DIR: string
    GRAPHER_DB_NAME: string

    // The output directory for static bundle
    BAKED_DIR: string
    // The root url to use in the static bundle output
    BAKED_URL: string

    // Are we currently baking a static bundle?
    IS_BAKING: boolean

    HTTPS_ONLY: boolean

    BLOG_POSTS_PER_PAGE: number
    DEV_SERVER_HOST: string
    DEV_SERVER_PORT: number
}

const env: Settings = (process.env as any)
env.BLOG_POSTS_PER_PAGE = 21
env.DEV_SERVER_HOST = process.env.DEV_SERVER_HOST || "localhost"
env.DEV_SERVER_PORT = process.env.DEV_SERVER_PORT ? parseInt(process.env.DEV_SERVER_PORT) : 3099
export = env