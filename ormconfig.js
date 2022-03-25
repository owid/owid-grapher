const {
    DB_HOST,
    DB_NAME,
    DB_USER,
    DB_PASS,
    DB_PORT,
} = require("./itsJustJavascript/settings/serverSettings")

module.exports = {
    type: "mysql",
    host: DB_HOST || "localhost",
    port: DB_PORT || 3306,
    username: DB_USER || "root",
    password: DB_PASS || "",
    database: DB_NAME,
    entities: ["itsJustJavascript/db/model/**/*.js"],
    migrations: ["itsJustJavascript/db/migration/**/*.js"],
    charset: "utf8mb4",
    cli: {
        entitiesDir: "db/model",
        migrationsDir: "db/migration",
    },
}
