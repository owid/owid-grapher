import {createConnection} from './database'
import {DB_NAME} from '../../src/settings'

const db = createConnection({
    database: DB_NAME
})

export async function connect() {
    await db.conn.connect()
}

export async function query(queryStr: string, params?: any[]): Promise<any[]> {
    return db.query(queryStr, params)
}

export function end() {
    db.end()
}