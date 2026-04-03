// Misc non-SPA views
import { Hono } from "hono"
import filenamify from "filenamify"
import { Writable } from "stream"
import { expectInt } from "../serverUtils/serverUtil.js"
import { logOut, AppVariables, HonoContext } from "./authentication.js"
import * as db from "../db/db.js"
import { writeDatasetCSV } from "../db/model/Dataset.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { renderExplorerPage } from "../baker/siteRenderers.js"
import { JsonError, parseIntOrUndefined, slugify } from "@ourworldindata/utils"
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

const adminRouter = new Hono<{ Variables: AppVariables }>()

// None of these should be google indexed
adminRouter.use("*", async (c, next) => {
    await next()
    c.header("X-Robots-Tag", "noindex")
})

adminRouter.get("/", async (c) => {
    return c.redirect(`/admin/charts`)
})

adminRouter.get("/logout", async (c: HonoContext) => {
    return logOut(c)
})

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

adminRouter.get("/errorTest.csv", async (c) => {
    // Add `table /admin/errorTest.csv?code=404` to test fetch download failures
    const code = parseIntOrUndefined(c.req.query("code") ?? "") ?? 400
    return c.text(`Simulating code ${code}`, code as any)
})

adminRouter.get("/nodeVersion", (c) => {
    return c.text(process.version)
})

const explorerAdminServer = new ExplorerAdminServer()

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersRoute}`,
    async (_, res, trx) => {
        res.json(await explorerAdminServer.getAllExplorersCommand(trx))
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersTagsRoute}`,
    async (_, res, trx) => {
        return res.send({
            explorers: await db.getExplorerTags(trx),
        } as any)
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
            const forceDatapage = req.query.forceDatapage
                ? req.query.forceDatapage === "true"
                : chart.forceDatapage
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    forceDatapage,
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

        // don't throw if no chart config is found since this is the case for
        // multi-dim data pages and we want to continue execution in that case
        const chart = await getChartConfigBySlug(trx, slug).catch(
            () => undefined
        )
        if (chart) {
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    chart.forceDatapage,
                    trx
                )
            res.send(previewDataPageOrGrapherPage)
            return
        }

        const mdd =
            (await getMultiDimDataPageBySlug(trx, slug, {
                onlyPublished: false,
            })) ?? (await getMultiDimDataPageByCatalogPath(trx, slug))
        if (mdd) {
            const renderedPage = await renderMultiDimDataPageFromConfig({
                knex: trx,
                slug: mdd.slug,
                config: mdd.config,
                isPreviewing: true,
            })
            res.send(renderedPage)
            return
        }

        throw new JsonError("No such chart", 404)
    }
)

export { adminRouter }
