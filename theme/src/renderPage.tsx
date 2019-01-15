import * as wpdb from "./wpdb"
import * as grapherDb from './grapherDb'
import {LongFormPage} from './views/LongFormPage'
import {BlogPostPage} from './views/BlogPostPage'
import {BlogIndexPage} from './views/BlogIndexPage'
import {FrontPage} from './views/FrontPage'
import {ChartsIndexPage, ChartIndexItem} from './views/ChartsIndexPage'
import SubscribePage from './views/SubscribePage'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import * as url from 'url'
import * as path from 'path'
import * as glob from 'glob'
import * as _ from 'lodash'
import * as fs from 'fs-extra'
import { WORDPRESS_DIR } from './settings'
import { formatPost, extractFormattingOptions } from './formatting'
import { bakeGrapherUrls, getGrapherExportsByUrl } from "./grapherUtil"
import * as cheerio from 'cheerio'

// Wrap ReactDOMServer to stick the doctype on
export function renderToHtmlPage(element: any) {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

type wpPostRow = any

export async function renderChartsPage() {
    const chartItems = await grapherDb.query(`SELECT id, config->>"$.slug" AS slug, config->>"$.title" AS title, config->>"$.variantName" AS variantName FROM charts`) as ChartIndexItem[]

    const chartTags = await grapherDb.query(`
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

    // XXX This is slow!
    await bakeGrapherUrls(grapherUrls, { silent: true })

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
    const postRows = await wpdb.query(`
        SELECT ID, post_title, post_date, post_name FROM wp_posts
        WHERE post_status='publish' AND post_type='post' ORDER BY post_date DESC LIMIT 6`)

    const permalinks = await wpdb.getPermalinks()

    const posts = postRows.map(row => {
        return {
            title: row.post_title,
            date: new Date(row.post_date),
            slug: permalinks.get(row.ID, row.post_name)
        }
    })

    const entries = await wpdb.getEntriesByCategory()

    return renderToHtmlPage(<FrontPage entries={entries} posts={posts}/>)
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
                const paths = glob.sync(path.join(WORDPRESS_DIR, pathname.replace(/.png/, "*.png")))
                const sortedPaths = _.sortBy(paths, path => fs.statSync(path).size)
                post.imageUrl = sortedPaths[sortedPaths.length-3].replace(WORDPRESS_DIR, '')
            } catch (err) {
                console.error(err)
                // Just use the big one
            }
        }
    }

    return renderToHtmlPage(<BlogIndexPage posts={posts} pageNum={pageNum} numPages={numPages}/>)
}

async function main(target: string, isPreview?: boolean) {
    try {
        if (target === 'front') {
            console.log(await renderFrontPage())
        } else if (target === 'subscribe') {
            console.log(await renderSubscribePage())
        } else if (target == "blog") {
            const pageNum = process.argv[3] ? parseInt(process.argv[3]) : 1
            console.log(await renderBlogByPageNum(pageNum === 0 ? 1 : pageNum))
        } else {
            console.log(await renderPageById(parseInt(target), isPreview))
        }
    } catch (err) {
        console.error(err)
    } finally {
        wpdb.end()
        grapherDb.end()
    }
}

if (require.main == module)
    main(process.argv[2], process.argv[3] === "preview")
