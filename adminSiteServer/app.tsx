import React from "react"
import { simpleGit } from "simple-git"
import express, { NextFunction } from "express"
require("express-async-errors") // todo: why the require?
import cookieParser from "cookie-parser"
import "reflect-metadata"
import http from "http"
import Bugsnag from "@bugsnag/js"
import BugsnagPluginExpress from "@bugsnag/plugin-express"
import {
    ADMIN_SERVER_HOST,
    ADMIN_SERVER_PORT,
    BAKED_BASE_URL,
    BUGSNAG_NODE_API_KEY,
    ENV,
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
import { GdocsContentSource } from "@ourworldindata/utils"
import OwidGdocPage from "../site/gdocs/OwidGdocPage.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"

interface OwidAdminAppOptions {
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
        let bugsnagMiddleware

        const { app } = this

        if (BUGSNAG_NODE_API_KEY) {
            Bugsnag.start({
                apiKey: BUGSNAG_NODE_API_KEY,
                context: "admin-server",
                plugins: [BugsnagPluginExpress],
                autoTrackSessions: false,
            })
            bugsnagMiddleware = Bugsnag.getPlugin("express")
            // From the docs: "this must be the first piece of middleware in the
            // stack. It can only capture errors in downstream middleware"
            if (bugsnagMiddleware) app.use(bugsnagMiddleware.requestHandler)
        }

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

        app.use("/assets", express.static("dist/assets"))
        app.use("/fonts", express.static("public/fonts"))

        app.use("/api", publicApiRouter.router)
        app.use("/admin/api", apiRouter.router)
        app.use("/admin/test", testPageRouter)
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

        const adminExplorerServer = new ExplorerAdminServer(GIT_CMS_DIR)
        // Public preview of a Gdoc document
        app.get("/gdocs/:id/preview", async (req, res) => {
            const publishedExplorersBySlug =
                await adminExplorerServer.getAllPublishedExplorersBySlugCached()
            try {
                const gdoc = await GdocPost.load(
                    req.params.id,
                    publishedExplorersBySlug,
                    GdocsContentSource.Gdocs
                )
                res.set("X-Robots-Tag", "noindex")
                res.send(
                    renderToHtmlPage(
                        <OwidGdocPage
                            baseUrl={BAKED_BASE_URL}
                            gdoc={gdoc}
                            debug
                            isPreviewing
                        />
                    )
                )
            } catch (error) {
                console.error("Error fetching gdoc preview", error)
                res.status(500).json({
                    error: { message: String(error), status: 500 },
                })
            }
        })

        // From the docs: "this handles any errors that Express catches. This
        // needs to go before other error handlers. BugSnag will call the `next`
        // error handler if it exists.
        if (bugsnagMiddleware) app.use(bugsnagMiddleware.errorHandler)

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
        gitCmsDir: GIT_CMS_DIR,
        isDev: ENV === "development",
    }).startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
