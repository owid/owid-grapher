// Testing pages for comparing local charts against live versions

import {Router} from 'express'
import * as React from 'react'

import {renderToHtmlPage} from './serverUtil'
import {chartToSVG} from '../svgPngExport'
import Chart from '../models/Chart'
import * as db from '../db'

const testPages = Router()

function EmbedTestPage(props: { charts: any[] }) {
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
            {props.charts.map(chart =>
                <div className="row">
                    <iframe src={`https://ourworldindata.org/grapher/${chart.slug}`}/>
                    <figure data-grapher-src={`/grapher/${chart.slug}`}/>
                </div>
            )}
            <script src="/grapher/embedCharts.js"/>
        </body>
    </html>
}

testPages.get('/charts', async (req, res) => {
    const rows = await db.query(`SELECT config FROM charts LIMIT 20`)
    const charts = rows.map((row: any) => JSON.parse(row.config))

    res.send(renderToHtmlPage(<EmbedTestPage charts={charts}/>))
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
    const chart = await Chart.getBySlug(req.params.slug)
    const vardata = await chart.getVariableData()
    res.send(await chartToSVG(chart.config, vardata))
})

export default testPages
