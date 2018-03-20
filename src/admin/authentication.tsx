import * as React from 'react'
import * as express from 'express'
import * as crypto from 'crypto'
import * as randomstring from 'randomstring'

// Backwards compatibility
const hashers = require('node-django-hashers')

import * as db from '../db'
import { SECRET_KEY, SESSION_COOKIE_AGE } from '../settings'
import { renderToHtmlPage } from './serverUtil'
import LoginPage from './LoginPage'

export interface CurrentUser {
    id: number
    name: string
    email: string
    fullName: string
    isSuperuser: boolean
}

export type Request = express.Request

export interface Response extends express.Response {
    locals: { user: CurrentUser, session: Session }
}

export interface Session {
    id: string
    expiryDate: Date
}

export async function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    let user: CurrentUser|undefined
    let session: Session|undefined

    const sessionid = req.cookies['sessionid']
    if (sessionid) {
        const rows = await db.query(`SELECT * FROM django_session WHERE session_key = ?`, [sessionid])
        if (rows.length) {
            const sessionData = Buffer.from(rows[0].session_data, 'base64').toString('utf8')
            const sessionJson = JSON.parse(sessionData.split(":").slice(1).join(":"))

            user = (await db.query(`SELECT id, name, email, full_name as fullName, is_superuser as isSuperuser FROM users WHERE id = ?`, [sessionJson._auth_user_id]))[0]
            session = { id: sessionid, expiryDate: rows[0].expiry_date }
        }
    }

    // Authed urls shouldn't be cached
    res.set('Cache-Control', 'public, max-age=0, must-revalidate')

    if (user) {
        res.locals.session = session
        res.locals.user = user
        return next()
    //} else if (req.path === "/admin/login") {
    //    return next()
    } else {
        return res.redirect(`/grapher/admin/login?next=${req.path}`)
    }
}

export async function logout(req: Request, res: Response) {
    if (res.locals.user)
        await db.query(`DELETE FROM django_session WHERE session_key = ?`, [res.locals.session.id])
}

// Not actually using this for now, django server still handles it
async function tryLogin(email: string, password: string): Promise<Session> {
    const user = await db.get(`SELECT password FROM users WHERE email=?`, [email])
    if (!user) {
        throw new Error("No such user")
    }

    const h = new hashers.BCryptPasswordHasher()
    if (h.verify(password, user.password)) {
        const sessionId = randomstring.generate()

        const hmac = crypto.createHmac('sha256', SECRET_KEY)
        hmac.update(password)
        const sessionData = {
            _auth_user_id: user.id,
            _auth_user_backend: "django.contrib.auth.backends.ModelBackend",
            _auth_user_hash: hmac.digest('hex')
        }
        const sessionHash = JSON.stringify(sessionData)
        const sessionDataStr = `${sessionHash}:${sessionData}`

        const now = new Date()
        const expiryDate = new Date(now.getTime() + (1000*SESSION_COOKIE_AGE))

        db.query(`INSERT INTO django_session (session_key, session_data, expire_date) VALUES (?, ?, ?)`, [sessionId, sessionDataStr, expiryDate])

        return { id: sessionId, expiryDate: expiryDate }
    } else {
        throw new Error("Invalid password")
    }
}

export async function loginSubmit(req: Request, res: Response) {
    try {
        const session = await tryLogin(req.body.email, req.body.password)
        res.cookie("sessionid", session.id)
        res.send(renderToHtmlPage(<LoginPage errorMessage={"Success!"}/>))
    } catch (err) {
        res.status(400).send(renderToHtmlPage(<LoginPage errorMessage={err.message}/>))
    }
}