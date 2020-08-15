// Misc non-SPA views
import { Router } from "express"
import filenamify from "filenamify"
import * as React from "react"
import { getConnection } from "typeorm"

import * as db from "db/db"
import {
    expectInt,
    tryInt,
    renderToHtmlPage,
    JsonError
} from "utils/server/serverUtil"
import { tryLogin } from "./authentication"
import { LoginPage } from "./LoginPage"
import { RegisterPage } from "./RegisterPage"
import { Dataset } from "db/model/Dataset"

import { User } from "db/model/User"
import { UserInvitation } from "db/model/UserInvitation"
import { renderPageById } from "site/server/siteBaking"
import { ENV } from "settings"
import { addExplorerAdminRoutes } from "dataExplorer/admin/ExplorerBaker"

const adminViews = Router()

// None of these should be google indexed
adminViews.use(async (req, res, next) => {
    res.set("X-Robots-Tag", "noindex")
    return next()
})

adminViews.get("/", async (req, res) => {
    // The second mode of Wordpress preview redirects
    // e.g. http://localhost:3030/admin/?p=22505&preview_id=22505&preview_nonce=93a5fc7eee&_thumbnail_id=22508&preview=true
    if (req.query.preview_id) {
        res.redirect(`/admin/posts/preview/${req.query.preview_id}`)
    } else {
        res.redirect(`/admin/charts`)
    }
})

adminViews.get("/login", async (req, res) => {
    res.send(renderToHtmlPage(<LoginPage next={req.query.next} />))
})
adminViews.post("/login", async (req, res) => {
    try {
        const session = await tryLogin(req.body.username, req.body.password)
        res.cookie("sessionid", session.id, {
            httpOnly: true,
            sameSite: "strict",
            secure: ENV === "production"
        })
        res.redirect(req.query.next || "/admin")
    } catch (err) {
        res.status(400).send(
            renderToHtmlPage(
                <LoginPage next={req.query.next} errorMessage={err.message} />
            )
        )
    }
})

adminViews.get("/logout", async (req, res) => {
    if (res.locals.user)
        await db.query(`DELETE FROM sessions WHERE session_key = ?`, [
            res.locals.session.id
        ])

    res.redirect("/admin")
})

adminViews.get("/register", async (req, res) => {
    if (res.locals.user) {
        res.redirect("/admin")
        return
    }

    let errorMessage: string | undefined
    let invite: UserInvitation | undefined
    try {
        // Delete all expired invites before continuing
        await UserInvitation.createQueryBuilder()
            .where("validTill < NOW()")
            .delete()
            .execute()

        invite = await UserInvitation.findOne({ code: req.query.code })
        if (!invite) {
            throw new JsonError("Invite code invalid or expired")
        }
    } catch (err) {
        errorMessage = err.message
        res.status(tryInt(err.code, 500))
    } finally {
        res.send(
            renderToHtmlPage(
                <RegisterPage
                    inviteEmail={invite && invite.email}
                    errorMessage={errorMessage}
                    body={req.query}
                />
            )
        )
    }
})

adminViews.post("/register", async (req, res) => {
    try {
        // Delete all expired invites before continuing
        await UserInvitation.createQueryBuilder()
            .where("validTill < NOW()")
            .delete()
            .execute()

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
            user.fullName = req.body.fullName
            user.createdAt = new Date()
            user.updatedAt = new Date()
            user.lastLogin = new Date()
            await user.setPassword(req.body.password)
            await manager.getRepository(User).save(user)

            // Remove the invite now that it has been used successfully
            await manager.remove(invite)
        })

        await tryLogin(req.body.email, req.body.password)
        res.redirect("/admin")
    } catch (err) {
        res.status(tryInt(err.code, 500))
        res.send(
            renderToHtmlPage(
                <RegisterPage errorMessage={err.message} body={req.body} />
            )
        )
    }
})

adminViews.get("/datasets/:datasetId.csv", async (req, res) => {
    const datasetId = expectInt(req.params.datasetId)

    const datasetName = (
        await db.get(`SELECT name FROM datasets WHERE id=?`, [datasetId])
    ).name
    res.attachment(filenamify(datasetName) + ".csv")

    return Dataset.writeCSV(datasetId, res)
})

adminViews.get("/datasets/:datasetId/downloadZip", async (req, res) => {
    const datasetId = expectInt(req.params.datasetId)

    res.attachment("additional-material.zip")

    const file = await db.get(
        `SELECT filename, file FROM dataset_files WHERE datasetId=?`,
        [datasetId]
    )
    res.send(file.file)
})

adminViews.get("/posts/preview/:postId", async (req, res) => {
    const postId = expectInt(req.params.postId)

    res.send(await renderPageById(postId, true))
})

addExplorerAdminRoutes(adminViews)

export { adminViews }
