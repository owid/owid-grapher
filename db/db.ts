import * as mysql from "mysql"
import * as typeorm from "typeorm"
import Knex from "knex"
import {
    DB_HOST,
    DB_USER,
    DB_PASS,
    DB_NAME,
    DB_PORT,
} from "settings/serverSettings"
import { registerExitHandler } from "./cleanup"
let connection: typeorm.Connection

export const connect = async () => getConnection()

const getConnection = async () => {
    if (connection) return connection

    try {
        connection = typeorm.getConnection()
    } catch (err) {
        if (err.name === "ConnectionNotFoundError")
            connection = await typeorm.createConnection()
        else throw err
    }

    registerExitHandler(async () => {
        if (connection) await connection.close()
    })

    return connection
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
): Promise<T> => {
    return (await getConnection()).transaction(async (manager) => {
        const t = new TransactionContext(manager)
        return callback(t)
    })
}

export const query = async (queryStr: string, params?: any[]): Promise<any> => {
    const conn = await getConnection()
    return conn.query(params ? mysql.format(queryStr, params) : queryStr)
}

// For operations that modify data (TODO: handling to check query isn't used for this)
export const execute = async (
    queryStr: string,
    params?: any[]
): Promise<any> => {
    const conn = await getConnection()
    return conn.query(params ? mysql.format(queryStr, params) : queryStr)
}

export const get = async (queryStr: string, params?: any[]): Promise<any> => {
    return (await query(queryStr, params))[0]
}

export async function end() {
    if (connection) await connection.close()
    if (knexInstance) await knexInstance.destroy()
}

let knexInstance: Knex

export const knex = () => {
    if (knexInstance) return knexInstance

    knexInstance = Knex({
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
        if (knexInstance) await knexInstance.destroy()
    })

    return knexInstance
}

export const table = (table: string) => knex().table(table)

export const raw = (str: string) => knex().raw(str)

export const select = <T, K extends keyof T>(
    query: Knex.QueryBuilder,
    ...args: K[]
): Promise<Pick<T, K>[]> => query.select(...args) as any
