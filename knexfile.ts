// Update with your config settings.

import {
    GRAPHER_DB_NAME,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_HOST,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"

const dbConfig = {
    client: "mysql",
    connection: {
        database: GRAPHER_DB_NAME,
        user: GRAPHER_DB_USER,
        password: GRAPHER_DB_PASS,
        host: GRAPHER_DB_HOST,
        port: GRAPHER_DB_PORT,
        charset: "utf8mb4",
    },
    pool: {
        min: 2,
        max: 10,
    },
}

export = {
    development: dbConfig,
    staging: dbConfig,
    production: dbConfig,
}
