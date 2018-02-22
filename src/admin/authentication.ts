import * as express from 'express'
import * as db from '../db'

export interface CurrentUser {
    id: number
    name: string
    email: string
    fullName: string
    isSuperuser: boolean
}

export type Request = express.Request

export interface Response extends express.Response {
    locals: { user: CurrentUser }
}

export async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    let user: CurrentUser|undefined

    const sessionid = req.cookies['sessionid']
    if (sessionid) {
        const rows = await db.query(`SELECT * FROM django_session WHERE session_key = ?`, [sessionid])
        if (rows.length) {
            const sessionData = Buffer.from(rows[0].session_data, 'base64').toString('utf8')
            const session = JSON.parse(sessionData.split(":").slice(1).join(":"))

            user = (await db.query(`SELECT id, name, email, full_name as fullName, is_superuser as isSuperuser FROM users WHERE id = ?`, [session._auth_user_id]))[0]
        }
    }

    res.set('Cache-Control', 'public, max-age=1, must-revalidate')

    if (user) {
        res.locals.user = user
        return next()
    } else {
        return res.redirect('/grapher/admin/login')
    }
}