const {DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT} = require('./dist/src/settings')

module.exports = {
    "type": "mysql",
    "host": DB_HOST,
    "port": DB_PORT,
    "username": DB_USER,
    "password": DB_PASS,
    "database": DB_NAME,
    "entities": ["dist/src/model/**/*.js"],
    "migrations": ["dist/src/migration/**/*.js"],
    "cli": {
        "entitiesDir": "src/model",
        "migrationsDir": "src/migration"
    }
 }