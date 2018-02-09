import * as express from 'express'
import { uniq } from 'lodash'
import { ChartConfigProps } from '../js/charts/ChartConfig'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as db from './db'

const cookieParser = require('cookie-parser')

const app = express()
app.use(cookieParser())
app.use(express.json())
db.connect()

interface User {
    id: number
    name: string
    email: string
    fullName: string
}

interface Request extends express.Request {
    user: User
}

async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
    let user: User|undefined

    const sessionid = req.cookies['sessionid']
    if (sessionid) {
        const rows = await db.query(`SELECT * FROM django_session WHERE session_key = ?`, [sessionid])
        if (rows.length) {
            const sessionData = Buffer.from(rows[0].session_data, 'base64').toString('utf8')
            const session = JSON.parse(sessionData.split(":").slice(1).join(":"))

            const userRows = await db.query(`SELECT * FROM users WHERE id = ?`, [session._auth_user_id])
            if (userRows.length) {
                const row = userRows[0]
                user = {
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    fullName: row.full_name
                }
            }
        }
    }

    if (user) {
        res.locals.user = user
        return next()
    } else {
        return res.redirect('/grapher/admin/login')
    }
}

app.use(authenticate)

// Default route: single page admin app
app.get('*', (req, res) => {
    console.log(res.locals.user)
    const baseUrl = "http://l:3000/grapher"
    const cacheTag = "waffles"
    const currentUser = "jaiden"
    const isDebug = true

    res.send("testtt")
})


app.listen(3000, () => console.log("Express started"))
