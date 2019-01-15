import * as mysql from 'mysql'

export class DatabaseConnection {
    conn: mysql.Connection
    constructor(conn: mysql.Connection) {
        this.conn = conn
    }

    query(queryStr: string, params?: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.conn.query(queryStr, params, (err, rows) => {
                if (err) return reject(err)
                resolve(rows)
            })
        })
    }

    end() {
        this.conn.end()
    }
}

export function createConnection(props: { database: string }) {
    return new DatabaseConnection(mysql.createConnection({
        host: 'localhost',
        user: 'root',
        database: props.database,
        charset: 'utf8mb4'
    }))
}