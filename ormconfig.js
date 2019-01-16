require('dotenv').config()
const {DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT} = process.env

module.exports = {
    "type": "mysql",
    "host": DB_HOST,
    "port": DB_PORT,
    "username": DB_USER,
    "password": DB_PASS,
    "database": DB_NAME,
    "entities": ["src/model/**/*.ts"],
    "migrations": ["src/migration/**/*.ts"],
    "cli": {
        "entitiesDir": "src/model",
        "migrationsDir": "src/migration"
    }
 }
