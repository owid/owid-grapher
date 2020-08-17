import express, { Router } from "express"
require("express-async-errors")
import * as path from "path"

import {
    renderFrontPage,
    renderPageBySlug,
    renderChartsPage,
    renderExplorePage,
    renderMenuJson,
    renderSearchPage,
    renderDonatePage,
    entriesByYearPage,
    makeAtomFeed,
    pagePerVariable,
    feedbackPage,
    renderNotFoundPage,
    renderBlogByPageNum,
    renderExplorableIndicatorsJson,
    renderCovidPage,
    renderCovidDataExplorerPage,
    countryProfileCountryPage
} from "site/server/siteBaking"
import { chartDataJson, chartPageFromSlug } from "site/server/chartBaking"
import { BAKED_GRAPHER_URL } from "settings"
import { WORDPRESS_DIR, BASE_DIR, BAKED_SITE_DIR } from "serverSettings"
import * as db from "db/db"
import { expectInt, JsonError } from "utils/server/serverUtil"
import { embedSnippet } from "site/server/embedCharts"
import {
    countryProfilePage,
    countriesIndexPage
} from "../../site/server/countryProfiles"
import { makeSitemap } from "../../site/server/sitemap"
import { OldChart } from "db/model/Chart"
import { chartToSVG } from "../../site/server/svgPngExport"
import {
    covidDashboardSlug,
    covidChartAndVariableMetaPath
} from "charts/covidDataExplorer/CovidConstants"
import { covidCountryProfileRootPath } from "../../site/server/covid/CovidConstants"
import { bakeCovidChartAndVariableMeta } from "../../site/server/bakeCovidChartAndVariableMeta"
import { chartExplorerRedirectsBySlug } from "../../site/server/bakeCovidExplorerRedirects"
import { countryProfileSpecs } from "site/client/CountryProfileConstants"

const bakedSiteRouter = Router()

bakedSiteRouter.get("/sitemap.xml", async (req, res) => {
    res.send(await makeSitemap())
})

bakedSiteRouter.get("/atom.xml", async (req, res) => {
    res.send(await makeAtomFeed())
})

bakedSiteRouter.get("/entries-by-year", async (req, res) => {
    res.send(await entriesByYearPage())
})

bakedSiteRouter.get(`/entries-by-year/:year`, async (req, res) => {
    res.send(await entriesByYearPage(parseInt(req.params.year)))
})

bakedSiteRouter.get(
    "/grapher/data/variables/:variableIds.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        res.json(
            await chartDataJson(
                (req.params.variableIds as string)
                    .split("+")
                    .map(v => expectInt(v))
            )
        )
    }
)

bakedSiteRouter.get("/grapher/embedCharts.js", async (req, res) => {
    res.send(embedSnippet())
})

bakedSiteRouter.get("/grapher/latest", async (req, res) => {
    const latestRows = await db.query(
        `SELECT config->>"$.slug" AS slug FROM charts where starred=1`
    )
    if (latestRows.length) {
        res.redirect(`${BAKED_GRAPHER_URL}/${latestRows[0].slug}`)
    } else {
        throw new JsonError("No latest chart", 404)
    }
})

bakedSiteRouter.get("/grapher/:slug", async (req, res) => {
    // XXX add dev-prod parity for this
    res.set("Access-Control-Allow-Origin", "*")
    if (req.params.slug in chartExplorerRedirectsBySlug) {
        const { explorerQueryStr } = chartExplorerRedirectsBySlug[
            req.params.slug
        ]
        res.send(await renderCovidDataExplorerPage({ explorerQueryStr }))
    } else {
        res.send(await chartPageFromSlug(req.params.slug))
    }
})

bakedSiteRouter.get("/", async (req, res) => {
    res.send(await renderFrontPage())
})

bakedSiteRouter.get("/donate", async (req, res) => {
    res.send(await renderDonatePage())
})

bakedSiteRouter.get("/charts", async (req, res) => {
    res.send(await renderChartsPage())
})

bakedSiteRouter.get("/explore", async (req, res) => {
    res.send(await renderExplorePage())
})

bakedSiteRouter.get(`/${covidDashboardSlug}`, async (req, res) => {
    res.send(await renderCovidDataExplorerPage())
})

bakedSiteRouter.get(
    `/${covidCountryProfileRootPath}/:countrySlug`,
    async (req, res) => {
        res.send(
            await countryProfileCountryPage(
                countryProfileSpecs.get("coronavirus")!,
                req.params.countrySlug
            )
        )
    }
)

const co2Profile = countryProfileSpecs.get("co2")!

bakedSiteRouter.get(
    `/${co2Profile.rootPath}/:countrySlug`,
    async (req, res) => {
        res.send(
            await countryProfileCountryPage(co2Profile, req.params.countrySlug)
        )
    }
)

bakedSiteRouter.get(covidChartAndVariableMetaPath, async (req, res) => {
    res.send(await bakeCovidChartAndVariableMeta())
})

// Route only available on the dev server
bakedSiteRouter.get("/covid", async (req, res) => {
    res.send(await renderCovidPage())
})

bakedSiteRouter.get("/explore/indicators.json", async (req, res) => {
    res.type("json").send(await renderExplorableIndicatorsJson())
})

bakedSiteRouter.get("/search", async (req, res) => {
    res.send(await renderSearchPage())
})

bakedSiteRouter.get("/blog", async (req, res) => {
    res.send(await renderBlogByPageNum(1))
})

bakedSiteRouter.get("/blog/page/:pageno", async (req, res) => {
    const pagenum = parseInt(req.params.pageno, 10)
    if (!isNaN(pagenum)) {
        res.send(await renderBlogByPageNum(isNaN(pagenum) ? 1 : pagenum))
    } else {
        throw new Error("invalid page number")
    }
})

bakedSiteRouter.get("/headerMenu.json", async (req, res) => {
    res.send(await renderMenuJson())
})

bakedSiteRouter.use(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    ["/uploads", "/app/uploads"],
    express.static(path.join(WORDPRESS_DIR, "web/app/uploads"), {
        fallthrough: false
    })
)

bakedSiteRouter.use(
    "/exports",
    express.static(path.join(BAKED_SITE_DIR, "exports"))
)

bakedSiteRouter.use("/grapher/exports/:slug.svg", async (req, res) => {
    const chart = await OldChart.getBySlug(req.params.slug)
    const vardata = await chart.getVariableData()
    res.setHeader("Content-Type", "image/svg+xml")
    res.send(await chartToSVG(chart.config, vardata))
})

bakedSiteRouter.use("/", express.static(path.join(BASE_DIR, "public")))

bakedSiteRouter.get("/indicator/:variableId/:country", async (req, res) => {
    const variableId = expectInt(req.params.variableId)

    res.send(await pagePerVariable(variableId, req.params.country))
})

bakedSiteRouter.get("/countries", async (req, res) => {
    res.send(await countriesIndexPage())
})

bakedSiteRouter.get("/country/:countrySlug", async (req, res) => {
    res.send(await countryProfilePage(req.params.countrySlug))
})

bakedSiteRouter.get("/feedback", async (req, res) => {
    res.send(await feedbackPage())
})

bakedSiteRouter.get("/*", async (req, res) => {
    const slug = req.path.replace(/^\//, "").replace("/", "__")
    try {
        res.send(await renderPageBySlug(slug))
    } catch (e) {
        console.error(e)
        res.send(await renderNotFoundPage())
    }
})

export { bakedSiteRouter }
