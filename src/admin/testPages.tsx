// Testing pages for comparing local charts against live versions

import {Router} from 'express'
import * as React from 'react'

import {renderToHtmlPage} from './serverUtil'
import {chartToSVG} from '../svgPngExport'
import OldChart, {Chart} from '../model/Chart'
import * as db from '../db'
import {NODE_BASE_URL} from '../settings'
import {expectInt} from './serverUtil'
import * as querystring from 'querystring'
import * as _ from 'lodash'
import * as url from 'url'

const testPages = Router()

function EmbedTestPage(props: { prevPageUrl?: string, nextPageUrl?: string, slugs: string[] }) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
        }

        figure, iframe {
            border: 0;
            width: 914px;
            height: 400px;
        }

        .row {
            padding: 10px;
            margin: 0;
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
        }
    `
    return <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Test Embeds</title>
            <style dangerouslySetInnerHTML={{__html: style}}/>
        </head>
        <body>
            <div className="row">
                <h3>ourworldindata.org</h3>
                <h3>{NODE_BASE_URL}</h3>
            </div>
            {props.slugs.map(slug =>
                <div className="row">
                    <iframe src={`https://ourworldindata.org/grapher/${slug}`}/>
                    <figure data-grapher-src={`/grapher/${slug}`}/>
                </div>
            )}
            <nav className="pagination">
                {props.prevPageUrl && <a href={props.prevPageUrl}>&lt;&lt; Prev</a>} {props.nextPageUrl && <a href={props.nextPageUrl}>Next &gt;&gt;</a>}
            </nav>
            <script src="/grapher/embedCharts.js"/>
        </body>
    </html>
}

testPages.get('/embeds', async (req, res) => {
    const numPerPage = 20, page = req.query.page ? expectInt(req.query.page) : 1
    let query = Chart.createQueryBuilder().limit(numPerPage).offset(numPerPage*page)

    if (req.query.type) {
        if (req.query.type === "ChoroplethMap")
            query = query.where(`config->"$.hasMapTab" IS TRUE`)
        else
            query = query.where(`config->"$.type" = :type AND config->"$.hasChartTab" IS TRUE`, { type: req.query.type })
    }

    let slugs = (await query.getMany()).map(c => c.config.slug) as string[]

    if (req.query.type === "ChoroplethMap") {
        slugs = slugs.map(slug => slug + "?tab=map")
    } else if (req.query.type) {
        slugs = slugs.map(slug => slug + "?tab=chart")
    }

    const count = await query.getCount()
    const numPages = Math.ceil(count/numPerPage)

    const prevPageUrl = page > 1 ? (url.parse(req.originalUrl).pathname as string) + "?" + querystring.stringify(_.extend({}, req.query, { page: page-1 })) : undefined
    const nextPageUrl = page < numPages ? (url.parse(req.originalUrl).pathname as string) + "?" + querystring.stringify(_.extend({}, req.query, { page: page+1 })) : undefined

    res.send(renderToHtmlPage(<EmbedTestPage prevPageUrl={prevPageUrl} nextPageUrl={nextPageUrl} slugs={slugs}/>))
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
    return <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1"/>
            <title>Test Previews</title>
            <style dangerouslySetInnerHTML={{__html: style}}/>
        </head>
        <body>
            {props.charts.map(chart =>
                <div className="row">
                    <a href={`https://ourworldindata.org/grapher/${chart.slug}`}>
                        <img src={`https://ourworldindata.org/grapher/exports/${chart.slug}.svg`}/>
                    </a>
                    <a href={`/grapher/${chart.slug}`}>
                        <img src={`/grapher/exports/${chart.slug}.svg`}/>
                    </a>
                </div>
            )}
        </body>
    </html>
}

testPages.get('/previews', async (req, res) => {
    const rows = await db.query(`SELECT config FROM charts LIMIT 200`)
    const charts = rows.map((row: any) => JSON.parse(row.config))

    res.send(renderToHtmlPage(<PreviewTestPage charts={charts}/>))
})

testPages.get('/:slug.svg', async (req, res) => {
    const chart = await OldChart.getBySlug(req.params.slug)
    const vardata = await chart.getVariableData()
    res.send(await chartToSVG(chart.config, vardata))
})

export default testPages
