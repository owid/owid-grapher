import { LongFormPage, PageOverrides } from "../site/LongFormPage.js"
import { BlogIndexPage } from "../site/BlogIndexPage.js"
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
    Url,
    IndexPost,
    mergePartialGrapherConfigs,
    OwidGdocType,
    OwidGdoc,
    OwidGdocDataInsightInterface,
    DbRawPost,
} from "@ourworldindata/utils"
import { extractFormattingOptions } from "../serverUtils/wordpressUtils.js"
import { FormattingOptions, GrapherInterface } from "@ourworldindata/types"
import { CountryProfileSpec } from "../site/countryProfileProjects.js"
import { formatPost } from "./formatWordpressPost.js"
import {
    knexRaw,
    KnexReadWriteTransaction,
    KnexReadonlyTransaction,
    getHomepageId,
    getPublishedDataInsights,
} from "../db/db.js"
import { getPageOverrides, isPageOverridesCitable } from "./pageOverrides.js"
import { ProminentLink } from "../site/blocks/ProminentLink.js"
import { formatUrls } from "../site/formatting.js"

import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { ExplorerPageUrlMigrationSpec } from "../explorer/urlMigrations/ExplorerPageUrlMigrationSpec.js"
import { ExplorerPage } from "../site/ExplorerPage.js"
import { DataInsightsIndexPage } from "../site/DataInsightsIndexPage.js"
import {
    getChartConfigBySlug,
    getEnrichedChartById,
} from "../db/model/Chart.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { ExplorerFullQueryParams } from "../explorer/ExplorerConstants.js"
import { resolveInternalRedirect } from "./redirects.js"
import {
    getBlockContentFromSnapshot,
    getBlogIndex,
    getFullPostByIdFromSnapshot,
    getFullPostBySlugFromSnapshot,
    isPostSlugCitable,
    postsTable,
} from "../db/model/Post.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    getAndLoadGdocBySlug,
    getAndLoadGdocById,
} from "../db/model/Gdoc/GdocFactory.js"

export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

export const renderChartsPage = async (
    knex: KnexReadonlyTransaction,
    explorerAdminServer: ExplorerAdminServer
) => {
    const explorers = await explorerAdminServer.getAllPublishedExplorers()

    const chartItems = await knexRaw<ChartIndexItem>(
        knex,
        `-- sql
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
    `
    )

    const chartTags = await knexRaw<{
        chartId: number
        tagId: number
        tagName: string
        tagParentId: number
    }>(
        knex,
        `-- sql
        SELECT ct.chartId, ct.tagId, t.name as tagName, t.parentId as tagParentId FROM chart_tags ct
        JOIN charts c ON c.id=ct.chartId
        JOIN tags t ON t.id=ct.tagId
    `
    )

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

export async function renderTopChartsCollectionPage(
    knex: KnexReadonlyTransaction
) {
    const charts: string[] = await knexRaw<{ slug: string }>(
        knex,
        `-- sql
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

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const renderGdocsPageBySlug = async (
    knex: KnexReadWriteTransaction,
    slug: string,
    isPreviewing: boolean = false
): Promise<string | undefined> => {
    const gdoc = await getAndLoadGdocBySlug(knex, slug)
    if (!gdoc) {
        throw new Error(`Failed to render an unknown GDocs post: ${slug}.`)
    }

    await gdoc.loadState(knex)

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

export const renderPageBySlug = async (
    slug: string,
    knex: KnexReadonlyTransaction
) => {
    const post = await getFullPostBySlugFromSnapshot(knex, slug)
    return renderPost(post, knex)
}

export const renderPreview = async (
    postId: number,
    knex: KnexReadonlyTransaction
): Promise<string> => {
    const postApi = await getFullPostByIdFromSnapshot(knex, postId)
    return renderPost(postApi, knex)
}

export const renderPost = async (
    post: FullPost,
    knex: KnexReadonlyTransaction,
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
        await bakeGrapherUrls(knex, grapherUrls)

        grapherExports = await getGrapherExportsByUrl()
    }

    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)

    const formatted = await formatPost(
        post,
        formattingOptions,
        knex,
        grapherExports
    )

    const pageOverrides = await getPageOverrides(knex, post, formattingOptions)
    const citationStatus =
        isPostSlugCitable(post.slug) || isPageOverridesCitable(pageOverrides)

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

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const renderFrontPage = async (knex: KnexReadWriteTransaction) => {
    const gdocHomepageId = await getHomepageId(knex)

    if (gdocHomepageId) {
        const gdocHomepage = await getAndLoadGdocById(knex, gdocHomepageId)
        await gdocHomepage.loadState(knex)
        return renderGdoc(gdocHomepage)
    } else {
        await logErrorAndMaybeSendToBugsnag(
            new JsonError(
                `Failed to find homepage Gdoc with type "${OwidGdocType.Homepage}"`
            )
        )
        return ""
    }
}

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const renderDonatePage = async (knex: KnexReadWriteTransaction) => {
    const faqsGdoc = (await getAndLoadGdocById(
        knex,
        GDOCS_DONATE_FAQS_DOCUMENT_ID
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

// TODO: this transaction is only RW because somewhere inside it we fetch images
export const renderBlogByPageNum = async (
    pageNum: number,
    knex: KnexReadWriteTransaction
) => {
    const allPosts = await getBlogIndex(knex)

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

// TODO: this transaction is only RW because somewhere inside it we fetch images
export async function makeAtomFeed(knex: KnexReadWriteTransaction) {
    const posts = (await getBlogIndex(knex)).slice(0, 10)
    return makeAtomFeedFromPosts({ posts })
}

export async function makeDataInsightsAtomFeed(knex: KnexReadonlyTransaction) {
    const dataInsights = await getPublishedDataInsights(knex).then((results) =>
        results.slice(0, 10).map((di) => ({
            authors: di.authors,
            title: di.title,
            date: new Date(di.publishedAt),
            modifiedDate: new Date(di.updatedAt),
            slug: di.slug,
            type: OwidGdocType.DataInsight,
        }))
    )
    return makeAtomFeedFromPosts({
        posts: dataInsights,
        title: "Our World in Data - Data Insights",
        htmlUrl: `${BAKED_BASE_URL}/data-insights`,
        feedUrl: `${BAKED_BASE_URL}/atom-data-insights.xml`,
        subtitle:
            "Bite-sized insights on how the world is changing, written by our team",
    })
}

// We don't want to include topic pages in the atom feed that is being consumed
// by Mailchimp for sending the "immediate update" newsletter. Instead topic
// pages announcements are sent out manually.

// TODO: this transaction is only RW because somewhere inside it we fetch images
export async function makeAtomFeedNoTopicPages(knex: KnexReadWriteTransaction) {
    const posts = (await getBlogIndex(knex))
        .filter((post: IndexPost) => post.type !== OwidGdocType.TopicPage)
        .slice(0, 10)
    return makeAtomFeedFromPosts({ posts })
}

export async function makeAtomFeedFromPosts({
    posts,
    title = "Our World in Data",
    subtitle = "Research and data to make progress against the world’s largest problems",
    htmlUrl = BAKED_BASE_URL,
    feedUrl = `${BAKED_BASE_URL}/atom.xml`,
}: {
    posts: IndexPost[]
    title?: string
    subtitle?: string
    htmlUrl?: string
    feedUrl?: string
}) {
    const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>${title}</title>
<subtitle>${subtitle}</subtitle>
<id>${htmlUrl}/</id>
<link type="text/html" rel="alternate" href="${htmlUrl}"/>
<link type="application/atom+xml" rel="self" href="${feedUrl}"/>
<updated>${posts[0].date.toISOString()}</updated>
${posts
    .map((post) => {
        const postUrl =
            post.type === OwidGdocType.DataInsight
                ? `${BAKED_BASE_URL}/data-insights/${post.slug}`
                : `${BAKED_BASE_URL}/${post.slug}`
        const image = post.imageUrl
            ? `<br><br><a href="${postUrl}" target="_blank"><img src="${encodeURI(
                  formatUrls(post.imageUrl)
              )}"/></a>`
            : ""
        const summary = post.excerpt
            ? `<summary><![CDATA[${post.excerpt}${image}]]></summary>`
            : ``

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
            ${summary}
            </entry>`
    })
    .join("\n")}
</feed>
`

    return feed
}

// These pages exist largely just for Google Scholar
export const entriesByYearPage = async (
    trx: KnexReadonlyTransaction,
    year?: number
) => {
    const entries = (await trx
        .table(postsTable)
        .where({ status: "publish" })
        .whereNot({ type: "wp_block" })
        .join("post_tags", { "post_tags.post_id": "posts.id" })
        .join("tags", { "tags.id": "post_tags.tag_id" })
        .where({ "tags.name": "Entries" })
        .select("title", "posts.slug", "published_at")) as Pick<
        DbRawPost,
        "title" | "slug" | "published_at"
    >[]

    // TODO: include topic pages here once knex refactor is done

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
        knex: KnexReadonlyTransaction,
        grapherExports?: GrapherExports
    ): Promise<[FormattedPost, FormattingOptions]> => {
        // Get formatted content from generic covid country profile page.
        const genericCountryProfilePost = await getFullPostBySlugFromSnapshot(
            knex,
            profileSpec.genericProfileSlug
        )

        const profileFormattingOptions = extractFormattingOptions(
            genericCountryProfilePost.content
        )
        const formattedPost = await formatPost(
            genericCountryProfilePost,
            profileFormattingOptions,
            knex,
            grapherExports
        )

        return [formattedPost, profileFormattingOptions]
    }
)

// todo: we used to flush cache of this thing.
const getCountryProfileLandingPost = memoize(
    async (knex: KnexReadonlyTransaction, profileSpec: CountryProfileSpec) => {
        return getFullPostBySlugFromSnapshot(knex, profileSpec.landingPageSlug)
    }
)

export const renderCountryProfile = async (
    profileSpec: CountryProfileSpec,
    country: Country,
    knex: KnexReadonlyTransaction,
    grapherExports?: GrapherExports
) => {
    const [formatted, formattingOptions] = await getCountryProfilePost(
        profileSpec,
        knex,
        grapherExports
    )

    const formattedCountryProfile = formatCountryProfile(formatted, country)

    const landing = await getCountryProfileLandingPost(knex, profileSpec)

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
    countrySlug: string,
    knex: KnexReadonlyTransaction
) => {
    const country = getCountryBySlug(countrySlug)
    if (!country) throw new JsonError(`No such country ${countrySlug}`, 404)

    // Voluntarily not dealing with grapherExports on devServer for simplicity
    return renderCountryProfile(profileSpec, country, knex)
}

export const flushCache = () => getCountryProfilePost.cache.clear?.()

const renderPostThumbnailBySlug = async (
    knex: KnexReadonlyTransaction,
    slug: string | undefined
): Promise<string | undefined> => {
    if (!slug) return

    let post
    try {
        post = await getFullPostBySlugFromSnapshot(knex, slug)
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
    containerPostId: number,
    knex: KnexReadonlyTransaction
) => {
    const blocks = $("block[type='prominent-link']").toArray()
    await Promise.all(
        blocks.map(async (block) => {
            const $block = $(block)
            const formattedUrlString = $block.find("link-url").text() // never empty, see prominent-link.php
            const formattedUrl = Url.fromURL(formattedUrlString)

            const resolvedUrl = await resolveInternalRedirect(
                formattedUrl,
                knex
            )
            const resolvedUrlString = resolvedUrl.fullUrl

            const style = $block.attr("style")
            const content = $block.find("content").html()

            let title
            try {
                // TODO: consider prefetching the related information instead of inline with 3 awaits here
                title =
                    $block.find("title").text() ||
                    (!isCanonicalInternalUrl(resolvedUrl)
                        ? null // attempt fallback for internal urls only
                        : resolvedUrl.isExplorer
                          ? await getExplorerTitleByUrl(knex, resolvedUrl)
                          : resolvedUrl.isGrapher && resolvedUrl.slug
                            ? (
                                  await getChartConfigBySlug(
                                      knex,
                                      resolvedUrl.slug
                                  )
                              )?.config?.title // optim?
                            : resolvedUrl.slug &&
                              (
                                  await getFullPostBySlugFromSnapshot(
                                      knex,
                                      resolvedUrl.slug
                                  )
                              ).title)
            } finally {
                if (!title) {
                    void logErrorAndMaybeSendToBugsnag(
                        new JsonError(
                            `No fallback title found for prominent link ${resolvedUrlString} in wordpress post with id ${containerPostId}. Block removed.`
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
                        : await renderPostThumbnailBySlug(
                              knex,
                              resolvedUrl.slug
                          ))

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
    containerPostId: number,
    knex: KnexReadonlyTransaction
): Promise<string | undefined> => {
    if (!html) return

    const cheerioEl = cheerio.load(formatUrls(html))
    await renderProminentLinks(cheerioEl, containerPostId, knex)

    return cheerioEl("body").html() ?? undefined
}

export const renderExplorerPage = async (
    program: ExplorerProgram,
    knex: KnexReadonlyTransaction,
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
) => {
    const { requiredGrapherIds, requiredVariableIds } = program.decisionMatrix

    type ChartRow = { id: number; config: string }
    let grapherConfigRows: ChartRow[] = []
    if (requiredGrapherIds.length)
        grapherConfigRows = await knexRaw(
            knex,
            `SELECT id, config FROM charts WHERE id IN (?)`,
            [requiredGrapherIds]
        )

    let partialGrapherConfigRows: {
        id: number
        grapherConfigAdmin: string | null
        grapherConfigETL: string | null
    }[] = []
    if (requiredVariableIds.length) {
        partialGrapherConfigRows = await knexRaw(
            knex,
            `SELECT id, grapherConfigETL, grapherConfigAdmin FROM variables WHERE id IN (?)`,
            [requiredVariableIds]
        )

        // check if all required variable IDs exist in the database
        const missingIds = requiredVariableIds.filter(
            (id) => !partialGrapherConfigRows.find((row) => row.id === id)
        )
        if (missingIds.length > 0) {
            void logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Referenced variable IDs do not exist in the database for explorer ${program.slug}: ${missingIds.join(", ")}.`
                )
            )
        }
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
              await getBlockContentFromSnapshot(knex, program.wpBlockId),
              program.wpBlockId,
              knex
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

const getExplorerTitleByUrl = async (
    knex: KnexReadonlyTransaction,
    url: Url
): Promise<string | undefined> => {
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
                ? (
                      await getEnrichedChartById(
                          knex,
                          explorer.grapherConfig.grapherId
                      )
                  )?.config?.title
                : undefined)
        )
    }
    // Maintaining old behaviour so that we don't have to redesign WP prominent links
    // since we're removing WP soon
    return `${explorer.explorerTitle} Data Explorer`
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
