import * as mysql from 'mysql'

export const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'dev_grapher'
})

db.connect()
