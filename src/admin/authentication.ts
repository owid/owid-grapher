import * as express from 'express'
import * as db from '../db'

const cookieParser = require('cookie-parser')

interface User {
    id: number
    name: string
    email: string
    fullName: string
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

export function authMiddleware(app: express.Express) {
    app.use(cookieParser())
}