import { Post } from "db/model/Post"
import { Chart } from "db/model/Chart"
import { BAKED_BASE_URL, BAKED_GRAPHER_URL } from "settings"
import moment = require("moment")
import db = require("db/db")
import { countries } from "utils/countries"
import urljoin = require("url-join")

interface SitemapUrl {
    loc: string
    lastmod?: string
}

function xmlify(url: SitemapUrl) {
    if (url.lastmod) {
        return `    <url>
        <loc>${url.loc}</loc>
        <lastmod>${url.lastmod}</lastmod>
    </url>`
    } else {
        return `    <url>
        <loc>${url.loc}</loc>
    </url>`
    }
}

export async function makeSitemap() {
    const posts = (await db
        .table(Post.table)
        .where({ status: "publish" })
        .select("slug", "updated_at")) as { slug: string; updated_at: Date }[]
    const charts = (await db
        .table(Chart.table)
        .select(db.raw(`updatedAt, config->>"$.slug" AS slug`))
        .whereRaw('config->"$.isPublished" = true')) as {
        updatedAt: Date
        slug: string
    }[]

    let urls = countries.map(c => ({
        loc: urljoin(BAKED_BASE_URL, "country", c.slug)
    })) as SitemapUrl[]

    urls = urls
        .concat(
            posts.map(p => ({
                loc: urljoin(BAKED_BASE_URL, p.slug),
                lastmod: moment(p.updated_at).format("YYYY-MM-DD")
            }))
        )
        .concat(
            charts.map(c => ({
                loc: urljoin(BAKED_GRAPHER_URL, c.slug),
                lastmod: moment(c.updatedAt).format("YYYY-MM-DD")
            }))
        ) as SitemapUrl[]

    const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => xmlify(url)).join("\n")}
</urlset>`

    return sitemap
}
