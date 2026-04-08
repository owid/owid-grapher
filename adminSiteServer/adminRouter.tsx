// Misc non-SPA views
import express, { Router } from "express"
import filenamify from "filenamify"
import { Writable } from "stream"
import { expectInt } from "../serverUtils/serverUtil.js"
import { logOut } from "./authentication.js"
import * as db from "../db/db.js"
import { writeDatasetCSV } from "../db/model/Dataset.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import {
    renderExplorerPage,
    renderSlideshowPage,
} from "../baker/siteRenderers.js"
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
import {
    DbPlainDataset,
    DbPlainSlideshow,
    SlideshowsTableName,
    SlideTemplate,
} from "@ourworldindata/types"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import {
    getMultiDimDataPageByCatalogPath,
    getMultiDimDataPageBySlug,
} from "../db/model/MultiDimDataPage.js"
import { renderMultiDimDataPageFromConfig } from "../baker/MultiDimBaker.js"
import { resolveSlideChartTypes } from "../baker/SlideshowBaker.js"
import { getImageMetadataByFilenames } from "../db/db.js"
import { getMinimalAuthorsByNames } from "../db/model/Gdoc/GdocBase.js"

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
            const forceDatapage = req.query.forceDatapage
                ? req.query.forceDatapage === "true"
                : chart.forceDatapage
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chart.config,
                    chart.id,
                    trx,
                    { forceDatapage }
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

getPlainRouteWithROTransaction(
    adminRouter,
    "/slideshows/:id/preview",
    async (req, res, trx) => {
        const id = expectInt(req.params.id)

        const slideshow = await trx<DbPlainSlideshow>(SlideshowsTableName)
            .where({ id })
            .first()

        if (!slideshow) {
            throw new JsonError(`No slideshow found for id ${id}`, 404)
        }

        const config =
            typeof slideshow.config === "string"
                ? JSON.parse(slideshow.config)
                : slideshow.config

        // Collect image filenames from slides
        const imageFilenames: string[] = []
        for (const slide of config.slides) {
            if (slide.template === SlideTemplate.Image && slide.filename) {
                imageFilenames.push(slide.filename)
            }
        }

        const imageMetadata =
            imageFilenames.length > 0
                ? await getImageMetadataByFilenames(trx, imageFilenames)
                : {}

        // Resolve author names to linked author pages
        const authorNames = config.authors
            ? config.authors
                  .split(",")
                  .map((n: string) => n.trim())
                  .filter(Boolean)
            : []
        const linkedAuthors =
            authorNames.length > 0
                ? await getMinimalAuthorsByNames(trx, authorNames)
                : []

        // Resolve chart types for slides
        const chartResolutions = await resolveSlideChartTypes(
            trx,
            config.slides
        )

        const html = await renderSlideshowPage(
            { title: slideshow.title, slug: slideshow.slug, config },
            imageMetadata,
            linkedAuthors,
            chartResolutions
        )
        res.send(html)
    }
)

export { adminRouter }
