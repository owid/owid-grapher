import * as wpdb from "db/wpdb"
import * as db from "db/db"
import { LongFormPage, PageOverrides } from "./views/LongFormPage"
import { BlogIndexPage } from "./views/BlogIndexPage"
import { FrontPage } from "./views/FrontPage"
import { ChartsIndexPage, ChartIndexItem } from "./views/ChartsIndexPage"
import { ExplorePage } from "./views/ExplorePage"
import { CovidPage } from "./views/CovidPage"
import { SearchPage } from "./views/SearchPage"
import { NotFoundPage } from "./views/NotFoundPage"
import { DonatePage } from "./views/DonatePage"
import SubscribePage from "./views/SubscribePage"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import * as _ from "lodash"
import {
    formatPost,
    extractFormattingOptions,
    FormattedPost,
    FormattingOptions,
    formatCountryProfile
} from "./formatting"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports
} from "./grapherUtil"
import * as cheerio from "cheerio"
import { JsonError } from "utils/server/serverUtil"
import { Post } from "db/model/Post"
import { BAKED_BASE_URL, BLOG_POSTS_PER_PAGE } from "settings"
import {
    EntriesByYearPage,
    EntriesForYearPage
} from "./views/EntriesByYearPage"
import { VariableCountryPage } from "./views/VariableCountryPage"
import { ChartConfigProps } from "charts/ChartConfig"
import { FeedbackPage } from "./views/FeedbackPage"
import { isExplorable, FORCE_EXPLORABLE_CHART_IDS } from "utils/charts"
import { Indicator } from "charts/Indicator"
import { getCountry, Country } from "utils/countries"
import { memoize } from "charts/Util"
import { CountryProfileSpec } from "site/client/CountryProfileConstants"

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

// Only used in the dev server
export async function renderCovidPage() {
    return renderToHtmlPage(<CovidPage />)
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
    const postApi = await wpdb.getPostBySlug(slug)

    return renderPage(postApi)
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

async function renderPage(postApi: any) {
    const post = await wpdb.getFullPost(postApi)
    const pageType = await wpdb.getPageType(post)

    const $ = cheerio.load(post.content)

    const grapherUrls = $("iframe")
        .toArray()
        .filter(el => (el.attribs["src"] || "").match(/\/grapher\//))
        .map(el => el.attribs["src"].trim())

    // This can be slow if uncached!
    await bakeGrapherUrls(grapherUrls)

    const exportsByUrl = await getGrapherExportsByUrl()

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)
    const formatted = await formatPost(post, formattingOptions, exportsByUrl)

    return renderToHtmlPage(
        <LongFormPage
            pageType={pageType}
            post={formatted}
            formattingOptions={formattingOptions}
        />
    )
}

export async function renderFrontPage() {
    const entries = await wpdb.getEntriesByCategory()
    const posts = await wpdb.getBlogIndex()
    const totalCharts = (
        await db.query(
            `SELECT COUNT(*) AS count
            FROM charts
            WHERE
                is_indexable IS TRUE
                AND publishedAt IS NOT NULL
                AND config -> "$.isPublished" IS TRUE`
        )
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
    const allPosts = await wpdb.getBlogIndex()

    const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)
    const posts = allPosts.slice(
        (pageNum - 1) * BLOG_POSTS_PER_PAGE,
        pageNum * BLOG_POSTS_PER_PAGE
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
    const posts: wpdb.FullPost[] = await Promise.all(
        postsApi.map(postApi => wpdb.getFullPost(postApi, true))
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
    .map(post => {
        const postUrl = `${BAKED_BASE_URL}/${post.path}`
        const image = post.imageUrl
            ? `<br><br><a href="${postUrl}" target="_blank"><img src="${post.imageUrl}"/></a>`
            : ""

        return `<entry>
            <title><![CDATA[${post.title}]]></title>
            <id>${postUrl}</id>
            <link rel="alternate" href="${postUrl}"/>
            <published>${post.date.toISOString()}</published>
            <updated>${post.modifiedDate.toISOString()}</updated>
            ${post.authors
                .map(
                    (author: string) =>
                        `<author><name>${author}</name></author>`
                )
                .join("")}
            <summary><![CDATA[${post.excerpt}${image}]]></summary>
            </entry>`
    })
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

const getCountryProfilePost = memoize(
    async (
        profileSpec: CountryProfileSpec,
        grapherExports?: GrapherExports
    ): Promise<[FormattedPost, FormattingOptions]> => {
        // Get formatted content from generic covid country profile page.
        const genericCountryProfilePostApi = await wpdb.getPostBySlug(
            profileSpec.genericProfileSlug
        )

        const genericCountryProfilePost = await wpdb.getFullPost(
            genericCountryProfilePostApi
        )

        const profileFormattingOptions = extractFormattingOptions(
            genericCountryProfilePost.content
        )
        const formattedPost = await formatPost(
            genericCountryProfilePost,
            profileFormattingOptions,
            grapherExports
        )

        return [formattedPost, profileFormattingOptions]
    }
)

export async function renderCountryProfile(
    profileSpec: CountryProfileSpec,
    country: Country,
    grapherExports?: GrapherExports
) {
    const [formatted, formattingOptions] = await getCountryProfilePost(
        profileSpec,
        grapherExports
    )

    const formattedCountryProfile = formatCountryProfile(formatted, country)

    const landing = await wpdb.getCountryProfileLandingPost(profileSpec)

    const overrides: PageOverrides = {
        pageTitle: `${country.name}: ${profileSpec.pageTitle}`,
        citationTitle: landing.title,
        citationSlug: landing.slug,
        citationCanonicalUrl: `${BAKED_BASE_URL}/${landing.slug}`,
        citationAuthors: landing.authors,
        publicationDate: landing.date,
        canonicalUrl: `${BAKED_BASE_URL}/${profileSpec.rootPath}/${country.slug}`,
        excerpt: `${country.name}: ${formattedCountryProfile.excerpt}`
    }
    return renderToHtmlPage(
        <LongFormPage
            pageType={wpdb.PageType.SubEntry}
            post={formattedCountryProfile}
            overrides={overrides}
            formattingOptions={formattingOptions}
        />
    )
}

export async function countryProfileCountryPage(
    profileSpec: CountryProfileSpec,
    countrySlug: string
) {
    const country = getCountry(countrySlug)
    if (!country) {
        throw new JsonError(`No such country ${countrySlug}`, 404)
    } else {
        // Voluntarily not dealing with grapherExports on devServer for simplicity
        return renderCountryProfile(profileSpec, country)
    }
}

export function flushCache() {
    getCountryProfilePost.cache.clear?.()
}
