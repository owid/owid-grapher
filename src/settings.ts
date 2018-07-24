import * as path from 'path'
import * as parseUrl from 'url-parse'

require('module-alias').addAliases({
    'react'  : 'preact-compat',
    'react-dom': 'preact-compat'
})

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
    BUILD_GRAPHER_URL: string
    BUILD_ASSETS_URL: string
    BASE_DIR: string
    SECRET_KEY: string
    NODE_SERVER_HOST: string
    NODE_SERVER_PORT: number
    NODE_BASE_URL: string
    SLACK_ERRORS_WEBHOOK_URL: string
    SESSION_COOKIE_AGE: number

    WORDPRESS_DB_NAME: string
    WORDPRESS_DIR: string
    DJANGO_BASE_URL: string

    EMAIL_HOST: string
    EMAIL_PORT: number
    EMAIL_HOST_USER: string
    EMAIL_HOST_PASSWORD: string
    EMAIL_USE_TLS: boolean

    // These settings are inferred from other settings
    BUILD_GRAPHER_PATH: string
    BUILD_DIR: string
}

const env: Settings = (process.env as any)

env.ENV = (env.ENV === "production" || process.env.NODE_ENV === "production") ? "production" : "development"
env.BASE_DIR = path.join(__dirname, "../../")
env.BUILD_DIR = path.join(env.BASE_DIR, "public")
env.SESSION_COOKIE_AGE = process.env.SESSION_COOKIE_AGE ? parseInt(process.env.SESSION_COOKIE_AGE) : 1209600
env.NODE_SERVER_HOST = process.env.NODE_SERVER_HOST || "localhost"
env.NODE_SERVER_PORT = process.env.NODE_SERVER_PORT ? parseInt(process.env.NODE_SERVER_PORT) : 3030
env.NODE_BASE_URL = env.NODE_BASE_URL || `http://${env.NODE_SERVER_HOST}:${env.NODE_SERVER_PORT}`

env.DB_PORT = env.DB_PORT ? parseInt(env.DB_PORT as any) : 3306

env.EMAIL_PORT = env.EMAIL_PORT ? parseInt(env.EMAIL_PORT as any) : 443
env.EMAIL_USE_TLS = !!env.EMAIL_USE_TLS

const url = parseUrl(env.BUILD_GRAPHER_URL)
env.BUILD_GRAPHER_PATH = url.pathname

export = env