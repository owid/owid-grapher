// Misc non-SPA views
import {Router} from 'express'
import * as filenamify from 'filenamify'
import * as React from 'react'
import {getConnection} from 'typeorm'

import * as db from '../db'
import {expectInt, tryInt, csvRow, renderToHtmlPage, JsonError} from './serverUtil'
import {tryLogin} from './authentication'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import {Dataset} from '../model/Dataset'

import User from '../model/User'
import UserInvitation from '../model/UserInvitation'

const adminViews = Router()

adminViews.get('/login', (req, res) => {
    res.send(renderToHtmlPage(<LoginPage next={req.query.next}/>))
})
adminViews.post('/login', async (req, res) => {
    try {
        const session = await tryLogin(req.body.username, req.body.password)
        res.cookie("sessionid", session.id)
        res.redirect(req.query.next||"/admin")
    } catch (err) {
        res.status(400).send(renderToHtmlPage(<LoginPage next={req.query.next} errorMessage={err.message}/>))
    }
})

adminViews.get('/logout', async (req, res) => {
    if (res.locals.user)
        await db.query(`DELETE FROM django_session WHERE session_key = ?`, [res.locals.session.id])

    res.redirect('/admin')
})

adminViews.get('/register', async (req, res) => {
    if (res.locals.user) {
        res.redirect('/admin')
        return
    }

    let errorMessage: string|undefined
    let invite: UserInvitation|undefined
    try {
        // Delete all expired invites before continuing
        await UserInvitation.createQueryBuilder().where("validTill < NOW()").delete().execute()

        invite = await UserInvitation.findOne({ code: req.query.code })
        if (!invite) {
            throw new JsonError("Invite code invalid or expired")
        }
    } catch (err) {
        errorMessage = err.message
        res.status(tryInt(err.code, 500))
    } finally {
        res.send(renderToHtmlPage(<RegisterPage inviteEmail={invite && invite.email} errorMessage={errorMessage} body={req.query}/>))
    }
})

adminViews.post('/register', async (req, res) => {
    try {
        // Delete all expired invites before continuing
        await UserInvitation.createQueryBuilder().where("validTill < NOW()").delete().execute()

        const invite = await UserInvitation.findOne({ code: req.body.code })
        if (!invite) {
            throw new JsonError("Invite code invalid or expired", 403)
        }

        if (req.body.password !== req.body.confirmPassword) {
            throw new JsonError("Passwords don't match!", 400)
        }

        await getConnection().transaction(async manager => {
            const user = new User()
            user.email = req.body.email
            user.name = req.body.username
            user.fullName = req.body.fullName
            user.created_at = new Date()
            user.updated_at = new Date()
            user.lastLogin = new Date()
            await user.setPassword(req.body.password)
            await manager.getRepository(User).save(user)

            // Remove the invite now that it has been used successfully
            await manager.remove(invite)
        })

        await tryLogin(req.body.email, req.body.password)
        res.redirect('/admin')
    } catch (err) {
        res.status(tryInt(err.code, 500))
        res.send(renderToHtmlPage(<RegisterPage errorMessage={err.message} body={req.body}/>))
    }
})


adminViews.get('/datasets/:datasetId.csv', async (req, res) => {
    const datasetId = expectInt(req.params.datasetId)

    const datasetName = (await db.get(`SELECT name FROM datasets WHERE id=?`, [datasetId])).name
    res.setHeader('Content-Disposition', `attachment; filename='${filenamify(datasetName)}.csv'`)

    return Dataset.writeCSV(datasetId, res)
})

export default adminViews
