import express, { Router } from "express"
import path from "path"
import {
    renderFrontPage,
    renderGdocsPageBySlug,
    renderPageBySlug,
    renderDataCatalogPage,
    renderSearchPage,
    renderDonatePage,
    makeAtomFeed,
    feedbackPage,
    renderNotFoundPage,
    renderBlogByPageNum,
    countryProfileCountryPage,
    renderExplorerPage,
    makeAtomFeedNoTopicPages,
    renderDynamicCollectionPage,
    renderTopChartsCollectionPage,
    renderDataInsightsIndexPage,
    renderThankYouPage,
    makeDataInsightsAtomFeed,
    renderGdocTombstone,
    renderExplorerIndexPage,
} from "../baker/siteRenderers.js"
import {
    BAKED_BASE_URL,
    BASE_DIR,
    LEGACY_WORDPRESS_IMAGE_URL,
} from "../settings/serverSettings.js"

import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import {
    countryProfilePage,
    countriesIndexPage,
} from "../baker/countryProfiles.js"
import { makeSitemap } from "../baker/sitemap.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { getVariableData, getVariableMetadata } from "../db/model/Variable.js"
import { MultiEmbedderTestPage } from "../site/multiembedder/MultiEmbedderTestPage.js"
import {
    DbRawChartConfig,
    JsonError,
    parseChartConfig,
    TombstonePageData,
    gdocUrlRegex,
    OwidGdocMinimalPostInterface,
    ImageMetadata,
} from "@ourworldindata/utils"
import {
    EXPLORERS_ROUTE_FOLDER,
    explorerUrlMigrationsById,
} from "@ourworldindata/explorer"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import {
    renderPreviewDataPageOrGrapherPage,
    renderDataPageV2,
} from "../baker/GrapherBaker.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { getTombstoneBySlug } from "../db/model/GdocTombstone.js"
import * as db from "../db/db.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import {
    getPlainRouteNonIdempotentWithRWTransaction,
    getPlainRouteWithROTransaction,
} from "./plainRouterHelpers.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/SiteConstants.js"
import { renderMultiDimDataPageBySlug } from "../baker/MultiDimBaker.js"
import {
    KnexReadonlyTransaction,
    getImageMetadataByFilenames,
} from "../db/db.js"
import { getMinimalGdocPostsByIds } from "../db/model/Gdoc/GdocBase.js"
import { getMultiDimDataPageBySlug } from "../db/model/MultiDimDataPage.js"

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("express-async-errors")

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/atom.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeed = await makeAtomFeed(trx)
        res.send(atomFeed)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/atom-no-topic-pages.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeedNoTopicPages = await makeAtomFeedNoTopicPages(trx)
        res.send(atomFeedNoTopicPages)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
    async (_, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeedDataInsights = await makeDataInsightsAtomFeed(trx)
        res.send(atomFeedDataInsights)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/sitemap.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const sitemap = await makeSitemap(explorerAdminServer, trx)
        res.send(sitemap)
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/data/:variableId.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        res.json((await getVariableData(expectInt(req.params.variableId))).data)
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/metadata/:variableId.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        const variableData = await getVariableData(
            expectInt(req.params.variableId)
        )
        res.json(variableData.metadata)
    }
)

mockSiteRouter.get("/assets/embedCharts.js", async (req, res) => {
    res.contentType("text/javascript").send(generateEmbedSnippet())
})

const explorerAdminServer = new ExplorerAdminServer()

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}`,
    async (_, res, trx) => {
        return res.send(await renderExplorerIndexPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}/:slug`,
    async (req, res, trx) => {
        res.set("Access-Control-Allow-Origin", "*")
        const explorers =
            await explorerAdminServer.getAllPublishedExplorers(trx)
        const explorerProgram = explorers.find(
            (program) => program.slug === req.params.slug
        )
        if (explorerProgram) {
            const explorerPage = await renderExplorerPage(explorerProgram, trx)

            res.send(explorerPage)
        } else
            throw new JsonError(
                "A published explorer with that slug was not found",
                404
            )
    }
)
getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/*",
    async (req, res, trx, next) => {
        const explorerRedirect = getExplorerRedirectForPath(req.path)
        // If no explorer redirect exists, continue to next express handler
        if (!explorerRedirect) return next!()

        const { migrationId, baseQueryStr } = explorerRedirect
        const { explorerSlug } = explorerUrlMigrationsById[migrationId]
        const program = await explorerAdminServer.getExplorerFromSlug(
            trx,
            explorerSlug
        )
        const explorerPage = await renderExplorerPage(program, trx, {
            urlMigrationSpec: {
                explorerUrlMigrationId: migrationId,
                baseQueryStr,
            },
        })
        res.send(explorerPage)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/collection/top-charts",
    async (_, res, trx) => {
        return res.send(await renderTopChartsCollectionPage(trx))
    }
)

mockSiteRouter.get("/collection/custom", async (_, res) => {
    return res.send(await renderDynamicCollectionPage())
})

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/by-uuid/:uuid.config.json",
    async (req, res, trx) => {
        const chartRow = await db.knexRawFirst<Pick<DbRawChartConfig, "full">>(
            trx,
            "SELECT full FROM chart_configs WHERE id = ?",
            [req.params.uuid]
        )
        if (!chartRow) throw new JsonError("No such chart", 404)
        const config = parseChartConfig(chartRow.full)
        res.json(config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug.config.json",
    async (req, res, trx) => {
        const chartRow = await getChartConfigBySlug(trx, req.params.slug)
        res.json(chartRow.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/multi-dim/:slug.json",
    async (req, res, trx) => {
        const multiDim = await getMultiDimDataPageBySlug(trx, req.params.slug)
        if (!multiDim) throw new JsonError("No such multi-dim", 404)
        res.json(multiDim.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug",
    async (req, res, trx) => {
        const chartRow = await getChartConfigBySlug(trx, req.params.slug).catch(
            console.error
        )
        if (chartRow) {
            // XXX add dev-prod parity for this
            res.set("Access-Control-Allow-Origin", "*")

            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(chartRow.config, trx)
            res.send(previewDataPageOrGrapherPage)
            return
        } else {
            const page = await renderMultiDimDataPageBySlug(
                trx,
                req.params.slug
            ).catch(console.error)
            if (page) {
                res.send(page)
                return
            }
        }

        throw new JsonError("No such chart", 404)
    }
)

getPlainRouteWithROTransaction(mockSiteRouter, "/", async (_, res, trx) => {
    const frontPage = await renderFrontPage(trx)
    res.send(frontPage)
})

getPlainRouteWithROTransaction(mockSiteRouter, "/donate", async (_, res, trx) =>
    res.send(await renderDonatePage(trx))
)

mockSiteRouter.get("/thank-you", async (req, res) =>
    res.send(await renderThankYouPage())
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/data-insights/:pageNumberOrSlug?",
    async (req, res, trx) => {
        const totalPageCount = calculateDataInsightIndexPageCount(
            await db.getPublishedDataInsightCount(trx)
        )
        async function renderIndexPage(pageNumber: number) {
            const dataInsights = await GdocDataInsight.getPublishedDataInsights(
                trx,
                pageNumber
            )
            // calling fetchImageMetadata 20 times makes me sad, would be nice if we could cache this
            await Promise.all(
                dataInsights.map((insight) => insight.loadState(trx))
            )
            return renderDataInsightsIndexPage(
                dataInsights,
                pageNumber,
                totalPageCount,
                true
            )
        }
        const pageNumberOrSlug = req.params.pageNumberOrSlug
        if (!pageNumberOrSlug) {
            return res.send(await renderIndexPage(0))
        }

        // pageNumber is 1-indexed, but DB operations are 0-indexed
        const pageNumber = parseInt(pageNumberOrSlug) - 1
        if (!isNaN(pageNumber)) {
            if (pageNumber <= 0 || pageNumber >= totalPageCount) {
                return res.redirect("/data-insights")
            }
            return res.send(await renderIndexPage(pageNumber))
        }

        try {
            return res.send(
                await renderGdocsPageBySlug(trx, pageNumberOrSlug, true)
            )
        } catch (e) {
            console.error(e)
            return res.status(404).send(renderNotFoundPage())
        }
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/data*",
    async (req, res, trx) => {
        res.send(await renderDataCatalogPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/datapage-preview/:id",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.id)
        const variableMetadata = await getVariableMetadata(variableId)

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

countryProfileSpecs.forEach((spec) =>
    getPlainRouteWithROTransaction(
        mockSiteRouter,
        `/${spec.rootPath}/:countrySlug`,
        async (req, res, trx) => {
            const countryPage = await countryProfileCountryPage(
                spec,
                req.params.countrySlug,
                trx
            )
            res.send(countryPage)
        }
    )
)

mockSiteRouter.get("/search", async (req, res) =>
    res.send(await renderSearchPage())
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/latest",
    async (_, res, trx) => {
        const latest = await renderBlogByPageNum(1, trx)
        res.send(latest)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/latest/page/:pageno",
    async (req, res, trx) => {
        const pagenum = parseInt(req.params.pageno, 10)
        if (!isNaN(pagenum)) {
            const latestPageNum = await renderBlogByPageNum(
                isNaN(pagenum) ? 1 : pagenum,
                trx
            )
            res.send(latestPageNum)
        } else throw new Error("invalid page number")
    }
)

mockSiteRouter.use(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    ["/uploads", "/app/uploads"],
    (req, res) => {
        const assetPath = req.path.replace(/^\/(app\/)?uploads\//, "")
        // Ensure no trailing slash on the base URL and manage the slash between URLs safely
        const baseUrl = LEGACY_WORDPRESS_IMAGE_URL.replace(/\/+$/, "")
        const path = assetPath.replace(/^\/+/, "")
        const assetUrl = `${baseUrl}/${path}`
        res.redirect(assetUrl)
    }
)

mockSiteRouter.use("/assets", express.static("dist/assets"))

mockSiteRouter.use(
    "/fonts",
    express.static(path.join(BASE_DIR, "public/fonts"), {
        setHeaders: (res) => {
            res.set("Access-Control-Allow-Origin", "*")
        },
    })
)

mockSiteRouter.use("/", express.static(path.join(BASE_DIR, "public")))

mockSiteRouter.get("/countries", async (req, res) =>
    res.send(await countriesIndexPage(BAKED_BASE_URL))
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/country/:countrySlug",
    async (req, res, trx) =>
        res.send(
            await countryProfilePage(
                trx,
                req.params.countrySlug,
                BAKED_BASE_URL
            )
        )
)

mockSiteRouter.get("/feedback", async (req, res) =>
    res.send(await feedbackPage())
)

mockSiteRouter.get("/multiEmbedderTest", async (req, res) =>
    res.send(
        renderToHtmlPage(
            MultiEmbedderTestPage(req.query.globalEntitySelector === "true")
        )
    )
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/dods.json",
    async (_, res, trx) => {
        res.set("Access-Control-Allow-Origin", "*")
        const { details, parseErrors } =
            await GdocPost.getDetailsOnDemandGdoc(trx)

        if (parseErrors.length) {
            console.error(
                `Error(s) parsing details: ${parseErrors
                    .map((e) => e.message)
                    .join(", ")}`
            )
        }
        res.send(details)
    }
)

getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/team/:authorSlug",
    async (req, res, trx) => {
        try {
            // We assume here that author slugs are unique across all gdocs (not
            // just author gdocs)
            const page = await renderGdocsPageBySlug(trx, req.params.authorSlug)
            res.send(page)
            return
        } catch (e) {
            console.error(e)
            res.status(404).send(renderNotFoundPage())
        }
    }
)

async function getTombstoneAttachments(
    knex: KnexReadonlyTransaction,
    { relatedLinkUrl, relatedLinkThumbnail }: TombstonePageData
) {
    const linkedGdocId = relatedLinkUrl?.match(gdocUrlRegex)?.[1]
    const linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    let linkedDocument: OwidGdocMinimalPostInterface | undefined
    let imageMetadata: Record<string, ImageMetadata> = {}
    if (linkedGdocId) {
        const posts = await getMinimalGdocPostsByIds(knex, [linkedGdocId])
        linkedDocument = posts[0]
        linkedDocuments[linkedGdocId] = linkedDocument
    }
    const imageFilename =
        relatedLinkThumbnail || linkedDocument?.["featured-image"]
    if (imageFilename) {
        imageMetadata = await getImageMetadataByFilenames(knex, [imageFilename])
    }
    return {
        imageMetadata,
        linkedCharts: {},
        linkedDocuments,
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/deleted/:tombstoneSlug",
    async (req, res, trx) => {
        const tombstone = await getTombstoneBySlug(
            trx,
            req.params.tombstoneSlug
        )
        if (!tombstone) {
            res.status(404).send(renderNotFoundPage())
            return
        }
        const attachments = await getTombstoneAttachments(trx, tombstone)
        res.status(404).send(await renderGdocTombstone(tombstone, attachments))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/topicTagGraph.json",
    async (req, res, trx) => {
        const headerMenu = await db.generateTopicTagGraph(trx)
        res.send(headerMenu)
    }
)

getPlainRouteWithROTransaction(mockSiteRouter, "/*", async (req, res, trx) => {
    // Remove leading and trailing slashes
    const slug = req.path.replace(/^\/|\/$/g, "")

    try {
        const page = await renderGdocsPageBySlug(trx, slug)
        res.send(page)
        return
    } catch (e) {
        console.error(e)
    }

    try {
        const page = await renderPageBySlug(slug, trx)
        res.send(page)
    } catch (e) {
        console.error(e)
        res.status(404).send(renderNotFoundPage())
    }
})

export { mockSiteRouter }
