import mysql2 from "mysql2"

class TransactionContext {
    conn: mysql2.PoolConnection
    constructor(conn: mysql2.PoolConnection) {
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
export class DatabaseConnection {
    config: mysql2.PoolOptions
    pool!: mysql2.Pool

    constructor(config: mysql2.PoolOptions) {
        this.config = config
    }

    async connect(): Promise<void> {
        this.pool = mysql2.createPool(this.config)
        await this.getConnection()
    }

    getConnection(): Promise<mysql2.PoolConnection> {
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

    async transaction<T>(
        callback: (t: TransactionContext) => Promise<T>
    ): Promise<T> {
        const conn = await this.getConnection()
        const transactionContext = new TransactionContext(conn)

        try {
            await transactionContext.execute("START TRANSACTION")
            const result = await callback(transactionContext)
            await transactionContext.execute("COMMIT")
            return result
        } catch (err) {
            await transactionContext.execute("ROLLBACK")
            throw err
        } finally {
            transactionContext.conn.release()
        }
    }

    query(queryStr: string, params?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pool.query(queryStr, params, (err, rows) => {
                if (err) {
                    console.log(`ERROR with query::\n${queryStr}\n::ERROR`)
                    return reject(err)
                }
                resolve(rows)
            })
        })
    }

    async get(queryStr: string, params?: any[]): Promise<any> {
        return (await this.query(queryStr, params))[0]
    }

    end(): void {
        this.pool.end()
    }
}
