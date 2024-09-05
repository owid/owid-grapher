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
} from "../baker/siteRenderers.js"
import {
    BAKED_BASE_URL,
    BASE_DIR,
    BAKED_SITE_DIR,
    LEGACY_WORDPRESS_IMAGE_URL,
} from "../settings/serverSettings.js"

import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import {
    countryProfilePage,
    countriesIndexPage,
} from "../baker/countryProfiles.js"
import { makeSitemap } from "../baker/sitemap.js"
import {
    getChartConfigBySlug,
    getChartVariableData,
} from "../db/model/Chart.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { grapherToSVG } from "../baker/GrapherImageBaker.js"
import { getVariableData, getVariableMetadata } from "../db/model/Variable.js"
import { MultiEmbedderTestPage } from "../site/multiembedder/MultiEmbedderTestPage.js"
import {
    DbRawChartConfig,
    JsonError,
    parseChartConfig,
} from "@ourworldindata/utils"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { explorerUrlMigrationsById } from "../explorer/urlMigrations/ExplorerUrlMigrations.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import {
    renderPreviewDataPageOrGrapherPage,
    renderDataPageV2,
} from "../baker/GrapherBaker.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import * as db from "../db/db.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import {
    getPlainRouteNonIdempotentWithRWTransaction,
    getPlainRouteWithROTransaction,
} from "./plainRouterHelpers.js"
import { DEFAULT_LOCAL_BAKE_DIR } from "../site/SiteConstants.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/gdocs/utils.js"
import { renderMultiDimDataPageBySlug } from "../baker/MultiDimBaker.js"

require("express-async-errors")

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/atom.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeed = await makeAtomFeed(trx)
        res.send(atomFeed)
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/atom-no-topic-pages.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeedNoTopicPages = await makeAtomFeedNoTopicPages(trx)
        res.send(atomFeedNoTopicPages)
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    `/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
    async (_, res) => {
        res.set("Content-Type", "application/xml")
        const atomFeedDataInsights = await db.knexReadWriteTransaction((knex) =>
            makeDataInsightsAtomFeed(knex)
        )
        res.send(atomFeedDataInsights)
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
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

const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}/:slug`,
    async (req, res, trx) => {
        res.set("Access-Control-Allow-Origin", "*")
        const explorers = await explorerAdminServer.getAllPublishedExplorers()
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
        const program =
            await explorerAdminServer.getExplorerFromSlug(explorerSlug)
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
// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
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

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/",
    async (req, res, trx) => {
        const frontPage = await renderFrontPage(trx)
        res.send(frontPage)
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/donate",
    async (req, res, trx) => res.send(await renderDonatePage(trx))
)

mockSiteRouter.get("/thank-you", async (req, res) =>
    res.send(await renderThankYouPage())
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
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

        const slug = pageNumberOrSlug
        try {
            return res.send(await renderGdocsPageBySlug(trx, slug, true))
        } catch (e) {
            console.error(e)
        }

        return new JsonError(`Data insight with slug "${slug}" not found`, 404)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/charts*",
    async (req, res, trx) => {
        console.log("returning charts page")
        res.send(await renderDataCatalogPage(trx))
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
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

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/latest",
    async (req, res, trx) => {
        const latest = await renderBlogByPageNum(1, trx)
        res.send(latest)
    }
)

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
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
    "/images/published",
    express.static(path.join(DEFAULT_LOCAL_BAKE_DIR, "images/published"), {
        fallthrough: false,
    })
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
mockSiteRouter.use(
    "/exports",
    express.static(path.join(BAKED_SITE_DIR, "exports"))
)

mockSiteRouter.use("/assets", express.static("dist/assets"))

// TODO: this used to be a mockSiteRouter.use call but otherwise it looked like a route and
// it didn't look like it was making use of any middleware - if this causese issues then
// this has to be reverted to a use call
getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/exports/:slug.svg",
    async (req, res, trx) => {
        const grapher = await getChartConfigBySlug(trx, req.params.slug)
        const vardata = await getChartVariableData(grapher.config)
        res.setHeader("Content-Type", "image/svg+xml")
        res.send(await grapherToSVG(grapher.config, vardata))
    }
)

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

// TODO: this transaction is only RW because somewhere inside it we fetch images
getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/*",
    async (req, res, trx) => {
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
    }
)

export { mockSiteRouter }
