require("dotenv").config()
const { DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT } = process.env

module.exports = {
    type: "mysql",
    host: DB_HOST || "localhost",
    port: DB_PORT || 3306,
    username: DB_USER || "root",
    password: DB_PASS || "",
    database: DB_NAME,
    entities: ["db/model/**/*.ts"],
    migrations: ["db/migration/**/*.ts"],
    cli: {
        entitiesDir: "db/model",
        migrationsDir: "db/migration"
    }
}
