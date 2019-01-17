require('dotenv').config()
const {DB_HOST, DB_NAME, DB_USER, DB_PASS, DB_PORT} = process.env

module.exports = {
    "type": "mysql",
    "host": DB_HOST || 'localhost',
    "port": DB_PORT || 3306,
    "username": DB_USER || 'root',
    "password": DB_PASS || '',
    "database": DB_NAME,
    "entities": ["src/model/**/*.ts"],
    "migrations": ["src/migration/**/*.ts"],
    "cli": {
        "entitiesDir": "src/model",
        "migrationsDir": "src/migration"
    }
 }
