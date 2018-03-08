import * as mysql from 'mysql'
import * as settings from './settings'
import * as path from 'path'

import {DB_NAME, DB_USER, DB_PASS} from './settings'

let pool: mysql.Pool

export function connect() {
    pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        database: settings.DB_NAME
    })
}

export function transaction<T>(callback: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        pool.getConnection((poolerr, conn) => {
            if (poolerr) {
                reject(poolerr)
                return
            }

            conn.beginTransaction(err => {
                if (err) {
                    reject(err)
                    conn.release()
                    return
                }

                callback().then((...args: any[]) => {
                    conn.commit(err2 => {
                        if (err2) {
                            conn.rollback(() => {
                                reject(err2)
                                conn.release()
                            })
                        }
                        resolve(...args)
                        conn.release()
                    })
                }).catch((err2) => {
                    conn.rollback(() => {
                        reject(err2)
                        conn.release()
                    })
                })
            })
        })
    })
}

export function query(queryStr: string, params?: any[]): Promise<any> {
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

export function end() {
    pool.end()
}


