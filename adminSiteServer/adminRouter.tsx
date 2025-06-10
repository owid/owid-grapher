// Misc non-SPA views
import express, { Router } from "express"
import filenamify from "filenamify"
import { Writable } from "stream"
import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import {
    getSafeRedirectUrl,
    logInWithCredentials,
    logOut,
} from "./authentication.js"
import { LoginPage } from "./LoginPage.js"
import * as db from "../db/db.js"
import { writeDatasetCSV } from "../db/model/Dataset.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { renderExplorerPage } from "../baker/siteRenderers.js"
import {
    JsonError,
    parseIntOrUndefined,
    slugify,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_PREVIEW_ROUTE,
    GetAllExplorersRoute,
    GetAllExplorersTagsRoute,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import {
    renderDataPageV2,
    renderPreviewDataPageOrGrapherPage,
} from "../baker/GrapherBaker.js"
import { getChartConfigById, getChartConfigBySlug } from "../db/model/Chart.js"
import { getVariableMetadata } from "../db/model/Variable.js"
import { DbPlainDataset } from "@ourworldindata/types"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import {
    getMultiDimDataPageByCatalogPath,
    getMultiDimDataPageBySlug,
} from "../db/model/MultiDimDataPage.js"
import { renderMultiDimDataPageFromConfig } from "../baker/MultiDimBaker.js"

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("express-async-errors")

const adminRouter = Router()

// Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
adminRouter.use(express.json({ limit: "50mb" }))

// None of these should be google indexed
adminRouter.use(async (req, res, next) => {
    res.set("X-Robots-Tag", "noindex")
    return next()
})

adminRouter.get("/", async (req, res) => {
    res.redirect(`/admin/charts`)
})

adminRouter.get("/login", async (req, res) => {
    res.send(renderToHtmlPage(<LoginPage next={req.query.next as string} />))
})
adminRouter.post("/login", async (req, res) => {
    try {
        const session = await logInWithCredentials(
            req.body.username,
            req.body.password
        )
        // secure cookie when using https
        // (our staging servers use http and passing insecure cookie wouldn't work)
        const secure = req.protocol === "https"

        res.cookie("sessionid", session.id, {
            httpOnly: true,
            sameSite: "lax",
            secure: secure,
        })
        res.redirect(getSafeRedirectUrl(req.query.next as string | undefined))
    } catch (err) {
        res.status(400).send(
            renderToHtmlPage(
                <LoginPage
                    next={req.query.next as string}
                    errorMessage={stringifyUnknownError(err)}
                />
            )
        )
    }
})

adminRouter.get("/logout", logOut)

getPlainRouteWithROTransaction(
    adminRouter,
    "/datasets/:datasetId.csv",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const datasetName = (
            await db.knexRawFirst<Pick<DbPlainDataset, "name">>(
                trx,
                `SELECT name FROM datasets WHERE id=?`,
                [datasetId]
            )
        )?.name

        res.attachment(filenamify(datasetName!) + ".csv")

        const writeStream = new Writable({
            write(chunk, encoding, callback) {
                res.write(chunk.toString())
                callback(null)
            },
        })
        await writeDatasetCSV(trx, datasetId, writeStream)
        res.end()
    }
)

adminRouter.get("/errorTest.csv", async (req, res) => {
    // Add `table /admin/errorTest.csv?code=404` to test fetch download failures
    const code = parseIntOrUndefined(req.query.code as string) ?? 400

    res.status(code)

    return `Simulating code ${code}`
})

adminRouter.get("/nodeVersion", (req, res) => {
    res.send(process.version)
})

const explorerAdminServer = new ExplorerAdminServer()

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersRoute}`,
    async (_, res, trx) => {
        res.send(await explorerAdminServer.getAllExplorersCommand(trx))
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersTagsRoute}`,
    async (_, res, trx) => {
        return res.send({
            explorers: await db.getExplorerTags(trx),
        })
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${EXPLORERS_PREVIEW_ROUTE}/:slug`,
    async (req, res, knex) => {
        const slug = slugify(req.params.slug)

        if (slug === DefaultNewExplorerSlug)
            return renderExplorerPage(
                new ExplorerProgram(DefaultNewExplorerSlug, ""),
                knex,
                { isPreviewing: true }
            )
        const explorer = await explorerAdminServer.getExplorerFromSlug(
            knex,
            slug
        )
        const explorerPage = await renderExplorerPage(explorer, knex, {
            isPreviewing: true,
        })

        return res.send(explorerPage)
    }
)
getPlainRouteWithROTransaction(
    adminRouter,
    "/datapage-preview/:id",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.id)
        const variableMetadata = await getVariableMetadata(variableId)
        if (!variableMetadata) throw new JsonError("No such variable", 404)

        res.send(
            await renderDataPageV2(
                {
                    variableId,
                    variableMetadata,
                    isPreviewing: true,
                    useIndicatorGrapherConfigs: true,
                },
                trx
            )
        )
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/charts/:id/preview",
    async (req, res, trx) => {
        const chartId = expectInt(req.params.id)
        const chart = await getChartConfigById(trx, chartId)
        if (chart) {
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    trx
                )
            res.send(previewDataPageOrGrapherPage)
            return
        }

        throw new JsonError("No such chart", 404)
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/grapher/:slug",
    async (req, res, trx) => {
        const { slug } = req.params
        console.log(`[DEBUG] /grapher/${slug} - Starting request`)
        console.time(`grapher-${slug}-total`)

        // don't throw if no chart config is found since this is the case for
        // multi-dim data pages and we want to continue execution in that case
        console.log(`[DEBUG] /grapher/${slug} - Checking for chart config`)
        console.time(`grapher-${slug}-chart-lookup`)
        const chart = await getChartConfigBySlug(trx, slug).catch(() => {
            console.log(`[DEBUG] /grapher/${slug} - No chart config found`)
            return undefined
        })
        console.timeEnd(`grapher-${slug}-chart-lookup`)

        if (chart) {
            console.log(
                `[DEBUG] /grapher/${slug} - Found chart config, rendering chart page`
            )
            console.time(`grapher-${slug}-chart-render`)
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    trx
                )
            console.timeEnd(`grapher-${slug}-chart-render`)
            console.timeEnd(`grapher-${slug}-total`)
            console.log(
                `[DEBUG] /grapher/${slug} - Chart page rendered successfully`
            )
            res.send(previewDataPageOrGrapherPage)
            return
        }

        console.log(
            `[DEBUG] /grapher/${slug} - Looking for multi-dim data page by slug`
        )
        console.time(`grapher-${slug}-mdim-slug-lookup`)
        const mdd =
            (await getMultiDimDataPageBySlug(trx, slug, {
                onlyPublished: false,
            })) ?? (await getMultiDimDataPageByCatalogPath(trx, slug))
        console.timeEnd(`grapher-${slug}-mdim-slug-lookup`)
        if (mdd) {
            console.log(
                `[DEBUG] /grapher/${slug} - Found multi-dim data page, starting render`
            )
            console.time(`grapher-${slug}-mdim-render`)
            try {
                const renderedPage = await renderMultiDimDataPageFromConfig({
                    knex: trx,
                    slug: mdd.slug,
                    config: mdd.config,
                    isPreviewing: true,
                })
                console.timeEnd(`grapher-${slug}-mdim-render`)
                console.timeEnd(`grapher-${slug}-total`)
                console.log(
                    `[DEBUG] /grapher/${slug} - Multi-dim page rendered successfully`
                )
                res.send(renderedPage)
                return
            } catch (error) {
                console.timeEnd(`grapher-${slug}-mdim-render`)
                console.timeEnd(`grapher-${slug}-total`)
                console.error(
                    `[ERROR] /grapher/${slug} - Error rendering multi-dim page:`,
                    error
                )
                throw error
            }
        }

        console.log(
            `[DEBUG] /grapher/${slug} - No chart or multi-dim data page found`
        )
        console.timeEnd(`grapher-${slug}-total`)
        throw new JsonError("No such chart", 404)
    }
)

export { adminRouter }
