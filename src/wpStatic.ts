import {createConnection, DatabaseConnection} from './database'
import * as request from 'request-promise'
import * as fs from 'fs-extra'
import * as path from 'path'

async function scrapePage(slug: string, baseUrl: string, outDir: string) {
    try {
        let html = await request(`${baseUrl}/${slug}`)

        if (slug === "/") slug = "index"
        const outPath = path.join(outDir, `${slug}.html`)
        await fs.mkdirp(path.dirname(outPath))

        html = html.replace(new RegExp(baseUrl, 'g'), "")
            .replace(new RegExp("http://", 'g'), "https://")
            .replace(new RegExp("https://ourworldindata.org", 'g'), "https://owid.netlify.com")
            .replace(new RegExp("/grapher/embedCharts.js", 'g'), "https://owid.netlify.com/grapher/embedCharts.js")

        await fs.writeFile(outPath, html)
    } catch (err) {
        console.error(slug, err.message)
    }
}

async function writeRedirects(db: DatabaseConnection, outDir: string) {
    const redirects = [
        "http://owid.netlify.com* https://owid.netlify.com:splat",
        "/grapher/* https://owid-grapher.netlify.com/grapher/:splat 200"
    ]

    const rows = await db.query(`SELECT url, action_data, action_code FROM wp_redirection_items`)
    redirects.push(...rows.map(row => `${row.url} ${row.action_data} ${row.action_code}`))
    await fs.writeFile(`${outDir}/_redirects`, redirects.join("\n"))
}

async function getPermalinks(db: DatabaseConnection) {
    const rows = await db.query(`SELECT post_id, meta_value FROM wp_postmeta WHERE meta_key='custom_permalink'`)
    const permalinks: {[postId: number]: string|undefined} = {}
    for (const row of rows) {
        permalinks[row.post_id] = row.meta_value
    }
    return permalinks
}

async function main(baseUrl: string, outDir: string) {
    const db = createConnection({ database: "owid_wordpress" })

    const redirects = writeRedirects(db, outDir)
    const postsQuery = db.query(`SELECT ID, post_name FROM wp_posts WHERE (post_type='page' OR post_type='post') AND post_status='publish'`)

    const permalinks = await getPermalinks(db)
    const rows = await postsQuery

    await scrapePage("/", baseUrl, outDir)
    // Scrape in little batches to avoid overwhelming the server
    for (let i = 0; i < rows.length; i += 10) {
        console.log(i)
        await Promise.all(rows.slice(i, i+10).map(row => {
            const slug = (permalinks[row.ID] || row.post_name).replace(/\/$/, "")
            return scrapePage(slug, baseUrl, outDir)
        }))
    }
    await redirects

    db.end()
}

main("http://l:8080", "/Users/mispy/wp-static")