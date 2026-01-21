import express, { NextFunction } from "express"
import * as Sentry from "@sentry/node"
import cookieParser from "cookie-parser"
import http from "http"
import { BAKED_BASE_URL, ENV } from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { IndexPage } from "./IndexPage.js"
import {
    apiKeyAuthMiddleware,
    cloudflareAuthMiddleware,
    tailscaleAuthMiddleware,
    devAuthMiddleware,
    requireAdminAuthMiddleware,
} from "./authentication.js"
import { apiRouter } from "./apiRouter.js"
import { testPageRouter } from "./testPageRouter.js"
import { adminRouter } from "./adminRouter.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"

import { publicApiRouter } from "./publicApiRouter.js"
import { mockSiteRouter } from "./mockSiteRouter.js"
import {
    GdocsContentSource,
    OwidGdocType,
    getEntitiesForProfile,
} from "@ourworldindata/utils"
import OwidGdocPage from "../site/gdocs/OwidGdocPage.js"
import { getAndLoadGdocById } from "../db/model/Gdoc/GdocFactory.js"
import {
    instantiateProfileForEntity,
    GdocProfile,
} from "../db/model/Gdoc/GdocProfile.js"

interface OwidAdminAppOptions {
    isDev: boolean
    isTest?: boolean
    quiet?: boolean
}

export class OwidAdminApp {
    constructor(options: OwidAdminAppOptions) {
        this.options = options
    }

    app = express()
    private options: OwidAdminAppOptions

    server?: http.Server
    async stopListening() {
        if (!this.server) return

        this.server.close()
    }

    async startListening(adminServerPort: number, adminServerHost: string) {
        const { app } = this

        // since the server is running behind a reverse proxy (nginx), we need to "trust"
        // the X-Forwarded-For header in order to get the real request IP
        // https://expressjs.com/en/guide/behind-proxies.html
        app.set("trust proxy", true)

        // Parse cookies https://github.com/expressjs/cookie-parser
        app.use(cookieParser())

        app.use(express.urlencoded({ extended: true, limit: "50mb" }))

        app.use("/admin", apiKeyAuthMiddleware)

        if (ENV === "staging") {
            app.use("/admin", tailscaleAuthMiddleware)
        } else if (ENV === "production") {
            app.use("/admin", cloudflareAuthMiddleware)
        } else if (ENV === "development") {
            app.use("/admin", devAuthMiddleware)
        }

        // Require authentication (only for /admin requests)
        app.use("/admin", requireAdminAuthMiddleware)

        app.use("/", express.static("public"))
        app.use("/assets", express.static("dist/assets"))
        app.use("/assets-admin", express.static("dist/assets-admin"))

        app.use("/api", publicApiRouter.router)
        app.use("/admin/api", apiRouter.router)
        app.use("/admin/test", testPageRouter)
        app.use("/admin", adminRouter)

        // Default route: single page admin app
        app.get("/admin/{*splat}", async (req, res) => {
            res.send(
                renderToHtmlPage(
                    <IndexPage
                        email={res.locals.user.email}
                        username={res.locals.user.fullName}
                        isSuperuser={res.locals.user.isSuperuser}
                    />
                )
            )
        })

        // Public preview of a Gdoc document
        app.get("/gdocs/:id/preview", async (req, res) => {
            try {
                const acceptSuggestions = req.query.acceptSuggestions === "true"
                await db.knexReadonlyTransaction(async (knex) => {
                    const gdoc = await getAndLoadGdocById(
                        knex,
                        req.params.id,
                        GdocsContentSource.Gdocs,
                        acceptSuggestions
                    )

                    // For profiles, instantiate with the selected entity
                    if (
                        gdoc.content.type === OwidGdocType.Profile &&
                        req.query.entity
                    ) {
                        const entityCode = req.query.entity as string
                        const entitiesInScope = getEntitiesForProfile(
                            gdoc as GdocProfile
                        )
                        const entityInScope = entitiesInScope.find(
                            (profileEntity) => profileEntity.code === entityCode
                        )
                        if (entityInScope) {
                            const instantiatedProfile =
                                instantiateProfileForEntity(
                                    gdoc as GdocProfile,
                                    entityInScope
                                )
                            res.set("X-Robots-Tag", "noindex")
                            res.send(
                                renderToHtmlPage(
                                    <OwidGdocPage
                                        baseUrl={BAKED_BASE_URL}
                                        gdoc={instantiatedProfile}
                                        debug
                                        isPreviewing
                                    />
                                )
                            )
                            return
                        }

                        if (!entityInScope) {
                            res.status(404).send(
                                "Profile preview not available for this entity."
                            )
                            return
                        }
                    }

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
                })
            } catch (error) {
                console.error("Error fetching gdoc preview", error)
                res.status(500).json({
                    error: { message: String(error), status: 500 },
                })
            }
        })

        if (this.options.isDev) {
            if (!this.options.isTest) {
                // https://vitejs.dev/guide/ssr
                const { createServer } = await import("vite")
                const vite = await createServer({
                    configFile: "vite.config-site.mts",
                    css: { devSourcemap: true },
                    server: { middlewareMode: true },
                    appType: "custom",
                    base: "/",
                })
                app.use(vite.middlewares)
            }
            // todo (DB): we probably always want to have this
            app.use("/", mockSiteRouter)
        }

        // Add this after all routes, but before any other error-handling
        // middlewares are defined.
        Sentry.setupExpressErrorHandler(app)

        // Give full error messages, including in production
        app.use(this.errorHandler)

        await this.connectToDatabases()

        this.server = await this.listenPromise(
            app,
            adminServerPort,
            adminServerHost
        )
        this.server.timeout = 8 * 60 * 1000 // Increase server timeout for long-running uploads

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
            const _ = db.knexInstance()
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
    }
}
