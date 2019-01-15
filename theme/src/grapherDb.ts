import {createConnection} from './database'
import {GRAPHER_DB_NAME} from './settings'

const db = createConnection({
    database: GRAPHER_DB_NAME
})

export async function query(queryStr: string, params?: any[]): Promise<any[]> {
    return db.query(queryStr, params)
}

export function end() {
    db.end()
}