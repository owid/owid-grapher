import {
    formatWordpressEditLink,
    LongFormPage,
    PageOverrides,
} from "../site/LongFormPage"
import { BlogIndexPage } from "../site/BlogIndexPage"
import { FrontPage } from "../site/FrontPage"
import { ChartsIndexPage, ChartIndexItem } from "../site/ChartsIndexPage"
import { CovidPage } from "../site/CovidPage"
import { SearchPage } from "../site/SearchPage"
import { NotFoundPage } from "../site/NotFoundPage"
import { DonatePage } from "../site/DonatePage"
import * as React from "react"
import * as ReactDOMServer from "react-dom/server"
import * as lodash from "lodash"
import {
    extractFormattingOptions,
    formatCountryProfile,
    formatLinks,
    isStandaloneInternalLink,
} from "./formatting"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "../baker/GrapherBakingUtils"
import * as cheerio from "cheerio"
import { Post } from "../db/model/Post"
import { BAKED_BASE_URL, BLOG_POSTS_PER_PAGE } from "../settings/serverSettings"
import { RECAPTCHA_SITE_KEY } from "../settings/clientSettings"
import {
    EntriesByYearPage,
    EntriesForYearPage,
} from "../site/EntriesByYearPage"
import { VariableCountryPage } from "../site/VariableCountryPage"
import { FeedbackPage } from "../site/FeedbackPage"
import { getCountry, Country } from "../clientUtils/countries"
import { memoize } from "../clientUtils/Util"
import { CountryProfileSpec } from "../site/countryProfileProjects"
import {
    FormattedPost,
    FormattingOptions,
    FullPost,
    JsonError,
    PostRow,
} from "../clientUtils/owidTypes"
import { formatPost } from "./formatWordpressPost"
import {
    getBlogIndex,
    getEntriesByCategory,
    getFullPost,
    getLatestPostRevision,
    getMediaThumbnailUrl,
    getPostBySlug,
    getPosts,
    isPostCitable,
} from "../db/wpdb"
import { mysqlFirst, queryMysql, knexTable } from "../db/db"
import { getPageOverrides, isPageOverridesCitable } from "./pageOverrides"
import { Url } from "../clientUtils/urls/Url"
import { logErrorAndMaybeSendToSlack } from "./slackLog"
import {
    ProminentLink,
    ProminentLinkStyles,
} from "../site/blocks/ProminentLink"
export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

export const renderChartsPage = async () => {
    const chartItems = (await queryMysql(`
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

    const chartTags = await queryMysql(`
        SELECT ct.chartId, ct.tagId, t.name as tagName, t.parentId as tagParentId FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `)

    for (const c of chartItems) {
        c.tags = []
    }

    const chartsById = lodash.keyBy(chartItems, (c) => c.id)

    for (const ct of chartTags) {
        const c = chartsById[ct.chartId]
        if (c) c.tags.push({ id: ct.tagId, name: ct.tagName })
    }

    return renderToHtmlPage(
        <ChartsIndexPage chartItems={chartItems} baseUrl={BAKED_BASE_URL} />
    )
}

// Only used in the dev server
export const renderCovidPage = () =>
    renderToHtmlPage(<CovidPage baseUrl={BAKED_BASE_URL} />)

export const renderPageBySlug = async (slug: string) => {
    const post = await getPostBySlug(slug)
    return renderPost(post)
}

export const renderPreview = async (postId: number): Promise<string> => {
    const postApi = await getLatestPostRevision(postId)
    return renderPost(postApi)
}

export const renderMenuJson = async () => {
    const categories = await getEntriesByCategory()
    return JSON.stringify({ categories: categories })
}

export const renderPost = async (
    post: FullPost,
    baseUrl: string = BAKED_BASE_URL,
    grapherExports?: GrapherExports
) => {
    let exportsByUrl = grapherExports

    if (!grapherExports) {
        const $ = cheerio.load(post.content)

        const grapherUrls = $("iframe")
            .toArray()
            .filter((el) => (el.attribs["src"] || "").match(/\/grapher\//))
            .map((el) => el.attribs["src"].trim())

        // This can be slow if uncached!
        await bakeGrapherUrls(grapherUrls)

        exportsByUrl = await getGrapherExportsByUrl()
    }

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)

    const formatted = await formatPost(post, formattingOptions, exportsByUrl)

    const pageOverrides = await getPageOverrides(post, formattingOptions)
    const citationStatus =
        (await isPostCitable(post)) || isPageOverridesCitable(pageOverrides)

    return renderToHtmlPage(
        <LongFormPage
            withCitation={citationStatus}
            post={formatted}
            overrides={pageOverrides}
            formattingOptions={formattingOptions}
            baseUrl={baseUrl}
        />
    )
}

export const renderFrontPage = async () => {
    const entries = await getEntriesByCategory()
    const posts = await getBlogIndex()
    const totalCharts = (
        await queryMysql(
            `SELECT COUNT(*) AS count
            FROM charts
            WHERE
                is_indexable IS TRUE
                AND publishedAt IS NOT NULL
                AND config -> "$.isPublished" IS TRUE`
        )
    )[0].count as number
    return renderToHtmlPage(
        <FrontPage
            entries={entries}
            posts={posts}
            totalCharts={totalCharts}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export const renderDonatePage = () =>
    renderToHtmlPage(
        <DonatePage
            baseUrl={BAKED_BASE_URL}
            recaptchaKey={RECAPTCHA_SITE_KEY}
        />
    )

export const renderBlogByPageNum = async (pageNum: number) => {
    const allPosts = await getBlogIndex()

    const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)
    const posts = allPosts.slice(
        (pageNum - 1) * BLOG_POSTS_PER_PAGE,
        pageNum * BLOG_POSTS_PER_PAGE
    )

    return renderToHtmlPage(
        <BlogIndexPage
            posts={posts}
            pageNum={pageNum}
            numPages={numPages}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export const renderSearchPage = () =>
    renderToHtmlPage(<SearchPage baseUrl={BAKED_BASE_URL} />)

export const renderNotFoundPage = () =>
    renderToHtmlPage(<NotFoundPage baseUrl={BAKED_BASE_URL} />)

export async function makeAtomFeed() {
    const postsApi = await getPosts(["post"], 10)
    const posts = await Promise.all(
        postsApi.map((postApi) => getFullPost(postApi, true))
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
    .map((post) => {
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
export const entriesByYearPage = async (year?: number) => {
    const entries = (await knexTable(Post.table)
        .where({ status: "publish" })
        .join("post_tags", { "post_tags.post_id": "posts.id" })
        .join("tags", { "tags.id": "post_tags.tag_id" })
        .where({ "tags.name": "Entries" })
        .select("title", "slug", "published_at")) as Pick<
        PostRow,
        "title" | "slug" | "published_at"
    >[]

    if (year !== undefined)
        return renderToHtmlPage(
            <EntriesForYearPage
                entries={entries}
                year={year}
                baseUrl={BAKED_BASE_URL}
            />
        )

    return renderToHtmlPage(
        <EntriesByYearPage entries={entries} baseUrl={BAKED_BASE_URL} />
    )
}

export const pagePerVariable = async (
    variableId: number,
    countryName: string
) => {
    const variable = await mysqlFirst(
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

    if (!variable) throw new JsonError(`No variable by id '${variableId}'`, 404)

    variable.display = JSON.parse(variable.display)
    variable.source = await mysqlFirst(
        `SELECT id, name FROM sources AS s WHERE id = ?`,
        variable.sourceId
    )

    const country = await knexTable("entities")
        .select("id", "name")
        .whereRaw("lower(name) = ?", [countryName])
        .first()

    return renderToHtmlPage(
        <VariableCountryPage
            variable={variable}
            country={country}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export const feedbackPage = () =>
    renderToHtmlPage(<FeedbackPage baseUrl={BAKED_BASE_URL} />)

const getCountryProfilePost = memoize(
    async (
        profileSpec: CountryProfileSpec,
        grapherExports?: GrapherExports
    ): Promise<[FormattedPost, FormattingOptions]> => {
        // Get formatted content from generic covid country profile page.
        const genericCountryProfilePost = await getPostBySlug(
            profileSpec.genericProfileSlug
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

// todo: we used to flush cache of this thing.
const getCountryProfileLandingPost = memoize(
    async (profileSpec: CountryProfileSpec) => {
        return getPostBySlug(profileSpec.landingPageSlug)
    }
)

export const renderCountryProfile = async (
    profileSpec: CountryProfileSpec,
    country: Country,
    grapherExports?: GrapherExports
) => {
    const [formatted, formattingOptions] = await getCountryProfilePost(
        profileSpec,
        grapherExports
    )

    const formattedCountryProfile = formatCountryProfile(formatted, country)

    const landing = await getCountryProfileLandingPost(profileSpec)

    const overrides: PageOverrides = {
        pageTitle: `${country.name}: ${profileSpec.pageTitle} Country Profile`,
        citationTitle: landing.title,
        citationSlug: landing.slug,
        citationCanonicalUrl: `${BAKED_BASE_URL}/${landing.slug}`,
        citationAuthors: landing.authors,
        citationPublicationDate: landing.date,
        canonicalUrl: `${BAKED_BASE_URL}/${profileSpec.rootPath}/${country.slug}`,
        excerpt: `${country.name}: ${formattedCountryProfile.excerpt}`,
    }
    return renderToHtmlPage(
        <LongFormPage
            withCitation={true}
            post={formattedCountryProfile}
            overrides={overrides}
            formattingOptions={formattingOptions}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export const countryProfileCountryPage = async (
    profileSpec: CountryProfileSpec,
    countrySlug: string
) => {
    const country = getCountry(countrySlug)
    if (!country) throw new JsonError(`No such country ${countrySlug}`, 404)

    // Voluntarily not dealing with grapherExports on devServer for simplicity
    return renderCountryProfile(profileSpec, country)
}

export const flushCache = () => getCountryProfilePost.cache.clear?.()

export const renderAutomaticProminentLinks = async (
    cheerioEl: CheerioStatic,
    currentPost: FullPost
) => {
    const anchorElements = cheerioEl("a").toArray()
    await Promise.all(
        anchorElements.map(async (anchor) => {
            if (!isStandaloneInternalLink(anchor, cheerioEl)) return
            const url = Url.fromURL(anchor.attribs.href)
            if (!url.slug) return

            let targetPost
            try {
                targetPost = await getPostBySlug(url.slug)
            } catch (err) {
                // not throwing here as this is not considered a critical error.
                // Standalone links will just show up as such (and get
                // netlify-redirected upon click if applicable).
                logErrorAndMaybeSendToSlack(
                    new Error(
                        `${currentPost.title} (${formatWordpressEditLink(
                            currentPost.id
                        )}) wants to convert ${
                            anchor.attribs.href
                        } into a prominent link but this URL doesn't match any post. This might be because the URL of the target has been recently changed.`
                    )
                )
            }
            if (!targetPost) return

            let image
            if (targetPost.imageId) {
                const mediaThumbnailUrl = await getMediaThumbnailUrl(
                    targetPost.imageId
                )
                if (mediaThumbnailUrl) {
                    image = ReactDOMServer.renderToStaticMarkup(
                        <img src={formatLinks(mediaThumbnailUrl)} />
                    )
                }
            }

            const rendered = ReactDOMServer.renderToStaticMarkup(
                <div className="block-wrapper">
                    <ProminentLink
                        href={anchor.attribs.href}
                        style={ProminentLinkStyles.thin}
                        title={targetPost.title}
                        image={image}
                    />
                </div>
            )

            const $anchorParent = cheerioEl(anchor.parent)
            $anchorParent.after(rendered)
            $anchorParent.remove()
        })
    )
}
