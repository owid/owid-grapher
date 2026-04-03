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
    async (c, trx) => {
        const datasetId = expectInt(c.req.param("datasetId")!)

        const datasetName = (
            await db.knexRawFirst<Pick<DbPlainDataset, "name">>(
                trx,
                `SELECT name FROM datasets WHERE id=?`,
                [datasetId]
            )
        )?.name

        c.header(
            "Content-Disposition",
            `attachment; filename="${filenamify(datasetName!) + ".csv"}"`
        )

        // For streaming CSV, we use a Node.js writable stream that collects
        // chunks, then return the full response.
        let csvContent = ""
        const writeStream = new Writable({
            write(chunk, _encoding, callback) {
                csvContent += chunk.toString()
                callback(null)
            },
        })
        await writeDatasetCSV(trx, datasetId, writeStream)
        return c.text(csvContent)
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
    async (_c, trx) => {
        return _c.json(await explorerAdminServer.getAllExplorersCommand(trx))
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersTagsRoute}`,
    async (c, trx) => {
        return c.json({
            explorers: await db.getExplorerTags(trx),
        })
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${EXPLORERS_PREVIEW_ROUTE}/:slug`,
    async (c, trx) => {
        const slug = slugify(c.req.param("slug")!)

        if (slug === DefaultNewExplorerSlug) {
            const page = await renderExplorerPage(
                new ExplorerProgram(DefaultNewExplorerSlug, ""),
                trx,
                { isPreviewing: true }
            )
            return c.html(page)
        }
        const explorer = await explorerAdminServer.getExplorerFromSlug(
            trx,
            slug
        )
        const explorerPage = await renderExplorerPage(explorer, trx, {
            isPreviewing: true,
        })
        return c.html(explorerPage)
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/datapage-preview/:id",
    async (c, trx) => {
        const variableId = expectInt(c.req.param("id")!)
        const variableMetadata = await getVariableMetadata(variableId)
        if (!variableMetadata) throw new JsonError("No such variable", 404)

        return c.html(
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
    async (c, trx) => {
        const chartId = expectInt(c.req.param("id")!)
        const chart = await getChartConfigById(trx, chartId)
        if (chart) {
            const forceDatapage = c.req.query("forceDatapage")
                ? c.req.query("forceDatapage") === "true"
                : chart.forceDatapage
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    forceDatapage,
                    trx
                )
            return c.html(previewDataPageOrGrapherPage)
        }

        throw new JsonError("No such chart", 404)
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/grapher/:slug",
    async (c, trx) => {
        const slug = c.req.param("slug")!

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
            return c.html(previewDataPageOrGrapherPage)
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
            return c.html(renderedPage)
        }

        throw new JsonError("No such chart", 404)
    }
)

export { adminRouter }
