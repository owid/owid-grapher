import * as mysql from 'mysql'

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

// Promise wrapper for node-mysql with transaction support and some shorthands
export default class DatabaseConnection {
    config: mysql.PoolConfig
    pool!: mysql.Pool

    constructor(config: mysql.PoolConfig) {
        this.config = config
    }

    connect() {
        this.pool = mysql.createPool(this.config)
    }

    getConnection(): Promise<mysql.PoolConnection> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((poolerr, conn) => {
                if (poolerr) {
                    reject(poolerr)
                } else {
                    resolve(conn)
                }
            })
        })
    }

    async transaction<T>(callback: (t: TransactionContext) => Promise<T>): Promise<T> {
        const conn = await this.getConnection()
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

    query(queryStr: string, params?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pool.query(queryStr, params, (err, rows) => {
                if (err) return reject(err)
                resolve(rows)
            })
        })
    }

    // For operations that modify data (TODO: handling to check query isn't used for this)
    execute(queryStr: string, params?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pool.query(queryStr, params, (err, rows) => {
                if (err) return reject(err)
                resolve(rows)
            })
        })
    }

    async get(queryStr: string, params?: any[]): Promise<any> {
        return (await this.query(queryStr, params))[0]
    }

    end() {
        this.pool.end()
    }
}