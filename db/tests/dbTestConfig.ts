// depending on which database engine you are using
// this is a typical PostgreSQL config for the pg driver
import {
    GRAPHER_TEST_NAME,
    GRAPHER_TEST_USER,
    GRAPHER_TEST_PASS,
    GRAPHER_TEST_HOST,
    GRAPHER_TEST_PORT,
} from "../../settings/serverSettings.js"

export const dbTestConfig = {
    client: "mysql",
    connection: {
        database: GRAPHER_TEST_NAME,
        user: GRAPHER_TEST_USER,
        password: GRAPHER_TEST_PASS,
        host: GRAPHER_TEST_HOST,
        port: GRAPHER_TEST_PORT,
        charset: "utf8mb4",
    },
    pool: {
        min: 2,
        max: 10,
    },
}
