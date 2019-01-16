import * as express from 'express'
import {renderFrontPage, renderPageBySlug, renderChartsPage, renderMenuJson} from './renderPage'
import {WORDPRESS_DIR, DEV_SERVER_PORT, DEV_SERVER_HOST} from '../../src/settings'
import * as wpdb from './wpdb'
import * as db from 'src/db'

const devServer = express()

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
        console.log(`OWID dev server started on ${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`)
    })
}

main()