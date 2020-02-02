// Update with your config settings.

import { DB_HOST, DB_NAME, DB_PASS, DB_PORT, DB_USER } from "serverSettings"

const dbConfig = {
    client: "mysql",
    connection: {
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASS,
        host: DB_HOST,
        port: DB_PORT
    },
    pool: {
        min: 2,
        max: 10
    },
    migrations: {
        tableName: "knex_migrations"
    }
}

export = {
    development: dbConfig,
    staging: dbConfig,
    production: dbConfig
}
