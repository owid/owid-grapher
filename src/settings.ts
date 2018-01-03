require('module-alias').addAliases({
    'react'  : 'preact-compat',
    'react-dom': 'preact-compat'
})

require('dotenv').config()

interface Settings {
    BASE_URL: string
    STATIC_ROOT: string
    DB_NAME: string
}

const env: Settings = (process.env as any)
export = env