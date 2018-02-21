import * as mysql from 'mysql'
import * as settings from './settings'
import * as path from 'path'

let conn: mysql.Connection

export function connect() {
    conn = mysql.createConnection({
        host: 'localhost',
        user: 'root',
        database: settings.DB_NAME
    })
}

export function transaction<T>(callback: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        conn.beginTransaction(err => {
            if (err) reject(err)

            callback().then((...args: any[]) => {
                conn.commit(err2 => {
                    if (err2) {
                        conn.rollback(() => {
                            reject(err2)
                        })
                    }
                    resolve(...args)
                })
            }).catch((err2) => {
                conn.rollback(() => {
                    reject(err2)
                })
            })
        })
    })
}

export function query(queryStr: string, params?: any[]): Promise<any> {
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

import {Sequelize, ISequelizeConfig, Table, Column, Model} from 'sequelize-typescript'
import {DB_NAME, DB_USER, DB_PASS} from './settings'

export const sequelize = new Sequelize({
    database: DB_NAME,
    username: DB_USER,
    password: DB_PASS,
    dialect: 'mysql',
    host: 'localhost',
    modelPaths: [path.join(__dirname, 'models')]
})
