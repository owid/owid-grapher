import { DataSource } from "typeorm"
import {
    GRAPHER_TEST_DB_HOST,
    GRAPHER_TEST_DB_NAME,
    GRAPHER_TEST_DB_USER,
    GRAPHER_TEST_DB_PASS,
    GRAPHER_TEST_DB_PORT,
} from "../../settings/serverSettings.js"

export const dataSource = new DataSource({
    type: "mysql",
    host: GRAPHER_TEST_DB_HOST || "localhost",
    port: GRAPHER_TEST_DB_PORT || 3306,
    username: GRAPHER_TEST_DB_USER || "root",
    password: GRAPHER_TEST_DB_PASS || "",
    database: GRAPHER_TEST_DB_NAME,
    entities: ["db/model/**/!(*.test).ts"],
    migrations: ["db/migration/**/!(*.test).ts"],
    charset: "utf8mb4",
})
