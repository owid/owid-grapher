// Update with your config settings.

import { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } from "serverSettings"

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
        tableName: "knex_migrations",
        directory: "./db/knexMigrations"
    }
}

export = {
    development: dbConfig,
    staging: dbConfig,
    production: dbConfig
}
