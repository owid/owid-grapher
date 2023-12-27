import {
    formatWordpressEditLink,
    LongFormPage,
    PageOverrides,
} from "../site/LongFormPage.js"
import { BlogIndexPage } from "../site/BlogIndexPage.js"
import { FrontPage } from "../site/FrontPage.js"
import { ChartsIndexPage, ChartIndexItem } from "../site/ChartsIndexPage.js"
import { DynamicCollectionPage } from "../site/collections/DynamicCollectionPage.js"
import { StaticCollectionPage } from "../site/collections/StaticCollectionPage.js"
import { SearchPage } from "../site/search/SearchPage.js"
import { NotFoundPage } from "../site/NotFoundPage.js"
import { DonatePage } from "../site/DonatePage.js"
import { ThankYouPage } from "../site/ThankYouPage.js"
import OwidGdocPage from "../site/gdocs/OwidGdocPage.js"
import React from "react"
import ReactDOMServer from "react-dom/server.js"
import * as lodash from "lodash"
import { formatCountryProfile, isCanonicalInternalUrl } from "./formatting.js"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "../baker/GrapherBakingUtils.js"
import cheerio from "cheerio"
import {
    BAKED_BASE_URL,
    BLOG_POSTS_PER_PAGE,
    GDOCS_DONATE_FAQS_DOCUMENT_ID,
    GDOCS_HOMEPAGE_CONFIG_DOCUMENT_ID,
} from "../settings/serverSettings.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
    RECAPTCHA_SITE_KEY,
} from "../settings/clientSettings.js"
import {
    EntriesByYearPage,
    EntriesForYearPage,
} from "../site/EntriesByYearPage.js"
import { FeedbackPage } from "../site/FeedbackPage.js"
import {
    getCountryBySlug,
    Country,
    memoize,
    FormattedPost,
    FullPost,
    JsonError,
    KeyInsight,
    Url,
    IndexPost,
    mergePartialGrapherConfigs,
    OwidGdocType,
    OwidGdoc,
    OwidGdocDataInsightInterface,
    extractFormattingOptions,
    PostRowRaw,
} from "@ourworldindata/utils"
import { FormattingOptions } from "@ourworldindata/types"
import { CountryProfileSpec } from "../site/countryProfileProjects.js"
import { formatPost } from "./formatWordpressPost.js"
import {
    getBlogIndex,
    getEntriesByCategory,
    getLatestPostRevision,
    getPostBySlug,
    isPostCitable,
    getBlockContent,
} from "../db/wpdb.js"
import { queryMysql, knexTable } from "../db/db.js"
import { getPageOverrides, isPageOverridesCitable } from "./pageOverrides.js"
import { ProminentLink } from "../site/blocks/ProminentLink.js"
import {
    KeyInsightsThumbs,
    KeyInsightsSlides,
    KEY_INSIGHTS_CLASS_NAME,
} from "../site/blocks/KeyInsights.js"
import { formatUrls, KEY_INSIGHTS_H2_CLASSNAME } from "../site/formatting.js"

import {
    GrapherInterface,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { ExplorerPageUrlMigrationSpec } from "../explorer/urlMigrations/ExplorerPageUrlMigrationSpec.js"
import { ExplorerPage } from "../site/ExplorerPage.js"
import { DataInsightsIndexPage } from "../site/DataInsightsIndexPage.js"
import { Chart } from "../db/model/Chart.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { ExplorerFullQueryParams } from "../explorer/ExplorerConstants.js"
import { resolveInternalRedirect } from "./redirects.js"
import { postsTable } from "../db/model/Post.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import { GdocFactory } from "../db/model/Gdoc/GdocFactory.js"

export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

export const renderChartsPage = async (
    explorerAdminServer: ExplorerAdminServer
) => {
    const explorers = await explorerAdminServer.getAllPublishedExplorers()

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
            AND config->>"$.isPublished" = "true"
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
        <ChartsIndexPage
            explorers={explorers}
            chartItems={chartItems}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export async function renderTopChartsCollectionPage() {
    const charts: string[] = await queryMysql(
        `
    SELECT SUBSTRING_INDEX(url, '/', -1) AS slug
    FROM analytics_pageviews
    WHERE url LIKE "%https://ourworldindata.org/grapher/%"
    ORDER BY views_14d DESC
    LIMIT 50
    `
    ).then((rows) => rows.map((row: { slug: string }) => row.slug))

    const props = {
        baseUrl: BAKED_BASE_URL,
        title: "Top Charts",
        introduction:
            "The 50 most viewed charts from the last 14 days on Our World in Data.",
        charts,
    }
    return renderToHtmlPage(<StaticCollectionPage {...props} />)
}

export function renderDynamicCollectionPage() {
    return renderToHtmlPage(<DynamicCollectionPage baseUrl={BAKED_BASE_URL} />)
}

export const renderGdocsPageBySlug = async (
    slug: string,
    isPreviewing: boolean = false
): Promise<string | undefined> => {
    const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    const publishedExplorersBySlug =
        await explorerAdminServer.getAllPublishedExplorersBySlug()

    const gdoc = await GdocFactory.loadBySlug(slug, publishedExplorersBySlug)
    if (!gdoc) {
        throw new Error(`Failed to render an unknown GDocs post: ${slug}.`)
    }

    await gdoc.loadState(publishedExplorersBySlug)

    return renderGdoc(gdoc, isPreviewing)
}

export const renderGdoc = (gdoc: OwidGdoc, isPreviewing: boolean = false) => {
    return renderToHtmlPage(
        <OwidGdocPage
            baseUrl={BAKED_BASE_URL}
            gdoc={gdoc}
            isPreviewing={isPreviewing}
        />
    )
}

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
    if (!grapherExports) {
        const $ = cheerio.load(post.content)

        const grapherUrls = $("iframe")
            .toArray()
            .filter((el) => (el.attribs["src"] || "").match(/\/grapher\//))
            .map((el) => el.attribs["src"].trim())

        // This can be slow if uncached!
        await bakeGrapherUrls(grapherUrls)

        grapherExports = await getGrapherExportsByUrl()
    }

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)

    const formatted = await formatPost(post, formattingOptions, grapherExports)

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
    const posts = await getBlogIndex()

    const NUM_FEATURED_POSTS = 6

    /**
     * A frontPageConfig should specify a list of
     * articles to feature in the featured work block,
     * and which position they should be placed in.
     *
     * Note that this can be underspecified, so some positions
     * may not be filled in.
     *
     */

    let featuredWork: IndexPost[]
    try {
        const frontPageConfigGdoc = await GdocPost.findOneBy({
            id: GDOCS_HOMEPAGE_CONFIG_DOCUMENT_ID,
        })
        if (!frontPageConfigGdoc) throw new Error("No front page config found")
        await frontPageConfigGdoc.loadState({})
        const frontPageConfig: any = frontPageConfigGdoc.content
        const featuredPosts: { slug: string; position: number }[] =
            frontPageConfig["featured-posts"] ?? []

        // Generate the candidate posts to fill in any missing slots
        const slugs = featuredPosts.map((d) => d.slug)
        const filteredPosts = posts.filter((post) => {
            return !slugs.includes(post.slug)
        })

        /**
         * Create the final list of featured work by merging the
         * manually curated list of posts and filling in any empty
         * positions with the latest available posts, while avoiding
         * adding any duplicates.
         */
        let missingPosts = 0
        featuredWork = [...new Array(NUM_FEATURED_POSTS)]
            .map((_, i) => i)
            .map((idx) => {
                const manuallySetPost = featuredPosts.find(
                    (d) => +d.position === idx + 1
                )
                if (manuallySetPost) {
                    const post = posts.find(
                        (post) => post.slug === manuallySetPost.slug
                    )
                    if (post) {
                        return post
                    }
                    console.log(
                        "Featured work error: could not find listed post with slug: ",
                        manuallySetPost.slug
                    )
                }
                return filteredPosts[missingPosts++]
            })
    } catch (e) {
        logErrorAndMaybeSendToBugsnag(e)
        featuredWork = posts.slice(0, 6)
    }

    const totalCharts = (
        await queryMysql(
            `SELECT COUNT(*) AS count
            FROM charts
            WHERE
                is_indexable IS TRUE
                AND publishedAt IS NOT NULL
                AND config ->> "$.isPublished" = "true"`
        )
    )[0].count as number
    return renderToHtmlPage(
        <FrontPage
            featuredWork={featuredWork}
            totalCharts={totalCharts}
            baseUrl={BAKED_BASE_URL}
        />
    )
}

export const renderDonatePage = async () => {
    const faqsGdoc = (await GdocFactory.load(
        GDOCS_DONATE_FAQS_DOCUMENT_ID,
        {}
    )) as GdocPost
    if (!faqsGdoc)
        throw new Error(
            `Failed to find donate FAQs Gdoc with id "${GDOCS_DONATE_FAQS_DOCUMENT_ID}"`
        )

    return renderToHtmlPage(
        <DonatePage
            baseUrl={BAKED_BASE_URL}
            faqsGdoc={faqsGdoc}
            recaptchaKey={RECAPTCHA_SITE_KEY}
        />
    )
}

export const renderThankYouPage = async () => {
    return renderToHtmlPage(<ThankYouPage baseUrl={BAKED_BASE_URL} />)
}

export const renderDataInsightsIndexPage = (
    dataInsights: OwidGdocDataInsightInterface[],
    page: number = 0,
    totalPageCount: number,
    isPreviewing: boolean = false
) => {
    return renderToHtmlPage(
        <DataInsightsIndexPage
            dataInsights={dataInsights}
            baseUrl={BAKED_BASE_URL}
            pageNumber={page}
            totalPageCount={totalPageCount}
            isPreviewing={isPreviewing}
        />
    )
}

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
    const posts = (await getBlogIndex()).slice(0, 10)
    return makeAtomFeedFromPosts(posts)
}

// We don't want to include topic pages in the atom feed that is being consumed
// by Mailchimp for sending the "immediate update" newsletter. Instead topic
// pages announcements are sent out manually.
export async function makeAtomFeedNoTopicPages() {
    const posts = (await getBlogIndex())
        .filter((post: IndexPost) => post.type !== OwidGdocType.TopicPage)
        .slice(0, 10)
    return makeAtomFeedFromPosts(posts)
}

export async function makeAtomFeedFromPosts(posts: IndexPost[]) {
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
        const postUrl = `${BAKED_BASE_URL}/${post.slug}`
        const image = post.imageUrl
            ? `<br><br><a href="${postUrl}" target="_blank"><img src="${encodeURI(
                  formatUrls(post.imageUrl)
              )}"/></a>`
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
    const entries = (await knexTable(postsTable)
        .where({ status: "publish" })
        .whereNot({ type: "wp_block" })
        .join("post_tags", { "post_tags.post_id": "posts.id" })
        .join("tags", { "tags.id": "post_tags.tag_id" })
        .where({ "tags.name": "Entries" })
        .select("title", "posts.slug", "published_at")) as Pick<
        PostRowRaw,
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
        pageDesc: `${country.name}: ${formattedCountryProfile.pageDesc}`,
        canonicalUrl: `${BAKED_BASE_URL}/${profileSpec.rootPath}/${country.slug}`,
        citationTitle: landing.title,
        citationSlug: landing.slug,
        citationCanonicalUrl: `${BAKED_BASE_URL}/${landing.slug}`,
        citationAuthors: landing.authors,
        citationPublicationDate: landing.date,
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
    const country = getCountryBySlug(countrySlug)
    if (!country) throw new JsonError(`No such country ${countrySlug}`, 404)

    // Voluntarily not dealing with grapherExports on devServer for simplicity
    return renderCountryProfile(profileSpec, country)
}

export const flushCache = () => getCountryProfilePost.cache.clear?.()

const renderPostThumbnailBySlug = async (
    slug: string | undefined
): Promise<string | undefined> => {
    if (!slug) return

    let post
    try {
        post = await getPostBySlug(slug)
    } catch (err) {
        // if no post is found, then we return early instead of throwing
    }

    if (!post?.thumbnailUrl) return
    return ReactDOMServer.renderToStaticMarkup(
        <img src={formatUrls(post.thumbnailUrl)} />
    )
}

export const renderProminentLinks = async (
    $: CheerioStatic,
    containerPostId: number
) => {
    const blocks = $("block[type='prominent-link']").toArray()
    await Promise.all(
        blocks.map(async (block) => {
            const $block = $(block)
            const formattedUrlString = $block.find("link-url").text() // never empty, see prominent-link.php
            const formattedUrl = Url.fromURL(formattedUrlString)

            const resolvedUrl = await resolveInternalRedirect(formattedUrl)
            const resolvedUrlString = resolvedUrl.fullUrl

            const style = $block.attr("style")
            const content = $block.find("content").html()

            let title
            try {
                title =
                    $block.find("title").text() ||
                    (!isCanonicalInternalUrl(resolvedUrl)
                        ? null // attempt fallback for internal urls only
                        : resolvedUrl.isExplorer
                        ? await getExplorerTitleByUrl(resolvedUrl)
                        : resolvedUrl.isGrapher && resolvedUrl.slug
                        ? (await Chart.getBySlug(resolvedUrl.slug))?.config
                              ?.title // optim?
                        : resolvedUrl.slug &&
                          (await getPostBySlug(resolvedUrl.slug)).title)
            } finally {
                if (!title) {
                    logErrorAndMaybeSendToBugsnag(
                        new JsonError(
                            `No fallback title found for prominent link ${resolvedUrlString} in ${formatWordpressEditLink(
                                containerPostId
                            )}. Block removed.`
                        )
                    )
                    $block.remove()
                    return
                }
            }

            const image =
                $block.find("figure").html() ||
                (!isCanonicalInternalUrl(resolvedUrl)
                    ? null
                    : resolvedUrl.isExplorer
                    ? renderExplorerDefaultThumbnail()
                    : resolvedUrl.isGrapher && resolvedUrl.slug
                    ? renderGrapherThumbnailByResolvedChartSlug(
                          resolvedUrl.slug
                      )
                    : await renderPostThumbnailBySlug(resolvedUrl.slug))

            const rendered = ReactDOMServer.renderToStaticMarkup(
                <div className="block-wrapper">
                    <ProminentLink
                        href={resolvedUrlString}
                        style={style}
                        title={title}
                        content={content}
                        image={image}
                    />
                </div>
            )

            $block.replaceWith(rendered)
        })
    )
}

export const renderReusableBlock = async (
    html: string | undefined,
    containerPostId: number
): Promise<string | undefined> => {
    if (!html) return

    const cheerioEl = cheerio.load(formatUrls(html))
    await renderProminentLinks(cheerioEl, containerPostId)

    return cheerioEl("body").html() ?? undefined
}

export const renderExplorerPage = async (
    program: ExplorerProgram,
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
) => {
    const { requiredGrapherIds, requiredVariableIds } = program.decisionMatrix

    type ChartRow = { id: number; config: string }
    let grapherConfigRows: ChartRow[] = []
    if (requiredGrapherIds.length)
        grapherConfigRows = await queryMysql(
            `SELECT id, config FROM charts WHERE id IN (?)`,
            [requiredGrapherIds]
        )

    let partialGrapherConfigRows: {
        id: number
        grapherConfigAdmin: string | null
        grapherConfigETL: string | null
    }[] = []
    if (requiredVariableIds.length) {
        partialGrapherConfigRows = await queryMysql(
            `SELECT id, grapherConfigETL, grapherConfigAdmin FROM variables WHERE id IN (?)`,
            [requiredVariableIds]
        )
    }

    const parseGrapherConfigFromRow = (row: ChartRow): GrapherInterface => {
        const config: GrapherProgrammaticInterface = JSON.parse(row.config)
        config.id = row.id // Ensure each grapher has an id
        config.adminBaseUrl = ADMIN_BASE_URL
        config.bakedGrapherURL = BAKED_GRAPHER_URL
        return config
    }
    const grapherConfigs = grapherConfigRows.map(parseGrapherConfigFromRow)
    const partialGrapherConfigs = partialGrapherConfigRows
        .filter((row) => row.grapherConfigAdmin || row.grapherConfigETL)
        .map((row) => {
            const adminConfig = row.grapherConfigAdmin
                ? parseGrapherConfigFromRow({
                      id: row.id,
                      config: row.grapherConfigAdmin as string,
                  })
                : {}
            const etlConfig = row.grapherConfigETL
                ? parseGrapherConfigFromRow({
                      id: row.id,
                      config: row.grapherConfigETL as string,
                  })
                : {}
            return mergePartialGrapherConfigs(etlConfig, adminConfig)
        })

    const wpContent = program.wpBlockId
        ? await renderReusableBlock(
              await getBlockContent(program.wpBlockId),
              program.wpBlockId
          )
        : undefined

    return (
        `<!doctype html>` +
        ReactDOMServer.renderToStaticMarkup(
            <ExplorerPage
                grapherConfigs={grapherConfigs}
                partialGrapherConfigs={partialGrapherConfigs}
                program={program}
                wpContent={wpContent}
                baseUrl={BAKED_BASE_URL}
                urlMigrationSpec={urlMigrationSpec}
            />
        )
    )
}

const getExplorerTitleByUrl = async (url: Url): Promise<string | undefined> => {
    if (!url.isExplorer || !url.slug) return
    // todo / optim: ok to instanciate multiple simple-git?
    const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    const explorer = await explorerAdminServer.getExplorerFromSlug(url.slug)
    if (!explorer) return

    if (url.queryStr) {
        explorer.initDecisionMatrix(url.queryParams as ExplorerFullQueryParams)
        return (
            explorer.grapherConfig.title ??
            (explorer.grapherConfig.grapherId
                ? (await Chart.getById(explorer.grapherConfig.grapherId))
                      ?.config?.title
                : undefined)
        )
    }
    return explorer.explorerTitle
}

/**
 * Renders a chart thumbnail given a slug. The slug is considered "resolved",
 * meaning it has gone through the internal URL resolver and is final from a
 * redirects perspective.
 */
const renderGrapherThumbnailByResolvedChartSlug = (
    chartSlug: string
): string | null => {
    return `<img src="${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chartSlug}.svg" />`
}

const renderExplorerDefaultThumbnail = (): string => {
    return ReactDOMServer.renderToStaticMarkup(
        <img src={`${BAKED_BASE_URL}/default-thumbnail.jpg`} />
    )
}

export const renderKeyInsights = async (
    html: string,
    containerPostId: number
): Promise<string> => {
    const $ = cheerio.load(html)

    for (const block of Array.from($("block[type='key-insights']"))) {
        const $block = $(block)
        // only selecting <title> and <slug> from direct children, to not match
        // titles and slugs from individual key insights slides.
        const title = $block.find("> title").text()
        const slug = $block.find("> slug").text()
        if (!title || !slug) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Title or anchor missing for key insights block, content removed in ${formatWordpressEditLink(
                        containerPostId
                    )}.`
                )
            )
            $block.remove()
            continue
        }

        const keyInsights = extractKeyInsights($, $block, containerPostId)
        if (!keyInsights.length) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `No valid key insights found within block, content removed in ${formatWordpressEditLink(
                        containerPostId
                    )}`
                )
            )
            $block.remove()
            continue
        }
        const titles = keyInsights.map((keyInsight) => keyInsight.title)

        const rendered = ReactDOMServer.renderToString(
            <>
                <h2 id={slug} className={KEY_INSIGHTS_H2_CLASSNAME}>
                    {title}
                </h2>
                <div className={`${KEY_INSIGHTS_CLASS_NAME}`}>
                    <div className="block-wrapper">
                        <KeyInsightsThumbs titles={titles} />
                    </div>
                    <KeyInsightsSlides insights={keyInsights} />
                </div>
            </>
        )

        $block.replaceWith(rendered)
    }
    return $.html()
}

export const extractKeyInsights = (
    $: CheerioStatic,
    $wrapper: Cheerio,
    containerPostId: number
): KeyInsight[] => {
    const keyInsights: KeyInsight[] = []

    for (const block of Array.from(
        $wrapper.find("block[type='key-insight']")
    )) {
        const $block = $(block)
        // restrictive children selector not strictly necessary here for now but
        // kept for consistency and evolutions of the block. In the future, key
        // insights could host other blocks with <title> tags
        const $title = $block.find("> title")
        const title = $title.text()
        const isTitleHidden = $title.attr("is-hidden") === "1"
        const slug = $block.find("> slug").text()
        const content = $block.find("> content").html()

        // "!content" is taken literally here. An empty paragraph will return
        // "\n\n<p></p>\n\n" and will not trigger an error. This can be seen
        // both as an unexpected behaviour or a feature, depending on the stage
        // of work (published or WIP).
        if (!title || !slug || !content) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Missing title, slug or content for key insight ${
                        title || slug
                    }, content removed in ${formatWordpressEditLink(
                        containerPostId
                    )}.`
                )
            )
            continue
        }

        keyInsights.push({ title, isTitleHidden, content, slug })
    }

    return keyInsights
}
