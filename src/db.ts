import * as mysql from 'mysql'
import * as settings from './settings'
import * as path from 'path'

import {DB_NAME, DB_USER, DB_PASS} from './settings'
import {Connection, createConnection} from "typeorm"

let pool: mysql.Pool
let connection: Connection

export async function connect() {
    pool = await mysql.createPool({
        host: 'localhost',
        user: 'root',
        database: settings.DB_NAME
    })

    connection = await createConnection({
        type: "mysql",
        host: "localhost",
        port: 3306,
        username: "root",
        password: "",
        database: "owid",
        entities: [__dirname + '/model/*.js']
    })
        
}

export function getConnection(): Promise<mysql.PoolConnection> {
    return new Promise((resolve, reject) => {
        pool.getConnection((poolerr, conn) => {
            if (poolerr) {
                reject(poolerr)
            } else {
                resolve(conn)
            }
        })
    })
}

class TransactionContext {
    conn: mysql.PoolConnection
    constructor(conn: mysql.PoolConnection) {
        this.conn = conn
    }

    execute(queryStr: string, params?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.conn.query(queryStr, params, (err, rows) => {
                if (err) return reject(err)
                resolve(rows)
            })
        })
    }

    query(queryStr: string, params?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.conn.query(queryStr, params, (err, rows) => {
                if (err) return reject(err)
                resolve(rows)
            })
        })
    }
}

export async function transaction<T>(callback: (t: TransactionContext) => Promise<T>): Promise<T> {
    const conn = await getConnection()
    const t = new TransactionContext(conn)

    try {
        await t.execute("START TRANSACTION")
        const result = await callback(t)
        await t.execute("COMMIT")
        return result
    } catch (err) {
        await t.execute("ROLLBACK")
        throw err
    } finally {
        t.conn.release()
    }
}

export function query(queryStr: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        pool.query(queryStr, params, (err, rows) => {
            if (err) return reject(err)
            resolve(rows)
        })
    })
}

// For operations that modify data (TODO: handling to check query isn't used for this)
export function execute(queryStr: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        pool.query(queryStr, params, (err, rows) => {
            if (err) return reject(err)
            resolve(rows)
        })
    })
}

export async function get(queryStr: string, params?: any[]): Promise<any> {
    return (await query(queryStr, params))[0]
}

export async function end() {
    await pool.end()
    await connection.close()
}