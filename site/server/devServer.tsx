import express from "express"
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
    renderCovidPage
} from "site/server/siteBaking"
import { chartPage, chartDataJson } from "site/server/chartBaking"
import {
    BAKED_DEV_SERVER_PORT,
    BAKED_DEV_SERVER_HOST,
    BAKED_GRAPHER_URL
} from "settings"
import { WORDPRESS_DIR, BASE_DIR, BAKED_SITE_DIR } from "serverSettings"
import * as wpdb from "db/wpdb"
import * as db from "db/db"
import { expectInt, JsonError } from "utils/server/serverUtil"
import { embedSnippet } from "site/server/embedCharts"
import { countryProfilePage, countriesIndexPage } from "./countryProfiles"
import { makeSitemap } from "./sitemap"
import { OldChart } from "db/model/Chart"
import { chartToSVG } from "./svgPngExport"

const devServer = express()

devServer.get("/sitemap.xml", async (req, res) => {
    res.send(await makeSitemap())
})

devServer.get("/atom.xml", async (req, res) => {
    res.send(await makeAtomFeed())
})

devServer.get("/entries-by-year", async (req, res) => {
    res.send(await entriesByYearPage())
})

devServer.get(`/entries-by-year/:year`, async (req, res) => {
    res.send(await entriesByYearPage(parseInt(req.params.year)))
})

devServer.get("/grapher/data/variables/:variableIds.json", async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*")
    res.json(
        await chartDataJson(
            (req.params.variableIds as string).split("+").map(v => expectInt(v))
        )
    )
})

devServer.get("/grapher/embedCharts.js", async (req, res) => {
    res.send(embedSnippet())
})

devServer.get("/grapher/latest", async (req, res) => {
    const latestRows = await db.query(
        `SELECT config->>"$.slug" AS slug FROM charts where starred=1`
    )
    if (latestRows.length) {
        res.redirect(`${BAKED_GRAPHER_URL}/${latestRows[0].slug}`)
    } else {
        throw new JsonError("No latest chart", 404)
    }
})

devServer.get("/grapher/:slug", async (req, res) => {
    // XXX add dev-prod parity for this
    res.set("Access-Control-Allow-Origin", "*")
    res.send(await chartPage(req.params.slug))
})

devServer.get("/", async (req, res) => {
    res.send(await renderFrontPage())
})

devServer.get("/donate", async (req, res) => {
    res.send(await renderDonatePage())
})

devServer.get("/charts", async (req, res) => {
    res.send(await renderChartsPage())
})

devServer.get("/explore", async (req, res) => {
    res.send(await renderExplorePage())
})

// Route only available on the dev server
devServer.get("/covid", async (req, res) => {
    res.send(await renderCovidPage())
})

devServer.get("/explore/indicators.json", async (req, res) => {
    res.type("json").send(await renderExplorableIndicatorsJson())
})

devServer.get("/search", async (req, res) => {
    res.send(await renderSearchPage())
})

devServer.get("/blog", async (req, res) => {
    res.send(await renderBlogByPageNum(1))
})

devServer.get("/blog/page/:pageno", async (req, res) => {
    const pagenum = parseInt(req.params.pageno, 10)
    if (!isNaN(pagenum)) {
        res.send(await renderBlogByPageNum(isNaN(pagenum) ? 1 : pagenum))
    } else {
        throw new Error("invalid page number")
    }
})

devServer.get("/headerMenu.json", async (req, res) => {
    res.send(await renderMenuJson())
})

devServer.use(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    ["/uploads", "/app/uploads"],
    express.static(path.join(WORDPRESS_DIR, "web/app/uploads"), {
        fallthrough: false
    })
)

devServer.use("/exports", express.static(path.join(BAKED_SITE_DIR, "exports")))

devServer.use("/grapher/exports/:slug.svg", async (req, res) => {
    const chart = await OldChart.getBySlug(req.params.slug)
    const vardata = await chart.getVariableData()
    res.setHeader("Content-Type", "image/svg+xml")
    res.send(await chartToSVG(chart.config, vardata))
})

devServer.use("/", express.static(path.join(BASE_DIR, "public")))

devServer.get("/indicator/:variableId/:country", async (req, res) => {
    const variableId = expectInt(req.params.variableId)

    res.send(await pagePerVariable(variableId, req.params.country))
})

devServer.get("/countries", async (req, res) => {
    res.send(await countriesIndexPage())
})

devServer.get("/country/:countrySlug", async (req, res) => {
    res.send(await countryProfilePage(req.params.countrySlug))
})

devServer.get("/feedback", async (req, res) => {
    res.send(await feedbackPage())
})

devServer.get("/*", async (req, res) => {
    const slug = req.path.replace(/^\//, "").replace("/", "__")
    try {
        res.send(await renderPageBySlug(slug))
    } catch (e) {
        console.error(e)
        res.send(await renderNotFoundPage())
    }
})

async function main() {
    await wpdb.connect()
    await db.connect()
    devServer.listen(BAKED_DEV_SERVER_PORT, BAKED_DEV_SERVER_HOST, () => {
        console.log(
            `OWID development baker started on ${BAKED_DEV_SERVER_HOST}:${BAKED_DEV_SERVER_PORT}`
        )
    })
}

main()
