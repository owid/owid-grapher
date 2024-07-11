// depending on which database engine you are using
// this is a typical PostgreSQL config for the pg driver
import {
    GRAPHER_TEST_DB_NAME,
    GRAPHER_TEST_DB_USER,
    GRAPHER_TEST_DB_PASS,
    GRAPHER_TEST_DB_HOST,
    GRAPHER_TEST_DB_PORT,
} from "../../settings/serverSettings.js"

export const dbTestConfig = {
    client: "mysql2",
    connection: {
        database: GRAPHER_TEST_DB_NAME,
        user: GRAPHER_TEST_DB_USER,
        password: GRAPHER_TEST_DB_PASS,
        host: GRAPHER_TEST_DB_HOST,
        port: GRAPHER_TEST_DB_PORT,
        charset: "utf8mb4",
        jsonStrings: true,
    },
    pool: {
        min: 2,
        max: 10,
    },
}
