import * as wpdb from "db/wpdb"
import * as db from 'db/db'
import {LongFormPage} from './views/LongFormPage'
import {BlogPostPage} from './views/BlogPostPage'
import {BlogIndexPage} from './views/BlogIndexPage'
import {FrontPage} from './views/FrontPage'
import {ChartsIndexPage, ChartIndexItem} from './views/ChartsIndexPage'
import {SearchPage} from './views/SearchPage'
import {DonatePage} from './views/DonatePage'
import SubscribePage from './views/SubscribePage'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as url from 'url'
import * as path from 'path'
import * as glob from 'glob'
import * as _ from 'lodash'
import * as fs from 'fs-extra'
import { WORDPRESS_DIR } from 'serverSettings'
import { formatPost, extractFormattingOptions, FormattedPost } from './formatting'
import { bakeGrapherUrls, getGrapherExportsByUrl } from "./grapherUtil"
import * as cheerio from 'cheerio'
import { JsonError, slugify } from "utils/server/serverUtil"
import { Chart } from 'db/model/Chart'
import { Post } from "db/model/Post"
import { BAKED_BASE_URL, BAKED_GRAPHER_URL } from "settings"
import moment = require("moment")
import * as urljoin from 'url-join'
import { EntriesByYearPage, EntriesForYearPage } from "./views/EntriesByYearPage"
import { VariableCountryPage } from "./views/VariableCountryPage";
import { CountryProfilePage, CountryProfileKeyStats, CountryProfileIndicator } from "./views/CountryProfilePage";
import { ChartConfigProps } from "charts/ChartConfig";

// Wrap ReactDOMServer to stick the doctype on
export function renderToHtmlPage(element: any) {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

type wpPostRow = any

export async function renderChartsPage() {
    const chartItems = await db.query(`SELECT id, config->>"$.slug" AS slug, config->>"$.title" AS title, config->>"$.variantName" AS variantName FROM charts`) as ChartIndexItem[]

    const chartTags = await db.query(`
        SELECT ct.chartId, ct.tagId, t.name as tagName, t.parentId as tagParentId FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `)

    for (const c of chartItems) {
        c.tags = []
    }

    const chartsById = _.keyBy(chartItems, c => c.id)

    for (const ct of chartTags) {
        // XXX hardcoded filtering to public parent tags
        if ([1515, 1507, 1513, 1504, 1502, 1509, 1506, 1501, 1514, 1511, 1500, 1503, 1505, 1508, 1512, 1510].indexOf(ct.tagParentId) === -1)
            continue

        const c = chartsById[ct.chartId]
        if (c)
            c.tags.push({ id: ct.tagId, name: ct.tagName })
    }

    return renderToHtmlPage(<ChartsIndexPage chartItems={chartItems}/>)
}

export async function renderPageBySlug(slug: string) {
    const rows = await wpdb.query(`SELECT * FROM wp_posts AS post WHERE post_name=?`, [slug])
    if (!rows.length)
        throw new JsonError(`No page found by slug ${slug}`, 404)

    return renderPage(rows[0])
}

export async function renderPageById(id: number, isPreview?: boolean): Promise<string> {
    let rows
    if (isPreview) {
        rows = await wpdb.query(`SELECT post.*, parent.post_type FROM wp_posts AS post JOIN wp_posts AS parent ON parent.ID=post.post_parent WHERE post.post_parent=? AND post.post_type='revision' ORDER BY post_modified DESC`, [id])
    } else {
        rows = await wpdb.query(`SELECT * FROM wp_posts AS post WHERE ID=?`, [id])
    }

    return renderPage(rows[0])
}

export async function renderMenuJson() {
    const categories = await wpdb.getEntriesByCategory()
    return JSON.stringify({ categories: categories })
}

async function renderPage(postRow: wpPostRow) {
    const post = await wpdb.getFullPost(postRow)
    const entries = await wpdb.getEntriesByCategory()

    const $ = cheerio.load(post.content)

    const grapherUrls = $("iframe").toArray().filter(el => (el.attribs['src']||'').match(/\/grapher\//)).map(el => el.attribs['src'])

    // This can be slow if uncached!
    await bakeGrapherUrls(grapherUrls)

    const exportsByUrl = await getGrapherExportsByUrl()

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)
    const formatted = await formatPost(post, formattingOptions, exportsByUrl)

    if (postRow.post_type === 'post')
        return renderToHtmlPage(<BlogPostPage post={formatted} formattingOptions={formattingOptions} />)
    else
        return renderToHtmlPage(<LongFormPage entries={entries} post={formatted} formattingOptions={formattingOptions} />)
}

export async function renderFrontPage() {
    const entries = await wpdb.getEntriesByCategory()
    const posts = await wpdb.getBlogIndex()
    const shortPosts = posts.filter(post =>
        post.tags.map(tag => tag.name).includes("Short updates and facts"))
    const explainerPosts = posts.filter(post =>
        post.tags.map(tag => tag.name).includes("Explainers"))

    return renderToHtmlPage(<FrontPage entries={entries} posts={posts} shortPosts={shortPosts} explainerPosts={explainerPosts} />)
}
export async function renderDonatePage() {
    return renderToHtmlPage(<DonatePage/>)
}

export async function renderSubscribePage() {
    return renderToHtmlPage(<SubscribePage/>)
}

export async function renderBlogByPageNum(pageNum: number) {
    const postsPerPage = 21

    const allPosts = await wpdb.getBlogIndex()

    const numPages = Math.ceil(allPosts.length/postsPerPage)
    const posts = allPosts.slice((pageNum-1)*postsPerPage, pageNum*postsPerPage)

    for (const post of posts) {
        if (post.imageUrl) {
            // Find a smaller version of this image
            try {
                const pathname = url.parse(post.imageUrl).pathname as string
                const paths = glob.sync(path.join(WORDPRESS_DIR, pathname.replace(/\.png/, "*.png")))
                const sortedPaths = _.sortBy(paths, p => fs.statSync(p).size)
                post.imageUrl = sortedPaths[sortedPaths.length-3].replace(WORDPRESS_DIR, '')
            } catch (err) {
                // Just use the big one
            }
        }
    }

    return renderToHtmlPage(<BlogIndexPage posts={posts} pageNum={pageNum} numPages={numPages}/>)
}

export async function renderSearchPage() {
    return renderToHtmlPage(<SearchPage/>)
}

export async function makeSitemap() {
    const posts = await Post.select('slug', 'updated_at').from(db.table(Post.table).where({ status: 'publish' }))
    const charts = await db.table(Chart.table).select(db.raw(`updatedAt, config->>"$.slug" AS slug`)).whereRaw('config->"$.isPublished" = true') as { updatedAt: Date, slug: string }[]

    const urls = posts.map(p => ({
        loc: urljoin(BAKED_BASE_URL, p.slug),
        lastmod: moment(p.updated_at).format("YYYY-MM-DD")
    })).concat(charts.map(c => ({
        loc: urljoin(BAKED_GRAPHER_URL, c.slug),
        lastmod: moment(c.updatedAt).format("YYYY-MM-DD")
    })))

    const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `    <url>
        <loc>${url.loc}</loc>
        <lastmod>${url.lastmod}</lastmod>
    </url>`).join("\n")}
</urlset>`

    return sitemap
}

export async function makeAtomFeed() {
    const postRows = await wpdb.query(`SELECT * FROM wp_posts WHERE post_type='post' AND post_status='publish' ORDER BY post_date DESC LIMIT 10`)

    const posts: FormattedPost[] = []
    for (const row of postRows) {
        const fullPost = await wpdb.getFullPost(row)
        const formattingOptions = extractFormattingOptions(fullPost.content)
        posts.push(await formatPost(fullPost, formattingOptions))
    }

    const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Our World in Data</title>
<subtitle>Living conditions around the world are changing rapidly. Explore how and why.</subtitle>
<id>${BAKED_BASE_URL}/</id>
<link type="text/html" rel="alternate" href="${BAKED_BASE_URL}"/>
<link type="application/atom+xml" rel="self" href="${BAKED_BASE_URL}/atom.xml"/>
<updated>${posts[0].date.toISOString()}</updated>
${posts.map(post => `<entry>
    <title><![CDATA[${post.title}]]></title>
    <id>${BAKED_BASE_URL}/${post.slug}</id>
    <link rel="alternate" href="${BAKED_BASE_URL}/${post.slug}"/>
    <published>${post.date.toISOString()}</published>
    <updated>${post.modifiedDate.toISOString()}</updated>
    ${post.authors.map(author => `<author><name>${author}</name></author>`).join("")}
    <summary><![CDATA[${post.excerpt}]]></summary>
</entry>`).join("\n")}
</feed>
`

    return feed
}

// These pages exist largely just for Google Scholar
export async function entriesByYearPage(year?: number) {
    const entries = await db.table(Post.table)
        .where({ status: 'publish' })
        .join('post_tags', { 'post_tags.post_id': 'posts.id' })
        .join('tags', { 'tags.id': 'post_tags.tag_id' })
        .where({ 'tags.name': 'Entries' })
        .select('title', 'slug', 'published_at') as Pick<Post.Row, 'title'|'slug'|'published_at'>[]

    if (year !== undefined)
        return renderToHtmlPage(<EntriesForYearPage entries={entries} year={year}/>)
    else
        return renderToHtmlPage(<EntriesByYearPage entries={entries}/>)
}

export async function pagePerVariable(variableId: number, countryName: string) {
    const variable = await db.get(`
        SELECT v.id, v.name, v.unit, v.shortUnit, v.description, v.sourceId, u.fullName AS uploadedBy,
               v.display, d.id AS datasetId, d.name AS datasetName, d.namespace AS datasetNamespace
        FROM variables v
        JOIN datasets d ON d.id=v.datasetId
        JOIN users u ON u.id=d.dataEditedByUserId
        WHERE v.id = ?
    `, [variableId])

    if (!variable) {
        throw new JsonError(`No variable by id '${variableId}'`, 404)
    }

    variable.display = JSON.parse(variable.display)
    variable.source = await db.get(`SELECT id, name FROM sources AS s WHERE id = ?`, variable.sourceId)

    const country = await db.table('entities').select('id', 'name').whereRaw('lower(name) = ?', [countryName]).first()

    return renderToHtmlPage(<VariableCountryPage variable={variable} country={country}/>)
}

interface Stat {
    value: number
    year: number
}

async function getLatestDataForVariables(entityId: number, variableIds: number[]): Promise<{[variableId: number]: Stat}> {
   const dataValues = await db.table("data_values").whereIn("variableId", variableIds).andWhere({ entityId: entityId }).orderBy("year", "DESC")

   const result: {[variableId: number]: Stat} = {}

   for (const dv of dataValues) {
        if (result[dv.variableId])
            continue

        result[dv.variableId] = {
            value: dv.value,
            year: dv.year
        }
   }

   return result
}


export async function countryProfilePage(countryName: string) {
    // Find the country
    const country = await db.table('entities').select('id', 'name').whereRaw('lower(name) = ?', [countryName]).first()
    country.slug = slugify(country.name)

    // Find the data
    let charts = (await db.table("charts")).map((c: any) => JSON.parse(c.config)) as ChartConfigProps[]
    
    charts = charts.filter(c => c.hasChartTab && c.type === "LineChart" && c.dimensions.length === 1)

    const variableIds = charts.map(c => c.dimensions[0].variableId)

    const dataValues = await db.table("data_values").select("variableId", "value", "year").whereIn("variableId", variableIds).andWhere({ entityId: country.id }).orderBy("year", "DESC") as { variableId: number, value: string, year: number }[]
    const valuesByVariableId = _.groupBy(dataValues, v => v.variableId)

    let indicators: CountryProfileIndicator[] = []
    for (const c of charts) {
        const vid = c.dimensions[0] && c.dimensions[0].variableId
        const values = valuesByVariableId[vid]

        if (values && values.length) {
            const latestValue = values[0]
            indicators.push({
                year: latestValue.year,
                value: latestValue.value,
                name: c.title as string,
                slug: `/grapher/${c.slug}?tab=chart&country=${country.name}`
            })
        }
    }
 
    indicators = _.sortBy(indicators, i => i.name.trim())



    // const keyVariableIds: {[key: string]: number} = {
    //     population: 97373
    // }

    // const keyStats: any = {}

    // const latestData = await getLatestDataForVariables(country.id, _.values(keyVariableIds))
    // for (const key in keyVariableIds) {
    //     keyStats[key] = latestData[keyVariableIds[key]]
    // }

    return renderToHtmlPage(<CountryProfilePage keyStats={{} as any} indicators={indicators} country={country}/>)
}