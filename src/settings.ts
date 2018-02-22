import * as path from 'path'

require('module-alias').addAliases({
    'react'  : 'preact-compat',
    'react-dom': 'preact-compat'
})

require('dotenv').config()

interface Settings {
    DB_NAME: string
    DB_USER: string
    DB_PASS: string
    DB_HOST: string
    DB_PORT: string
    ENV: 'production'|'development'
    WEBPACK_DEV_URL: string
    BAKED_URL: string
    ASSETS_URL: string
    BASE_DIR: string
    SECRET_KEY: string
    SESSION_COOKIE_AGE: number
}

const env: Settings = (process.env as any)

env.ENV = env.ENV === "production" ? "production" : "development"
env.BASE_DIR = path.join(__dirname, "../")
env.SESSION_COOKIE_AGE = process.env.SESSION_COOKIE_AGE ? parseInt(process.env.SESSION_COOKIE_AGE) : 1209600

export = env