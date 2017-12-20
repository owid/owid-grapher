import {createConnection, DatabaseConnection} from './database'
import * as request from 'request-promise'
import * as fs from 'fs-extra'
import * as path from 'path'

async function scrapePage(slug: string, baseUrl: string) {
    try {
        const html = await request(`${baseUrl}/${slug}`)

        const outDir = `tmp/`
        const outPath = path.join(outDir, `${slug}/index.html`)
        await fs.mkdirp(path.dirname(outPath))
        await fs.writeFile(outPath, html.replace(new RegExp(baseUrl, 'g'), ""))
    } catch (err) {
        console.error(slug, err.message)
    }
}

async function writeRedirects(db: DatabaseConnection) {
    const rows = await db.query(`SELECT url, action_data, action_code FROM wp_redirection_items`)
    const redirects = rows.map(row => `${row.url} ${row.action_data} ${row.action_code}`)
    await fs.writeFile(`tmp/_redirects`, redirects.join("\n"))
}

async function getPermalinks(db: DatabaseConnection) {
    const rows = await db.query(`SELECT post_id, meta_value FROM wp_postmeta WHERE meta_key='custom_permalink'`)
    const permalinks: {[postId: number]: string|undefined} = {}
    for (const row of rows) {
        permalinks[row.post_id] = row.meta_value
    }
    return permalinks
}

async function main(baseUrl: string) {
    const db = createConnection({ database: "owid_wordpress" })

    const redirects = writeRedirects(db)
    const postsQuery = db.query(`SELECT ID, post_name FROM wp_posts WHERE (post_type='page' OR post_type='post') AND post_status='publish'`)

    const permalinks = await getPermalinks(db)
    const rows = await postsQuery

    await scrapePage("/", baseUrl)
    // Scrape in little batches to avoid overwhelming the server
    for (let i = 0; i < rows.length; i += 10) {
        console.log(i)
        await Promise.all(rows.slice(i, i+10).map(row => {
            const slug = (permalinks[row.ID] || row.post_name).replace(/\/$/, "")
            return scrapePage(slug, baseUrl)
        }))
    }
    await redirects

    db.end()
}

main("http://l:8080")