import React from "react"
import simpleGit from "simple-git"
import express, { NextFunction } from "express"
import "express-async-errors"
import cookieParser from "cookie-parser"
import "reflect-metadata"
import * as http from "http"

import {
    ADMIN_SERVER_HOST,
    ADMIN_SERVER_PORT,
    ENV,
    SLACK_ERRORS_WEBHOOK_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import * as wpdb from "../db/wpdb.js"
import { IndexPage } from "./IndexPage.js"
import {
    authCloudflareSSOMiddleware,
    authMiddleware,
} from "./authentication.js"
import { apiRouter } from "./apiRouter.js"
import { testPageRouter } from "./testPageRouter.js"
import { adminRouter } from "./adminRouter.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"

import { publicApiRouter } from "./publicApiRouter.js"
import { mockSiteRouter } from "./mockSiteRouter.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"

import expressErrorSlack from "express-error-slack"

interface OwidAdminAppOptions {
    slackErrorsWebHookUrl?: string
    gitCmsDir: string
    isDev: boolean
    quiet?: boolean
}

export class OwidAdminApp {
    constructor(options: OwidAdminAppOptions) {
        this.options = options
    }

    app = express()
    private options: OwidAdminAppOptions

    private async getGitCmsBranchName() {
        const git = simpleGit({
            baseDir: this.options.gitCmsDir,
            binary: "git",
            maxConcurrentProcesses: 1,
        })
        const branches = await git.branchLocal()
        const gitCmsBranchName = await branches.current
        return gitCmsBranchName
    }

    private gitCmsBranchName = ""

    server?: http.Server
    async stopListening() {
        if (!this.server) return

        this.server.close()
    }

    async startListening(adminServerPort: number, adminServerHost: string) {
        this.gitCmsBranchName = await this.getGitCmsBranchName()
        const { app } = this

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

        app.use("/api", publicApiRouter.router)
        app.use("/admin/api", apiRouter.router)
        app.use("/admin/test", testPageRouter)
        app.use("/admin/assets", express.static("itsJustJavascript/webpack"))
        app.use("/admin/storybook", express.static(".storybook/build"))
        app.use("/admin", adminRouter)

        // Default route: single page admin app
        app.get("/admin/*", async (req, res) => {
            res.send(
                renderToHtmlPage(
                    <IndexPage
                        username={res.locals.user.fullName}
                        isSuperuser={res.locals.user.isSuperuser}
                        gitCmsBranchName={this.gitCmsBranchName}
                    />
                )
            )
        })

        // Send errors to Slack
        // The middleware passes all errors onto the next error-handling middleware
        if (this.options.slackErrorsWebHookUrl)
            app.use(
                expressErrorSlack({
                    webhookUri: this.options.slackErrorsWebHookUrl,
                })
            )

        // todo: we probably always want to have this, and can remove the isDev
        if (this.options.isDev) app.use("/", mockSiteRouter)

        // Give full error messages, including in production
        app.use(this.errorHandler)

        await this.connectToDatabases()

        this.server = await this.listenPromise(
            app,
            adminServerPort,
            adminServerHost
        )
        this.server.timeout = 5 * 60 * 1000 // Increase server timeout for long-running uploads

        if (!this.options.quiet)
            console.log(
                `owid-admin server started on http://${adminServerHost}:${adminServerPort}`
            )
    }

    // Server.listen does not seem to have an async/await form yet.
    // https://github.com/expressjs/express/pull/3675
    // https://github.com/nodejs/node/issues/21482
    private listenPromise(
        app: express.Express,
        adminServerPort: number,
        adminServerHost: string
    ): Promise<http.Server> {
        return new Promise((resolve) => {
            const server = app.listen(adminServerPort, adminServerHost, () => {
                resolve(server)
            })
        })
    }

    errorHandler = async (
        err: any,
        req: express.Request,
        res: express.Response,
        // keep `next` because Express only passes errors to handlers with 4 parameters.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next: NextFunction
    ) => {
        if (!res.headersSent) {
            res.status(err.status || 500)
            res.send({
                error: {
                    message: err.stack || err,
                    status: err.status || 500,
                },
            })
        } else {
            res.write(
                JSON.stringify({
                    error: {
                        message: err.stack || err,
                        status: err.status || 500,
                    },
                })
            )
            res.end()
        }
    }

    connectToDatabases = async () => {
        try {
            await db.getConnection()
        } catch (error) {
            // grapher database is in fact required, but we will not fail now in case it
            // comes online later
            if (!this.options.quiet) {
                console.error(error)
                console.warn(
                    "Could not connect to grapher database. Continuing without DB..."
                )
            }
        }

        if (wpdb.isWordpressDBEnabled) {
            try {
                await wpdb.singleton.connect()
            } catch (error) {
                if (!this.options.quiet) {
                    console.error(error)
                    console.warn(
                        "Could not connect to Wordpress database. Continuing without Wordpress..."
                    )
                }
            }
        } else if (!this.options.quiet) {
            console.log(
                "WORDPRESS_DB_NAME is not configured -- continuing without Wordpress DB"
            )
        }

        if (!wpdb.isWordpressAPIEnabled && !this.options.quiet) {
            console.log(
                "WORDPRESS_API_URL is not configured -- continuing without Wordpress API"
            )
        }
    }
}

if (!module.parent)
    new OwidAdminApp({
        slackErrorsWebHookUrl: SLACK_ERRORS_WEBHOOK_URL,
        gitCmsDir: GIT_CMS_DIR,
        isDev: ENV === "development",
    }).startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
