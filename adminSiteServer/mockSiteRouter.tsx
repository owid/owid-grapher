import express, { Router } from "express"
import path from "path"
import {
    renderFrontPage,
    renderGdocsPageBySlug,
    renderPageBySlug,
    renderChartsPage,
    renderMenuJson,
    renderSearchPage,
    renderDonatePage,
    entriesByYearPage,
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
} from "../baker/siteRenderers.js"
import {
    BAKED_BASE_URL,
    WORDPRESS_DIR,
    BASE_DIR,
    BAKED_SITE_DIR,
} from "../settings/serverSettings.js"

import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import {
    countryProfilePage,
    countriesIndexPage,
} from "../baker/countryProfiles.js"
import { makeSitemap } from "../baker/sitemap.js"
import { Chart, OldChart } from "../db/model/Chart.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { grapherToSVG } from "../baker/GrapherImageBaker.js"
import { getVariableData, getVariableMetadata } from "../db/model/Variable.js"
import { MultiEmbedderTestPage } from "../site/multiembedder/MultiEmbedderTestPage.js"
import { JsonError } from "@ourworldindata/utils"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { isWordpressAPIEnabled } from "../db/wpdb.js"
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

require("express-async-errors")

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

mockSiteRouter.get("/sitemap.xml", async (req, res) => {
    res.set("Content-Type", "application/xml")
    const sitemap = await db
        .knexInstance()
        .transaction(async (knex) => makeSitemap(explorerAdminServer, knex))
    res.send(sitemap)
})

mockSiteRouter.get("/atom.xml", async (req, res) => {
    res.set("Content-Type", "application/xml")
    const atomFeed = await db
        .knexInstance()
        .transaction(async (knex) => makeAtomFeed(knex))
    res.send(atomFeed)
})

mockSiteRouter.get("/atom-no-topic-pages.xml", async (req, res) => {
    res.set("Content-Type", "application/xml")
    const atomFeedNoTopicPages = await db
        .knexInstance()
        .transaction(async (knex) => makeAtomFeedNoTopicPages(knex))
    res.send(atomFeedNoTopicPages)
})

mockSiteRouter.get("/entries-by-year", async (req, res) =>
    res.send(await entriesByYearPage())
)

mockSiteRouter.get(`/entries-by-year/:year`, async (req, res) =>
    res.send(await entriesByYearPage(parseInt(req.params.year)))
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

mockSiteRouter.get("/grapher/embedCharts.js", async (req, res) => {
    res.contentType("text/javascript").send(generateEmbedSnippet())
})

const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)

mockSiteRouter.get(`/${EXPLORERS_ROUTE_FOLDER}/:slug`, async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*")
    const explorers = await explorerAdminServer.getAllPublishedExplorers()
    const explorerProgram = explorers.find(
        (program) => program.slug === req.params.slug
    )
    if (explorerProgram) {
        const explorerPage = await db
            .knexInstance()
            .transaction(async (knex) => {
                return renderExplorerPage(explorerProgram, knex)
            })

        res.send(explorerPage)
    } else
        throw new JsonError(
            "A published explorer with that slug was not found",
            404
        )
})
mockSiteRouter.get("/*", async (req, res, next) => {
    const explorerRedirect = getExplorerRedirectForPath(req.path)
    // If no explorer redirect exists, continue to next express handler
    if (!explorerRedirect) return next()

    const { migrationId, baseQueryStr } = explorerRedirect
    const { explorerSlug } = explorerUrlMigrationsById[migrationId]
    const program = await explorerAdminServer.getExplorerFromSlug(explorerSlug)
    const explorerPage = await db.knexInstance().transaction(async (knex) => {
        return renderExplorerPage(program, knex, {
            explorerUrlMigrationId: migrationId,
            baseQueryStr,
        })
    })
    res.send(explorerPage)
})

mockSiteRouter.get("/collection/top-charts", async (_, res) => {
    return res.send(await renderTopChartsCollectionPage())
})

mockSiteRouter.get("/collection/custom", async (_, res) => {
    return res.send(await renderDynamicCollectionPage())
})

mockSiteRouter.get("/grapher/:slug", async (req, res) => {
    const entity = await Chart.getBySlug(req.params.slug)
    if (!entity) throw new JsonError("No such chart", 404)

    // XXX add dev-prod parity for this
    res.set("Access-Control-Allow-Origin", "*")
    const previewDataPageOrGrapherPage = await db
        .knexInstance()
        .transaction(async (knex) =>
            renderPreviewDataPageOrGrapherPage(entity.config, knex)
        )
    res.send(previewDataPageOrGrapherPage)
})

mockSiteRouter.get("/", async (req, res) => {
    const frontPage = await db
        .knexInstance()
        .transaction(async (knex) => renderFrontPage(knex))
    res.send(frontPage)
})

mockSiteRouter.get("/donate", async (req, res) =>
    res.send(await renderDonatePage())
)

mockSiteRouter.get("/thank-you", async (req, res) =>
    res.send(await renderThankYouPage())
)

mockSiteRouter.get("/data-insights/:pageNumberOrSlug?", async (req, res) => {
    const totalPageCount = calculateDataInsightIndexPageCount(
        await db
            .getPublishedDataInsights(db.knexInstance())
            .then((insights) => insights.length)
    )
    async function renderIndexPage(pageNumber: number) {
        const dataInsights =
            await GdocDataInsight.getPublishedDataInsights(pageNumber)
        // calling fetchImageMetadata 20 times makes me sad, would be nice if we could cache this
        await Promise.all(dataInsights.map((insight) => insight.loadState()))
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
        return res.send(await renderGdocsPageBySlug(slug, true))
    } catch (e) {
        console.error(e)
    }

    return new JsonError(`Data insight with slug "${slug}" not found`, 404)
})

mockSiteRouter.get("/charts", async (req, res) => {
    const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    res.send(await renderChartsPage(explorerAdminServer))
})

mockSiteRouter.get("/datapage-preview/:id", async (req, res) => {
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
            db.knexInstance()
        )
    )
})

countryProfileSpecs.forEach((spec) =>
    mockSiteRouter.get(`/${spec.rootPath}/:countrySlug`, async (req, res) => {
        const countryPage = await db
            .knexInstance()
            .transaction(async (knex) =>
                countryProfileCountryPage(spec, req.params.countrySlug, knex)
            )
        res.send(countryPage)
    })
)

mockSiteRouter.get("/search", async (req, res) =>
    res.send(await renderSearchPage())
)

mockSiteRouter.get("/latest", async (req, res) => {
    const latest = await db
        .knexInstance()
        .transaction(async (knex) => renderBlogByPageNum(1, knex))
    res.send(latest)
})

mockSiteRouter.get("/latest/page/:pageno", async (req, res) => {
    const pagenum = parseInt(req.params.pageno, 10)
    if (!isNaN(pagenum)) {
        const latestPageNum = await db
            .knexInstance()
            .transaction(async (knex) =>
                renderBlogByPageNum(isNaN(pagenum) ? 1 : pagenum, knex)
            )
        res.send(latestPageNum)
    } else throw new Error("invalid page number")
})

mockSiteRouter.get("/headerMenu.json", async (req, res) => {
    if (!isWordpressAPIEnabled) {
        res.status(404).send(await renderNotFoundPage())
        return
    }
    res.contentType("application/json")
    res.send(await renderMenuJson())
})

mockSiteRouter.use(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    ["/uploads", "/app/uploads"],
    express.static(path.join(WORDPRESS_DIR, "web/app/uploads"), {
        fallthrough: false,
    })
)

mockSiteRouter.use(
    "/exports",
    express.static(path.join(BAKED_SITE_DIR, "exports"))
)

mockSiteRouter.use("/assets", express.static("dist/assets"))

mockSiteRouter.use("/grapher/exports/:slug.svg", async (req, res) => {
    const grapher = await OldChart.getBySlug(req.params.slug)
    const vardata = await grapher.getVariableData()
    res.setHeader("Content-Type", "image/svg+xml")
    res.send(await grapherToSVG(grapher.config, vardata))
})

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

mockSiteRouter.get("/country/:countrySlug", async (req, res) =>
    res.send(await countryProfilePage(req.params.countrySlug, BAKED_BASE_URL))
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

mockSiteRouter.get("/dods.json", async (_, res) => {
    res.set("Access-Control-Allow-Origin", "*")
    const { details, parseErrors } = await GdocPost.getDetailsOnDemandGdoc()
    if (parseErrors.length) {
        console.error(
            `Error(s) parsing details: ${parseErrors
                .map((e) => e.message)
                .join(", ")}`
        )
    }
    res.send(details)
})

mockSiteRouter.get("/*", async (req, res) => {
    const slug = req.path.replace(/^\//, "")

    try {
        res.send(await renderGdocsPageBySlug(slug))
    } catch (e) {
        console.error(e)
    }

    try {
        const page = await db
            .knexInstance()
            .transaction(async (knex) => renderPageBySlug(slug, knex))
        res.send(page)
    } catch (e) {
        console.error(e)
        res.status(404).send(await renderNotFoundPage())
    }
})

export { mockSiteRouter }
