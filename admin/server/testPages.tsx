// Testing pages for comparing local charts against live versions

import { Router } from "express"
import * as React from "react"

import { renderToHtmlPage, expectInt } from "utils/server/serverUtil"
import { chartToSVG } from "site/server/svgPngExport"
import { OldChart, Chart } from "db/model/Chart"
import { Head } from "site/server/views/Head"
import * as db from "db/db"
import { ADMIN_BASE_URL, BAKED_GRAPHER_URL, BAKED_BASE_URL } from "settings"
import * as querystring from "querystring"
import * as _ from "lodash"
import * as url from "url"
import { getComparePage, svgCompareFormPage } from "svgTester/SVGTester"

const IS_LIVE = ADMIN_BASE_URL === "https://owid.cloud"

const testPages = Router()

interface ChartItem {
    id: number
    slug: string
}

interface EmbedTestPageProps {
    prevPageUrl?: string
    nextPageUrl?: string
    currentPage?: number
    totalPages?: number
    charts: ChartItem[]
}

function EmbedTestPage(props: EmbedTestPageProps) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
            background-color: #f1f1f1;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        figure, iframe {
            border: 0;
            flex: 1;
            height: 450px;
            margin: 10px;
        }

        figure {
            padding-top: 3px;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }

        h3 {
            width: 50%;
            text-align: center;
            margin: 0;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
            padding: 15px;
        }

        .chart-id {
            font-size: 18px;
            font-weight: bold;
            padding-top: 10px;
            text-align: center;
        }
    `
    return (
        <html>
            <Head canonicalUrl="" pageTitle="Test Embeds">
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </Head>
            <body>
                <div className="row">
                    <div className="side-by-side">
                        <h3>ourworldindata.org</h3>
                        {!IS_LIVE && <h3>{BAKED_BASE_URL}</h3>}
                    </div>
                </div>
                {props.charts.map(chart => (
                    <div key={chart.slug} className="row">
                        <div className="chart-id">{chart.id}</div>
                        <div className="side-by-side">
                            <iframe
                                src={`https://ourworldindata.org/grapher/${chart.slug}`}
                            />
                            {!IS_LIVE && (
                                <figure
                                    data-grapher-src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                                />
                            )}
                        </div>
                    </div>
                ))}
                <nav className="pagination">
                    {props.prevPageUrl && (
                        <a href={props.prevPageUrl}>&lt;&lt; Prev</a>
                    )}{" "}
                    {props.currentPage !== undefined &&
                        props.totalPages !== undefined &&
                        `Page ${props.currentPage} of ${props.totalPages}`}{" "}
                    {props.nextPageUrl && (
                        <a href={props.nextPageUrl}>Next &gt;&gt;</a>
                    )}
                </nav>
                <script src={`${BAKED_GRAPHER_URL}/embedCharts.js`} />
            </body>
        </html>
    )
}

testPages.get("/embeds", async (req, res) => {
    const numPerPage = 20,
        page = req.query.page ? expectInt(req.query.page) : 1
    let query = Chart.createQueryBuilder("charts")
        .where("publishedAt IS NOT NULL")
        .limit(numPerPage)
        .offset(numPerPage * (page - 1))
        .orderBy("id", "ASC")

    let tab = req.query.tab
    const namespaces =
        (req.query.namespaces && req.query.namespaces.split(",")) || []

    if (req.query.type) {
        if (req.query.type === "ChoroplethMap") {
            query = query.andWhere(`config->"$.hasMapTab" IS TRUE`)
            tab = tab || "map"
        } else {
            query = query.andWhere(
                `config->"$.type" = :type AND config->"$.hasChartTab" IS TRUE`,
                { type: req.query.type }
            )
            tab = tab || "chart"
        }
    }

    if (req.query.logLinear) {
        query = query.andWhere(
            `config->'$.yAxis.canChangeScaleType' IS TRUE OR config->>'$.xAxis.canChangeScaleType' IS TRUE`
        )
        tab = "chart"
    }

    if (tab) {
        if (tab === "map") {
            query = query.andWhere(`config->"$.hasMapTab" IS TRUE`)
        } else if (tab === "chart") {
            query = query.andWhere(`config->"$.hasChartTab" IS TRUE`)
        }
    }

    if (req.query.namespace) {
        namespaces.push(req.query.namespace)
    }

    if (namespaces.length > 0) {
        query.andWhere(
            `
            EXISTS(
                SELECT *
                FROM datasets
                INNER JOIN variables ON variables.datasetId = datasets.id
                INNER JOIN chart_dimensions ON chart_dimensions.variableId = variables.id
                WHERE datasets.namespace IN (:namespaces)
                AND chart_dimensions.chartId = charts.id
            )
        `,
            { namespaces: namespaces }
        )
    }

    const charts: ChartItem[] = (await query.getMany()).map(c => ({
        id: c.id,
        slug: c.config.slug
    }))

    if (tab) {
        charts.forEach(c => (c.slug += `?tab=${tab}`))
    }

    const count = await query.getCount()
    const numPages = Math.ceil(count / numPerPage)

    const prevPageUrl =
        page > 1
            ? (url.parse(req.originalUrl).pathname as string) +
              "?" +
              querystring.stringify(_.extend({}, req.query, { page: page - 1 }))
            : undefined
    const nextPageUrl =
        page < numPages
            ? (url.parse(req.originalUrl).pathname as string) +
              "?" +
              querystring.stringify(_.extend({}, req.query, { page: page + 1 }))
            : undefined

    res.send(
        renderToHtmlPage(
            <EmbedTestPage
                prevPageUrl={prevPageUrl}
                nextPageUrl={nextPageUrl}
                charts={charts}
                currentPage={page}
                totalPages={numPages}
            />
        )
    )
})

testPages.get("/embeds/:id", async (req, res) => {
    const id = req.params.id
    const chart = await Chart.createQueryBuilder()
        .where("id = :id", { id: id })
        .getOne()
    if (chart) {
        const charts = [
            {
                id: chart.id,
                slug: `${chart.config.slug}${
                    req.query.tab ? `?tab=${req.query.tab}` : ""
                }`
            }
        ]
        res.send(renderToHtmlPage(<EmbedTestPage charts={charts} />))
    } else {
        res.send("Could not find chart ID")
    }
})

function PreviewTestPage(props: { charts: any[] }) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
        }

        img {
            width: 45%;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
        }
    `
    return (
        <html>
            <head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Test Previews</title>
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                {props.charts.map(chart => (
                    <div key={chart.slug} className="row">
                        <a
                            href={`https://ourworldindata.org/grapher/${chart.slug}`}
                        >
                            <img
                                src={`https://ourworldindata.org/grapher/exports/${chart.slug}.svg`}
                            />
                        </a>
                        <a href={`/grapher/${chart.slug}`}>
                            <img src={`/grapher/exports/${chart.slug}.svg`} />
                        </a>
                    </div>
                ))}
            </body>
        </html>
    )
}

function EmbedVariantsTestPage(props: EmbedTestPageProps) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
            background-color: #f1f1f1;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        figure, iframe {
            border: 0;
            flex: 1;
            height: 450px;
            margin: 10px;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }

        h3 {
            width: 50%;
            text-align: center;
            margin: 0;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
            padding: 15px;
        }

        .chart-id {
            font-size: 18px;
            font-weight: bold;
            padding-top: 10px;
            text-align: center;
        }
    `
    return (
        <html>
            <head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Test Embed Variants</title>
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                {props.charts.map(chart => (
                    <div key={chart.slug} className="row">
                        <div className="chart-id">{chart.id}</div>
                        <div className="side-by-side">
                            <iframe
                                src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                            />
                            {!IS_LIVE && (
                                <figure
                                    data-grapher-src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                                />
                            )}
                        </div>
                    </div>
                ))}
                <nav className="pagination">
                    {props.prevPageUrl && (
                        <a href={props.prevPageUrl}>&lt;&lt; Prev</a>
                    )}{" "}
                    {props.currentPage !== undefined &&
                        props.totalPages !== undefined &&
                        `Page ${props.currentPage} of ${props.totalPages}`}{" "}
                    {props.nextPageUrl && (
                        <a href={props.nextPageUrl}>Next &gt;&gt;</a>
                    )}
                </nav>
                <script src={`${BAKED_GRAPHER_URL}/embedCharts.js`} />
            </body>
        </html>
    )
}

testPages.get("/previews", async (req, res) => {
    const rows = await db.query(`SELECT config FROM charts LIMIT 200`)
    const charts = rows.map((row: any) => JSON.parse(row.config))

    res.send(renderToHtmlPage(<PreviewTestPage charts={charts} />))
})

testPages.get("/embedVariants", async (req, res) => {
    const rows = await db.query(`SELECT config FROM charts WHERE id=64`)
    const charts = rows.map((row: any) => JSON.parse(row.config))

    res.send(renderToHtmlPage(<EmbedVariantsTestPage charts={charts} />))
})

testPages.get("/compareSvgs", async (req, res) => {
    res.send(renderToHtmlPage(svgCompareFormPage))
})

testPages.post("/compareSvgs", async (req, res) => {
    const { prodResults, localResults } = req.body
    const page = await getComparePage(prodResults, localResults)
    res.send(renderToHtmlPage(page))
})

testPages.get("/:slug.svg", async (req, res) => {
    const chart = await OldChart.getBySlug(req.params.slug)
    const vardata = await chart.getVariableData()
    res.send(await chartToSVG(chart.config, vardata))
})

export { testPages }
