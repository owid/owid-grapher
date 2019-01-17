import * as express from 'express'
import {renderFrontPage, renderPageBySlug, renderChartsPage, renderMenuJson} from 'site/server/renderPage'
import {chartPage, chartDataJson} from 'site/server/chartBaking'
import {WORDPRESS_DIR, BAKED_DEV_SERVER_PORT, BAKED_DEV_SERVER_HOST} from 'settings'
import * as wpdb from 'db/wpdb'
import * as db from 'db/db'
import { expectInt } from 'util/server/serverUtil'
import { embedSnippet } from 'util/server/staticGen'

const devServer = express()

devServer.get('/grapher/data/variables/:variableIds.json', async (req, res) => {
    res.json(await chartDataJson((req.params.variableIds as string).split("+").map(v => expectInt(v))))
})

devServer.get('/grapher/embedCharts.js', async (req, res) => {
    res.send(embedSnippet())
})

devServer.get('/grapher/:slug', async (req, res) => {
    res.send(await chartPage(req.params.slug))
})

devServer.get('/', async (req, res) => {
    res.send(await renderFrontPage())
})

devServer.get('/charts', async (req, res) => {
    res.send(await renderChartsPage())
})

devServer.get('/headerMenu.json', async (req, res) => {
    res.send(await renderMenuJson())
})

devServer.use(express.static(WORDPRESS_DIR))

devServer.get('/:slug', async (req, res) => {
    res.send(await renderPageBySlug(req.params.slug))
})

async function main() {
    await wpdb.connect()
    await db.connect()
    devServer.listen(BAKED_DEV_SERVER_PORT, BAKED_DEV_SERVER_HOST, () => {
        console.log(`OWID development baker started on ${BAKED_DEV_SERVER_HOST}:${BAKED_DEV_SERVER_PORT}`)
    })
}

main()