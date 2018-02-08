import * as mysql from 'mysql'
import * as settings from './settings'

let conn: mysql.Connection

export function connect() {
    conn = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        database: settings.DB_NAME
    })
}

export function query(queryStr: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
        conn.query(queryStr, params, (err, rows) => {
            if (err) return reject(err)
            resolve(rows)
        })
    })
}

export function end() {
    conn.end()
}