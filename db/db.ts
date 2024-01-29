import mysql from "mysql"
import { DataSource, EntityManager } from "typeorm"
import { dataSource } from "./dataSource.js"
import { knex, Knex } from "knex"
import {
    GRAPHER_DB_HOST,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { registerExitHandler } from "./cleanup.js"
let typeormDataSource: DataSource

export const getConnection = async (
    source: DataSource = dataSource
): Promise<DataSource> => {
    if (typeormDataSource) return typeormDataSource

    typeormDataSource = await source.initialize()

    registerExitHandler(async () => {
        if (typeormDataSource) await typeormDataSource.destroy()
    })

    return typeormDataSource
}

export class TransactionContext {
    manager: EntityManager
    constructor(manager: EntityManager) {
        this.manager = manager
    }

    execute(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(
            params ? mysql.format(queryStr, params) : queryStr
        )
    }

    query(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(
            params ? mysql.format(queryStr, params) : queryStr
        )
    }
}

export const transaction = async <T>(
    callback: (t: TransactionContext) => Promise<T>
): Promise<T> =>
    (await getConnection()).transaction(async (manager) =>
        callback(new TransactionContext(manager))
    )

export const queryMysql = async (
    queryStr: string,
    params?: any[]
): Promise<any> => {
    const conn = await getConnection()
    return conn.query(params ? mysql.format(queryStr, params) : queryStr)
}

// For operations that modify data (TODO: handling to check query isn't used for this)
export const execute = queryMysql

// Return the first match from a mysql query
export const mysqlFirst = async (
    queryStr: string,
    params?: any[]
): Promise<any> => {
    return (await queryMysql(queryStr, params))[0]
}

export const closeTypeOrmAndKnexConnections = async (): Promise<void> => {
    if (typeormDataSource) await typeormDataSource.destroy()
    if (_knexInstance) await _knexInstance.destroy()
}

let _knexInstance: Knex

export const knexInstance = (): Knex<any, any[]> => {
    if (_knexInstance) return _knexInstance

    _knexInstance = knex({
        client: "mysql",
        connection: {
            host: GRAPHER_DB_HOST,
            user: GRAPHER_DB_USER,
            password: GRAPHER_DB_PASS,
            database: GRAPHER_DB_NAME,
            port: GRAPHER_DB_PORT,
            typeCast: (field: any, next: any) => {
                if (field.type === "TINY" && field.length === 1) {
                    return field.string() === "1" // 1 = true, 0 = false
                }
                return next()
            },
        },
    })

    registerExitHandler(async () => {
        if (_knexInstance) await _knexInstance.destroy()
    })

    return _knexInstance
}

export const knexTable = (table: string): Knex.QueryBuilder =>
    knexInstance().table(table)

export const knexRaw = async <TRow = unknown>(
    str: string,
    knex: Knex<any, any[]>,
    params?: any[]
): Promise<TRow[]> => (await knex.raw(str, params ?? []))[0]

export const knexRawFirst = async <TRow = unknown>(
    str: string,
    knex: Knex<any, any[]>,
    params?: any[]
): Promise<TRow | undefined> => {
    const results = await knexRaw<TRow>(str, knex, params)
    if (results.length === 0) return undefined
    return results[0]
}

/**
 *  In the backporting workflow, the users create gdoc posts for posts. As long as these are not yet published,
 *  we still want to bake them from the WP posts. Once the users presses publish there though, we want to stop
 *  baking them from the wordpress post. This funciton fetches all the slugs of posts that have been published via gdocs,
 *  to help us exclude them from the baking process.
 */
export const getSlugsWithPublishedGdocsSuccessors = async (
    knex: Knex<any, any[]>
): Promise<Set<string>> => {
    return knexRaw(
        `-- sql
            select slug from posts_with_gdoc_publish_status
            where isGdocPublished = TRUE`,
        knex
    ).then((rows) => new Set(rows.map((row: any) => row.slug)))
}
