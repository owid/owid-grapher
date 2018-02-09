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
}

const env: Settings = (process.env as any)

env.ENV = env.ENV === "production" ? "production" : "development"

env.BASE_DIR = path.join(__dirname, "../")

export = env