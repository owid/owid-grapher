import { ChartConfigProps } from "charts/ChartConfig"
import { Indicator } from "charts/Indicator"
import * as cheerio from "cheerio"
import * as db from "db/db"
import { Post } from "db/model/Post"
import * as wpdb from "db/wpdb"
import * as _ from "lodash"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import { BAKED_BASE_URL } from "settings"
import { FORCE_EXPLORABLE_CHART_IDS, isExplorable } from "utils/charts"
import { JsonError } from "utils/server/serverUtil"

import { extractFormattingOptions, formatPost } from "./formatting"
import { bakeGrapherUrls, getGrapherExportsByUrl } from "./grapherUtil"
import { BlogIndexPage } from "./views/BlogIndexPage"
import { BlogPostPage } from "./views/BlogPostPage"
import { ChartIndexItem, ChartsIndexPage } from "./views/ChartsIndexPage"
import { DonatePage } from "./views/DonatePage"
import {
    EntriesByYearPage,
    EntriesForYearPage
} from "./views/EntriesByYearPage"
import { ExplorePage } from "./views/ExplorePage"
import { FeedbackPage } from "./views/FeedbackPage"
import { FrontPage } from "./views/FrontPage"
import { LongFormPage } from "./views/LongFormPage"
import { NotFoundPage } from "./views/NotFoundPage"
import { SearchPage } from "./views/SearchPage"
import SubscribePage from "./views/SubscribePage"
import { VariableCountryPage } from "./views/VariableCountryPage"

// Wrap ReactDOMServer to stick the doctype on
export function renderToHtmlPage(element: any) {
    return `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`
}

export async function renderChartsPage() {
    const chartItems = (await db.query(`
        SELECT
            id,
            config->>"$.slug" AS slug,
            config->>"$.title" AS title,
            config->>"$.variantName" AS variantName
        FROM charts
        WHERE
            is_indexable IS TRUE
            AND publishedAt IS NOT NULL
            AND config->"$.isPublished" IS TRUE
    `)) as ChartIndexItem[]

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
        const c = chartsById[ct.chartId]
        if (c) c.tags.push({ id: ct.tagId, name: ct.tagName })
    }

    return renderToHtmlPage(<ChartsIndexPage chartItems={chartItems} />)
}

export async function renderExplorePage() {
    return renderToHtmlPage(<ExplorePage />)
}

export async function renderExplorableIndicatorsJson() {
    const query: { id: number; config: any }[] = await db.query(
        `
        SELECT id, config
        FROM charts
        WHERE charts.isExplorable
        ${FORCE_EXPLORABLE_CHART_IDS.length ? `OR charts.id IN (?)` : ""}
        `,
        [FORCE_EXPLORABLE_CHART_IDS]
    )

    const explorableCharts = query
        .map(chart => ({
            id: chart.id,
            config: JSON.parse(chart.config) as ChartConfigProps
        }))
        // Ensure config is consistent with the current "explorable" requirements
        .filter(chart => isExplorable(chart.config))

    const result: Indicator[] = explorableCharts.map(chart => ({
        id: chart.id,
        title: chart.config.title,
        subtitle: chart.config.subtitle,
        sourceDesc: chart.config.sourceDesc,
        note: chart.config.note,
        dimensions: chart.config.dimensions,
        map: chart.config.map
    }))

    return JSON.stringify({ indicators: result })
}

export async function renderPageBySlug(slug: string) {
    const postApiArray = await wpdb.getPostBySlug(slug)
    if (!postApiArray.length)
        throw new JsonError(`No page found by slug ${slug}`, 404)

    return renderPage(postApiArray[0])
}

export async function renderPageById(
    id: number,
    isPreview?: boolean
): Promise<string> {
    let postApi = await wpdb.getPost(id)
    if (isPreview) {
        const revision = await wpdb.getLatestPostRevision(id)
        postApi = {
            ...revision,
            authors_name: postApi.authors_name,
            type: postApi.type,
            path: postApi.path,
            postId: id
        }
    }
    return renderPage(postApi)
}

export async function renderMenuJson() {
    const categories = await wpdb.getEntriesByCategory()
    return JSON.stringify({ categories: categories })
}

async function renderPage(postApi: object) {
    const post = wpdb.getFullPost(postApi)
    const entries = await wpdb.getEntriesByCategory()

    const $ = cheerio.load(post.content)

    const grapherUrls = $("iframe")
        .toArray()
        .filter(el => (el.attribs["src"] || "").match(/\/grapher\//))
        .map(el => el.attribs["src"])

    // This can be slow if uncached!
    await bakeGrapherUrls(grapherUrls)

    const exportsByUrl = await getGrapherExportsByUrl()

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)
    const formatted = await formatPost(post, formattingOptions, exportsByUrl)

    if (post.type === "post")
        return renderToHtmlPage(
            <BlogPostPage
                post={formatted}
                formattingOptions={formattingOptions}
            />
        )
    else
        return renderToHtmlPage(
            <LongFormPage
                entries={entries}
                post={formatted}
                formattingOptions={formattingOptions}
            />
        )
}

export async function renderFrontPage() {
    const entries = await wpdb.getEntriesByCategory()
    const posts = await wpdb.getBlogIndex()
    const totalCharts = (
        await db.query(`SELECT COUNT(*) as count FROM charts`)
    )[0].count as number
    return renderToHtmlPage(
        <FrontPage entries={entries} posts={posts} totalCharts={totalCharts} />
    )
}
export async function renderDonatePage() {
    return renderToHtmlPage(<DonatePage />)
}

export async function renderSubscribePage() {
    return renderToHtmlPage(<SubscribePage />)
}

export async function renderBlogByPageNum(pageNum: number) {
    const postsPerPage = 20

    const allPosts = await wpdb.getBlogIndex()

    const numPages = Math.ceil(allPosts.length / postsPerPage)
    const posts = allPosts.slice(
        (pageNum - 1) * postsPerPage,
        pageNum * postsPerPage
    )

    return renderToHtmlPage(
        <BlogIndexPage posts={posts} pageNum={pageNum} numPages={numPages} />
    )
}

export async function renderSearchPage() {
    return renderToHtmlPage(<SearchPage />)
}

export async function renderNotFoundPage() {
    return renderToHtmlPage(<NotFoundPage />)
}

export async function makeAtomFeed() {
    const postsApi = await wpdb.getPosts(["post"], 10)
    const posts: wpdb.FullPost[] = postsApi.map(postApi =>
        wpdb.getFullPost(postApi, true)
    )

    const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Our World in Data</title>
<subtitle>Research and data to make progress against the world’s largest problems</subtitle>
<id>${BAKED_BASE_URL}/</id>
<link type="text/html" rel="alternate" href="${BAKED_BASE_URL}"/>
<link type="application/atom+xml" rel="self" href="${BAKED_BASE_URL}/atom.xml"/>
<updated>${posts[0].date.toISOString()}</updated>
${posts
    .map(
        post => `<entry>
    <title><![CDATA[${post.title}]]></title>
    <id>${BAKED_BASE_URL}/${post.path}</id>
    <link rel="alternate" href="${BAKED_BASE_URL}/${post.path}"/>
    <published>${post.date.toISOString()}</published>
    <updated>${post.modifiedDate.toISOString()}</updated>
    ${post.authors
        .map((author: string) => `<author><name>${author}</name></author>`)
        .join("")}
    <summary><![CDATA[${post.excerpt}]]></summary>
</entry>`
    )
    .join("\n")}
</feed>
`

    return feed
}

// These pages exist largely just for Google Scholar
export async function entriesByYearPage(year?: number) {
    const entries = (await db
        .table(Post.table)
        .where({ status: "publish" })
        .join("post_tags", { "post_tags.post_id": "posts.id" })
        .join("tags", { "tags.id": "post_tags.tag_id" })
        .where({ "tags.name": "Entries" })
        .select("title", "slug", "published_at")) as Pick<
        Post.Row,
        "title" | "slug" | "published_at"
    >[]

    if (year !== undefined)
        return renderToHtmlPage(
            <EntriesForYearPage entries={entries} year={year} />
        )
    else return renderToHtmlPage(<EntriesByYearPage entries={entries} />)
}

export async function pagePerVariable(variableId: number, countryName: string) {
    const variable = await db.get(
        `
        SELECT v.id, v.name, v.unit, v.shortUnit, v.description, v.sourceId, u.fullName AS uploadedBy,
               v.display, d.id AS datasetId, d.name AS datasetName, d.namespace AS datasetNamespace
        FROM variables v
        JOIN datasets d ON d.id=v.datasetId
        JOIN users u ON u.id=d.dataEditedByUserId
        WHERE v.id = ?
    `,
        [variableId]
    )

    if (!variable) {
        throw new JsonError(`No variable by id '${variableId}'`, 404)
    }

    variable.display = JSON.parse(variable.display)
    variable.source = await db.get(
        `SELECT id, name FROM sources AS s WHERE id = ?`,
        variable.sourceId
    )

    const country = await db
        .table("entities")
        .select("id", "name")
        .whereRaw("lower(name) = ?", [countryName])
        .first()

    return renderToHtmlPage(
        <VariableCountryPage variable={variable} country={country} />
    )
}

export async function feedbackPage() {
    return renderToHtmlPage(<FeedbackPage />)
}
