import * as mysql from "mysql"
import * as typeorm from "typeorm"
import knex, { Knex } from "knex"
import {
    DB_HOST,
    DB_USER,
    DB_PASS,
    DB_NAME,
    DB_PORT,
} from "../settings/serverSettings.js"
import { registerExitHandler } from "./cleanup.js"
let typeormConnection: typeorm.Connection

export const getConnection = async (): Promise<typeorm.Connection> => {
    if (typeormConnection) return typeormConnection

    try {
        typeormConnection = typeorm.getConnection()
    } catch (err) {
        if (err instanceof Error && err.name === "ConnectionNotFoundError")
            typeormConnection = await typeorm.createConnection()
        else throw err
    }

    registerExitHandler(async () => {
        if (typeormConnection) await typeormConnection.close()
    })

    return typeormConnection
}

export class TransactionContext {
    manager: typeorm.EntityManager
    constructor(manager: typeorm.EntityManager) {
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
    if (typeormConnection) await typeormConnection.close()
    if (_knexInstance) await _knexInstance.destroy()
}

let _knexInstance: Knex

export const knexInstance = (): Knex<any, any[]> => {
    if (_knexInstance) return _knexInstance

    _knexInstance = knex({
        client: "mysql",
        connection: {
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASS,
            database: DB_NAME,
            port: DB_PORT,
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

export const knexRaw = (str: string): Knex.Raw => knexInstance().raw(str)
