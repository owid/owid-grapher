import express, { Router } from "express"
require("express-async-errors")
import * as path from "path"
import {
    renderFrontPage,
    renderPageBySlug,
    renderChartsPage,
    renderMenuJson,
    renderSearchPage,
    renderDonatePage,
    entriesByYearPage,
    makeAtomFeed,
    pagePerVariable,
    feedbackPage,
    renderNotFoundPage,
    renderBlogByPageNum,
    renderCovidPage,
    countryProfileCountryPage,
} from "site/server/siteRenderers"
import { grapherSlugToHtmlPage } from "baker/GrapherBaker"
import { BAKED_GRAPHER_URL } from "settings"
import { WORDPRESS_DIR, BASE_DIR, BAKED_SITE_DIR } from "serverSettings"
import * as db from "db/db"
import { expectInt, JsonError } from "utils/server/serverUtil"
import { embedSnippet } from "site/server/embedCharts"
import {
    countryProfilePage,
    countriesIndexPage,
} from "site/server/countryProfiles"
import { makeSitemap } from "site/server/sitemap"
import { OldChart } from "db/model/Chart"
import { countryProfileSpecs } from "site/server/countryProfileProjects"
import { grapherToExplorerRedirectsByGrapherSlug } from "explorer/legacyCovidExplorerRedirects"
import { renderExplorerPage } from "explorer/admin/ExplorerBaker"
import { grapherToSVG } from "baker/GrapherImageBaker"
import { getVariableData } from "db/model/Variable"

const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

mockSiteRouter.get("/sitemap.xml", async (req, res) => {
    res.send(await makeSitemap())
})

mockSiteRouter.get("/atom.xml", async (req, res) => {
    res.send(await makeAtomFeed())
})

mockSiteRouter.get("/entries-by-year", async (req, res) => {
    res.send(await entriesByYearPage())
})

mockSiteRouter.get(`/entries-by-year/:year`, async (req, res) => {
    res.send(await entriesByYearPage(parseInt(req.params.year)))
})

mockSiteRouter.get(
    "/grapher/data/variables/:variableIds.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        res.json(
            await getVariableData(
                (req.params.variableIds as string)
                    .split("+")
                    .map((v) => expectInt(v))
            )
        )
    }
)

mockSiteRouter.get("/grapher/embedCharts.js", async (req, res) => {
    res.send(embedSnippet())
})

mockSiteRouter.get("/grapher/latest", async (req, res) => {
    const latestRows = await db.query(
        `SELECT config->>"$.slug" AS slug FROM charts where starred=1`
    )
    if (latestRows.length) {
        res.redirect(`${BAKED_GRAPHER_URL}/${latestRows[0].slug}`)
    } else {
        throw new JsonError("No latest chart", 404)
    }
})

mockSiteRouter.get("/grapher/:slug", async (req, res) => {
    // XXX add dev-prod parity for this
    res.set("Access-Control-Allow-Origin", "*")
    if (req.params.slug in grapherToExplorerRedirectsByGrapherSlug) {
        // todo: restore functionality
        const { explorerQueryStr } = grapherToExplorerRedirectsByGrapherSlug[
            req.params.slug
        ]
        res.send(await renderExplorerPage(req.params.slug, ""))
    } else res.send(await grapherSlugToHtmlPage(req.params.slug))
})

mockSiteRouter.get("/", async (req, res) => {
    res.send(await renderFrontPage())
})

mockSiteRouter.get("/donate", async (req, res) => {
    res.send(await renderDonatePage())
})

mockSiteRouter.get("/charts", async (req, res) => {
    res.send(await renderChartsPage())
})

countryProfileSpecs.forEach((spec) => {
    mockSiteRouter.get(`/${spec.rootPath}/:countrySlug`, async (req, res) => {
        res.send(await countryProfileCountryPage(spec, req.params.countrySlug))
    })
})

// Route only available on the dev server
mockSiteRouter.get("/covid", async (req, res) => {
    res.send(await renderCovidPage())
})

mockSiteRouter.get("/search", async (req, res) => {
    res.send(await renderSearchPage())
})

mockSiteRouter.get("/blog", async (req, res) => {
    res.send(await renderBlogByPageNum(1))
})

mockSiteRouter.get("/blog/page/:pageno", async (req, res) => {
    const pagenum = parseInt(req.params.pageno, 10)
    if (!isNaN(pagenum)) {
        res.send(await renderBlogByPageNum(isNaN(pagenum) ? 1 : pagenum))
    } else {
        throw new Error("invalid page number")
    }
})

mockSiteRouter.get("/headerMenu.json", async (req, res) => {
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

mockSiteRouter.get("/indicator/:variableId/:country", async (req, res) => {
    const variableId = expectInt(req.params.variableId)

    res.send(await pagePerVariable(variableId, req.params.country))
})

mockSiteRouter.get("/countries", async (req, res) => {
    res.send(await countriesIndexPage())
})

mockSiteRouter.get("/country/:countrySlug", async (req, res) => {
    res.send(await countryProfilePage(req.params.countrySlug))
})

mockSiteRouter.get("/feedback", async (req, res) => {
    res.send(await feedbackPage())
})

mockSiteRouter.get("/*", async (req, res) => {
    const slug = req.path.replace(/^\//, "").replace("/", "__")
    try {
        res.send(await renderPageBySlug(slug))
    } catch (e) {
        console.error(e)
        res.send(await renderNotFoundPage())
    }
})

export { mockSiteRouter }
