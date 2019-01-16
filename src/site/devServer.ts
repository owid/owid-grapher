import * as express from 'express'
import {renderFrontPage, renderPageBySlug, renderChartsPage, renderMenuJson} from '../../theme/src/renderPage'
import {chartPage, chartDataJson} from 'src/site/chartBaking'
import {WORDPRESS_DIR, DEV_SERVER_PORT, DEV_SERVER_HOST} from 'src/settings'
import * as wpdb from '../../theme/src/wpdb'
import * as db from 'src/db'
import { expectInt } from 'src/admin/serverUtil'

const devServer = express()

devServer.get('/grapher/data/variables/:variableIds.json', async (req, res) => {
    res.json(await chartDataJson((req.params.variableIds as string).split("+").map(v => expectInt(v))))
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
    devServer.listen(DEV_SERVER_PORT, DEV_SERVER_HOST, () => {
        console.log(`OWID development baker started on ${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`)
    })
}

main()