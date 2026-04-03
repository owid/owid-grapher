import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import * as Sentry from "@sentry/node"
import { BAKED_BASE_URL, ENV } from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { IndexPage } from "./IndexPage.js"
import {
    AppVariables,
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
import { checkShouldProfileRender } from "../db/model/Gdoc/dataCallouts.js"
import type { Server } from "node:http"

interface OwidAdminAppOptions {
    isDev: boolean
    isTest?: boolean
    quiet?: boolean
}

export class OwidAdminApp {
    constructor(options: OwidAdminAppOptions) {
        this.options = options
    }

    app = new Hono<{ Variables: AppVariables }>()
    private readonly options: OwidAdminAppOptions

    server?: Server
    async stopListening() {
        if (!this.server) return

        this.server.close()
    }

    async startListening(adminServerPort: number, adminServerHost: string) {
        const { app } = this

        // Global error handler (replaces Sentry.setupExpressErrorHandler)
        app.onError((err, c) => {
            Sentry.captureException(err)
            console.error(err)
            const status = (err as any).status || 500
            return c.json(
                {
                    error: {
                        message: err.stack || String(err),
                        status,
                    },
                },
                status
            )
        })

        // Auth middleware for /admin/*
        app.use("/admin/*", apiKeyAuthMiddleware)

        if (ENV === "staging") {
            app.use("/admin/*", tailscaleAuthMiddleware)
        } else if (ENV === "production") {
            app.use("/admin/*", cloudflareAuthMiddleware)
        } else if (ENV === "development") {
            app.use("/admin/*", devAuthMiddleware)
        }

        // Require authentication (only for /admin requests)
        app.use("/admin/*", requireAdminAuthMiddleware)

        // Static files
        app.use("/assets/*", serveStatic({ root: "dist" }))
        app.use("/assets-admin/*", serveStatic({ root: "dist" }))
        app.use("/*", serveStatic({ root: "public" }))

        // Mount routers
        app.route("/api", publicApiRouter.app)
        app.route("/admin/api", apiRouter.app)
        app.route("/admin/test", testPageRouter)
        app.route("/admin", adminRouter)

        // Default route: single page admin app
        app.get("/admin/*", async (c) => {
            const user = c.get("user")
            return c.html(
                renderToHtmlPage(
                    <IndexPage
                        email={user.email}
                        username={user.fullName}
                        isSuperuser={!!user.isSuperuser}
                    />
                )
            )
        })

        // Public preview of a Gdoc document
        app.get("/gdocs/:id/preview", async (c) => {
            try {
                const acceptSuggestions =
                    c.req.query("acceptSuggestions") === "true"
                const id = c.req.param("id")
                const result = await db.knexReadonlyTransaction(
                    async (knex) => {
                        const gdoc = await getAndLoadGdocById(
                            knex,
                            id,
                            GdocsContentSource.Gdocs,
                            acceptSuggestions
                        )

                        // For profiles, instantiate with the selected entity
                        if (
                            gdoc.content.type === OwidGdocType.Profile &&
                            c.req.query("entity")
                        ) {
                            const entityCode = c.req.query("entity") as string
                            const entitiesInScope = getEntitiesForProfile(
                                gdoc.content.scope,
                                gdoc.content.exclude
                            )
                            const entityInScope = entitiesInScope.find(
                                (profileEntity) =>
                                    profileEntity.code === entityCode
                            )
                            if (!entityInScope) {
                                return c.text(
                                    "This entity is not in the profile scope.",
                                    404
                                )
                            }
                            const instantiatedProfile =
                                await instantiateProfileForEntity(
                                    gdoc as GdocProfile,
                                    entityInScope,
                                    { knex }
                                )

                            if (
                                !checkShouldProfileRender(
                                    instantiatedProfile.content
                                )
                            ) {
                                return c.text(
                                    "This profile has no renderable content for this entity. A profile will not be baked for it.",
                                    404
                                )
                            }

                            c.header("X-Robots-Tag", "noindex")
                            return c.html(
                                renderToHtmlPage(
                                    <OwidGdocPage
                                        baseUrl={BAKED_BASE_URL}
                                        gdoc={instantiatedProfile}
                                        debug
                                        isPreviewing
                                    />
                                )
                            )
                        }

                        c.header("X-Robots-Tag", "noindex")
                        return c.html(
                            renderToHtmlPage(
                                <OwidGdocPage
                                    baseUrl={BAKED_BASE_URL}
                                    gdoc={gdoc}
                                    debug
                                    isPreviewing
                                />
                            )
                        )
                    }
                )
                return result
            } catch (error) {
                console.error("Error fetching gdoc preview", error)
                return c.json(
                    { error: { message: String(error), status: 500 } },
                    500
                )
            }
        })

        if (this.options.isDev) {
            if (!this.options.isTest) {
                // https://vitejs.dev/guide/ssr
                // Vite dev server middleware - we mount it as a Hono middleware
                // that falls through to the underlying Node.js request/response
                const { createServer } = await import("vite")
                const vite = await createServer({
                    configFile: "vite.config-site.mts",
                    css: { devSourcemap: true },
                    server: { middlewareMode: true },
                    appType: "custom",
                    base: "/",
                })
                // Use Vite's connect-compatible middleware via the node server adapter
                app.use("/*", async (c, next) => {
                    const nodeReq = (c.env as any)?.incoming
                    const nodeRes = (c.env as any)?.outgoing
                    if (!nodeReq || !nodeRes) return next()

                    return new Promise<Response | void>((resolve) => {
                        vite.middlewares(nodeReq, nodeRes, () => {
                            resolve(next())
                        })
                    })
                })
            }
            // todo (DB): we probably always want to have this
            app.route("/", mockSiteRouter)
        }

        await this.connectToDatabases()

        this.server = serve(
            {
                fetch: app.fetch,
                port: adminServerPort,
                hostname: adminServerHost,
            },
            () => {
                if (!this.options.quiet)
                    console.log(
                        `owid-admin server started on http://${adminServerHost}:${adminServerPort}`
                    )
            }
        ) as unknown as Server
        this.server.timeout = 8 * 60 * 1000 // Increase server timeout for long-running uploads
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
