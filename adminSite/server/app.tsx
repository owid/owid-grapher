// This import has side-effects to do with React import binding, keep it up here
import { ADMIN_SERVER_PORT, ADMIN_SERVER_HOST, ENV } from "settings"

import * as db from "db/db"
import * as wpdb from "db/wpdb"
import { log } from "serverUtils/log"

import express from "express"
require("express-async-errors")
import cookieParser from "cookie-parser"
const expressErrorSlack = require("express-error-slack")
import "reflect-metadata"
import { IndexPage } from "./pages/IndexPage"
import {
    authCloudflareSSOMiddleware,
    authMiddleware,
} from "./utils/authentication"
import { apiRouter } from "./apiRouter"
import { testPageRouter } from "./testPageRouter"
import { adminRouter } from "./adminRouter"
import { renderToHtmlPage } from "serverUtils/serverUtil"
import { SLACK_ERRORS_WEBHOOK_URL } from "serverSettings"

import * as React from "react"
import { publicApiRouter } from "./publicApiRouter"
import { mockSiteRouter } from "./mockSiteRouter"
import simpleGit from "simple-git"
import { GIT_CMS_DIR } from "gitCms/GitCmsConstants"

const app = express()

// since the server is running behind a reverse proxy (nginx), we need to "trust"
// the X-Forwarded-For header in order to get the real request IP
// https://expressjs.com/en/guide/behind-proxies.html
app.set("trust proxy", true)

// Parse cookies https://github.com/expressjs/cookie-parser
app.use(cookieParser())

app.use(express.urlencoded({ extended: true, limit: "50mb" }))

app.use("/admin/login", authCloudflareSSOMiddleware)

// Require authentication (only for /admin requests)
app.use(authMiddleware)

//app.use(express.urlencoded())

app.use("/api", publicApiRouter.router)

app.use("/admin/api", apiRouter.router)
app.use("/admin/test", testPageRouter)

app.use("/admin/build", express.static("dist/webpack"))
app.use("/admin/storybook", express.static(".storybook/build"))
app.use("/admin", adminRouter)

const getGitCmsBranchName = async () => {
    const git = simpleGit({
        baseDir: GIT_CMS_DIR,
        binary: "git",
        maxConcurrentProcesses: 1,
    })
    const branches = await git.branchLocal()
    const gitCmsBranchName = await branches.current
    return gitCmsBranchName
}

let gitCmsBranchName: string
// Default route: single page admin app
app.get("/admin/*", async (req, res) => {
    if (!gitCmsBranchName) gitCmsBranchName = await getGitCmsBranchName()
    res.send(
        renderToHtmlPage(
            <IndexPage
                username={res.locals.user.fullName}
                isSuperuser={res.locals.user.isSuperuser}
                gitCmsBranchName={gitCmsBranchName}
            />
        )
    )
})

// Send errors to Slack
// The middleware passes all errors onto the next error-handling middleware
if (SLACK_ERRORS_WEBHOOK_URL) {
    app.use(expressErrorSlack({ webhookUri: SLACK_ERRORS_WEBHOOK_URL }))
}

const IS_DEV = ENV === "development"
if (IS_DEV) app.use("/", mockSiteRouter)

// Give full error messages, including in production
app.use(async (err: any, req: any, res: express.Response, next: any) => {
    if (!res.headersSent) {
        res.status(err.status || 500)
        res.send({
            error: { message: err.stack || err, status: err.status || 500 },
        })
    } else {
        res.write(
            JSON.stringify({
                error: { message: err.stack || err, status: err.status || 500 },
            })
        )
        res.end()
    }
})

async function main() {
    try {
        await db.connect()

        // The Grapher should be able to work without Wordpress being set up.
        try {
            await wpdb.connect()
        } catch (error) {
            console.error(error)
            console.log(
                "Could not connect to Wordpress database. Continuing without Wordpress..."
            )
        }

        const server = app.listen(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST, () => {
            console.log(
                `owid-admin server started on ${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}`
            )
        })
        // Increase server timeout for long-running uploads
        server.timeout = 5 * 60 * 1000
    } catch (e) {
        log.error(e)
        process.exit(1)
    }
}

if (!module.parent) main()
