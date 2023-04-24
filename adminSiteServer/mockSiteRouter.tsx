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
} from "../baker/siteRenderers.js"
import {
    BAKED_BASE_URL,
    WORDPRESS_DIR,
    BASE_DIR,
    BAKED_SITE_DIR,
    GDOCS_DETAILS_ON_DEMAND_ID,
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
import { getVariableData } from "../db/model/Variable.js"
import { MultiEmbedderTestPage } from "../site/multiembedder/MultiEmbedderTestPage.js"
import { JsonError } from "@ourworldindata/utils"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { isWordpressAPIEnabled } from "../db/wpdb.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { explorerUrlMigrationsById } from "../explorer/urlMigrations/ExplorerUrlMigrations.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import { renderDataPageOrGrapherPage } from "../baker/GrapherBaker.js"
import { Gdoc } from "../db/model/Gdoc/Gdoc.js"

require("express-async-errors")

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

mockSiteRouter.get("/sitemap.xml", async (req, res) => {
    res.set("Content-Type", "application/xml")
    res.send(await makeSitemap(explorerAdminServer))
})

mockSiteRouter.get("/atom.xml", async (req, res) => {
    res.set("Content-Type", "application/xml")
    res.send(await makeAtomFeed())
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
    if (explorerProgram) res.send(await renderExplorerPage(explorerProgram))
    else
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
    res.send(
        await renderExplorerPage(program, {
            explorerUrlMigrationId: migrationId,
            baseQueryStr,
        })
    )
})

mockSiteRouter.get("/grapher/:slug", async (req, res) => {
    const entity = await Chart.getBySlug(req.params.slug)
    if (!entity) throw new JsonError("No such chart", 404)

    // XXX add dev-prod parity for this
    res.set("Access-Control-Allow-Origin", "*")
    res.send(await renderDataPageOrGrapherPage(entity.config))
})

mockSiteRouter.get("/", async (req, res) => {
    res.send(await renderFrontPage())
})

mockSiteRouter.get("/donate", async (req, res) =>
    res.send(await renderDonatePage())
)

mockSiteRouter.get("/charts", async (req, res) => {
    const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    res.send(await renderChartsPage(explorerAdminServer))
})

countryProfileSpecs.forEach((spec) =>
    mockSiteRouter.get(`/${spec.rootPath}/:countrySlug`, async (req, res) =>
        res.send(await countryProfileCountryPage(spec, req.params.countrySlug))
    )
)

mockSiteRouter.get("/search", async (req, res) =>
    res.send(await renderSearchPage())
)

mockSiteRouter.get("/blog", async (req, res) =>
    res.send(await renderBlogByPageNum(1))
)

mockSiteRouter.get("/blog/page/:pageno", async (req, res) => {
    const pagenum = parseInt(req.params.pageno, 10)
    if (!isNaN(pagenum))
        res.send(await renderBlogByPageNum(isNaN(pagenum) ? 1 : pagenum))
    else throw new Error("invalid page number")
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

mockSiteRouter.use("/grapher/exports/:slug.svg", async (req, res) => {
    const grapher = await OldChart.getBySlug(req.params.slug)
    const vardata = await grapher.getVariableData()
    res.setHeader("Content-Type", "image/svg+xml")
    res.send(await grapherToSVG(grapher.config, vardata))
})

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
    if (!GDOCS_DETAILS_ON_DEMAND_ID) {
        console.error(
            "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to generate dods.json"
        )
        res.send([])
    } else {
        const details = await Gdoc.getDetailsOnDemandGdoc()
        res.send(details)
    }
})

mockSiteRouter.get("/*", async (req, res) => {
    const slug = req.path.replace(/^\//, "").replace("/", "__")

    try {
        res.send(await renderGdocsPageBySlug(slug))
    } catch (e) {
        console.error(e)
    }

    try {
        res.send(await renderPageBySlug(slug))
    } catch (e) {
        console.error(e)
        res.status(404).send(await renderNotFoundPage())
    }
})

export { mockSiteRouter }
