import * as mysql from 'mysql'
import * as typeorm from 'typeorm'
const ormconfig = require('ormconfig')
let connection: typeorm.Connection

export async function connect(name?: string) {
    if (connection) return connection

    try {
        connection = typeorm.getConnection()
    } catch (e) {
        if (e.name === "ConnectionNotFoundError") {
            connection = await typeorm.createConnection()
        } else {
            throw e
        }
    }

    return connection
}

function cleanup() {
    if (!connection) return
    connection.close().then(() => {
        console.log("Database connection closed")
        process.exit(0)
    }).catch((err) => {
        console.error(err)
        process.exit(1)
    })
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

export class TransactionContext {
    manager: typeorm.EntityManager
    constructor(manager: typeorm.EntityManager) {
        this.manager = manager
    }

    execute(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(params ? mysql.format(queryStr, params) : queryStr)
    }

    query(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(params ? mysql.format(queryStr, params) : queryStr)
    }
}

export async function transaction<T>(callback: (t: TransactionContext) => Promise<T>): Promise<T> {
    return typeorm.getConnection().transaction(async manager => {
        const t = new TransactionContext(manager)
        return await callback(t)
    })
}

export async function query(queryStr: string, params?: any[]): Promise<any> {
    return typeorm.getConnection().query(params ? mysql.format(queryStr, params) : queryStr)
}

// For operations that modify data (TODO: handling to check query isn't used for this)
export async function execute(queryStr: string, params?: any[]): Promise<any> {
    return typeorm.getConnection().query(params ? mysql.format(queryStr, params) : queryStr)
}

export async function get(queryStr: string, params?: any[]): Promise<any> {
    return (await query(queryStr, params))[0]
}

export async function end() {
    if (connection)
        await connection.close()
}