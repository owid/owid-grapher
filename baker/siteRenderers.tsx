import { LongFormPage, PageOverrides } from "../site/LongFormPage.js"
import { BlogIndexPage } from "../site/BlogIndexPage.js"
import { DataCatalogPage } from "../site/DataCatalog/DataCatalogPage.js"
import { DynamicCollectionPage } from "../site/collections/DynamicCollectionPage.js"
import { StaticCollectionPage } from "../site/collections/StaticCollectionPage.js"
import { SearchPage } from "../site/search/SearchPage.js"
import NotFoundPage from "../site/NotFoundPage.js"
import { DonatePage } from "../site/DonatePage.js"
import { ExplorerIndexPage } from "../site/ExplorerIndexPage.js"
import { ThankYouPage } from "../site/ThankYouPage.js"
import TombstonePage from "../site/TombstonePage.js"
import OwidGdocPage from "../site/gdocs/OwidGdocPage.js"
import React from "react"
import ReactDOMServer from "react-dom/server.js"
import * as lodash from "lodash"
import { formatCountryProfile, isCanonicalInternalUrl } from "./formatting.js"
import cheerio from "cheerio"
import {
    BAKED_BASE_URL,
    BLOG_POSTS_PER_PAGE,
    GDOCS_DONATE_FAQS_DOCUMENT_ID,
} from "../settings/serverSettings.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    RECAPTCHA_SITE_KEY,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../settings/clientSettings.js"
import { FeedbackPage } from "../site/FeedbackPage.js"
import {
    getCountryBySlug,
    Country,
    get,
    memoize,
    FormattedPost,
    FullPost,
    JsonError,
    Url,
    IndexPost,
    OwidGdocType,
    OwidGdoc,
    OwidGdocDataInsightInterface,
    TombstonePageData,
    mergeGrapherConfigs,
    createTagGraph,
} from "@ourworldindata/utils"
import { extractFormattingOptions } from "../serverUtils/wordpressUtils.js"
import {
    DEFAULT_THUMBNAIL_FILENAME,
    DbPlainChart,
    DbRawChartConfig,
    FormattingOptions,
    GrapherInterface,
} from "@ourworldindata/types"
import { CountryProfileSpec } from "../site/countryProfileProjects.js"
import { formatPost } from "./formatWordpressPost.js"
import {
    knexRaw,
    KnexReadonlyTransaction,
    getHomepageId,
    getFlatTagGraph,
    getPublishedExplorersBySlug,
} from "../db/db.js"
import { getPageOverrides, isPageOverridesCitable } from "./pageOverrides.js"
import { ProminentLink } from "../site/blocks/ProminentLink.js"
import { formatUrls } from "../site/formatting.js"

import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    ExplorerProgram,
    ExplorerPageUrlMigrationSpec,
    ExplorerFullQueryParams,
} from "@ourworldindata/explorer"
import { ExplorerPage } from "../site/ExplorerPage.js"
import { DataInsightsIndexPage } from "../site/DataInsightsIndexPage.js"
import {
    getChartConfigBySlug,
    getEnrichedChartById,
} from "../db/model/Chart.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { resolveInternalRedirect } from "./redirects.js"
import {
    getBlockContentFromSnapshot,
    getBlogIndex,
    getFullPostByIdFromSnapshot,
    getFullPostBySlugFromSnapshot,
    isPostSlugCitable,
} from "../db/model/Post.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    getAndLoadGdocBySlug,
    getAndLoadGdocById,
    getAndLoadPublishedDataInsightsPage,
} from "../db/model/Gdoc/GdocFactory.js"
import { transformExplorerProgramToResolveCatalogPaths } from "./ExplorerBaker.js"
import { Attachments, AttachmentsContext } from "../site/gdocs/OwidGdoc.js"
import AtomArticleBlocks from "../site/gdocs/components/AtomArticleBlocks.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"

export const renderToHtmlPage = (element: any) =>
    `<!doctype html>${ReactDOMServer.renderToStaticMarkup(element)}`

export const renderDataCatalogPage = async (knex: KnexReadonlyTransaction) => {
    const { __rootId, ...flatTagGraph } = await getFlatTagGraph(knex)
    const rootTagGraph = createTagGraph(flatTagGraph, __rootId)
    return renderToHtmlPage(
        <DataCatalogPage baseUrl={BAKED_BASE_URL} tagGraph={rootTagGraph} />
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

export const renderGdocsPageBySlug = async (
    knex: KnexReadonlyTransaction,
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

export function renderGdocTombstone(
    tombstone: TombstonePageData,
    attachments: Attachments
) {
    return renderToHtmlPage(
        <AttachmentsContext.Provider value={attachments}>
            <TombstonePage baseUrl={BAKED_BASE_URL} tombstone={tombstone} />
        </AttachmentsContext.Provider>
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
    baseUrl: string = BAKED_BASE_URL
) => {
    // Extract formatting options from post HTML comment (if any)
    const formattingOptions = extractFormattingOptions(post.content)

    const formatted = await formatPost(post, formattingOptions, knex)

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

export const renderFrontPage = async (knex: KnexReadonlyTransaction) => {
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

export const renderDonatePage = async (knex: KnexReadonlyTransaction) => {
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

export const renderBlogByPageNum = async (
    pageNum: number,
    knex: KnexReadonlyTransaction
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

export async function makeAtomFeed(knex: KnexReadonlyTransaction) {
    const posts = (await getBlogIndex(knex)).slice(0, 10)
    return makeAtomFeedFromPosts({ posts })
}

export async function makeDataInsightsAtomFeed(knex: KnexReadonlyTransaction) {
    const dataInsights = await getAndLoadPublishedDataInsightsPage(knex, 0)
    return makeAtomFeedFromDataInsights({
        dataInsights,
        htmlUrl: `${BAKED_BASE_URL}/data-insights`,
        feedUrl: `${BAKED_BASE_URL}/atom-data-insights.xml`,
    })
}

// We don't want to include topic pages in the atom feed that is being consumed
// by Mailchimp for sending the "immediate update" newsletter. Instead topic
// pages announcements are sent out manually.
export async function makeAtomFeedNoTopicPages(knex: KnexReadonlyTransaction) {
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

export async function makeAtomFeedFromDataInsights({
    dataInsights,
    htmlUrl = BAKED_BASE_URL,
    feedUrl = `${BAKED_BASE_URL}/atom.xml`,
}: {
    dataInsights: GdocDataInsight[]
    htmlUrl?: string
    feedUrl?: string
}) {
    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Our World in Data - Daily Data Insights</title>
<subtitle>Bite-sized insights on how the world is changing, written by our team</subtitle>
<id>${htmlUrl}/</id>
<link type="text/html" rel="alternate" href="${htmlUrl}"/>
<link type="application/atom+xml" rel="self" href="${feedUrl}"/>
<updated>${dataInsights[0].publishedAt?.toISOString()}</updated>
${dataInsights
    .map((post) => {
        const postUrl = `${BAKED_BASE_URL}/data-insights/${post.slug}`
        const content = ReactDOMServer.renderToStaticMarkup(
            <AttachmentsContext.Provider
                value={{
                    linkedAuthors: get(post, "linkedAuthors", []),
                    linkedDocuments: get(post, "linkedDocuments", {}),
                    imageMetadata: get(post, "imageMetadata", {}),
                    linkedCharts: get(post, "linkedCharts", {}),
                    linkedIndicators: get(post, "linkedIndicators", {}),
                    relatedCharts: get(post, "relatedCharts", []),
                    latestDataInsights: get(post, "latestDataInsights", []),
                    homepageMetadata: get(post, "homepageMetadata", {}),
                    latestWorkLinks: get(post, "latestWorkLinks", []),
                }}
            >
                <AtomArticleBlocks blocks={post.content.body} />
            </AttachmentsContext.Provider>
        )

        return `<entry>
            <title><![CDATA[${post.content.title}]]></title>
            <id>${postUrl}</id>
            <link rel="alternate" href="${postUrl}"/>
            <published>${post.publishedAt?.toISOString()}</published>
            <updated>${post.updatedAt?.toISOString()}</updated>
            ${post.content.authors
                .map(
                    (author: string) =>
                        `<author><name>${author}</name></author>`
                )
                .join("")}
            <content type="html"><![CDATA[${content}]]></content>
            </entry>`
    })
    .join("\n")}
</feed>`
}

export const feedbackPage = () =>
    renderToHtmlPage(<FeedbackPage baseUrl={BAKED_BASE_URL} />)

const getCountryProfilePost = memoize(
    async (
        profileSpec: CountryProfileSpec,
        knex: KnexReadonlyTransaction
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
            knex
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
    knex: KnexReadonlyTransaction
) => {
    const [formatted, formattingOptions] = await getCountryProfilePost(
        profileSpec,
        knex
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
    } catch {
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

export const renderExplorerIndexPage = async (
    knex: KnexReadonlyTransaction
): Promise<string> => {
    const explorersBySlug = await getPublishedExplorersBySlug(knex)
    const explorers = Object.values(explorersBySlug).sort((a, b) =>
        a.title.localeCompare(b.title)
    )

    return renderToHtmlPage(
        <ExplorerIndexPage baseUrl={BAKED_BASE_URL} explorers={explorers} />
    )
}

interface ExplorerRenderOpts {
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
    isPreviewing?: boolean
}

export const renderExplorerPage = async (
    program: ExplorerProgram,
    knex: KnexReadonlyTransaction,
    opts?: ExplorerRenderOpts
) => {
    const transformResult = await transformExplorerProgramToResolveCatalogPaths(
        program,
        knex
    )
    const { program: transformedProgram, unresolvedCatalogPaths } =
        transformResult
    if (unresolvedCatalogPaths?.size) {
        const errMessage = new JsonError(
            `${unresolvedCatalogPaths.size} catalog paths cannot be found for explorer ${transformedProgram.slug}: ${[...unresolvedCatalogPaths].join(", ")}.`
        )
        if (opts?.isPreviewing) console.error(errMessage)
        else void logErrorAndMaybeSendToBugsnag(errMessage)
    }

    // This needs to run after transformExplorerProgramToResolveCatalogPaths, so that the catalog paths
    // have already been resolved and all the required grapher and variable IDs are available
    const { requiredGrapherIds, requiredVariableIds } =
        transformedProgram.decisionMatrix

    type ChartRow = { id: number; config: string }
    let grapherConfigRows: ChartRow[] = []
    if (requiredGrapherIds.length)
        grapherConfigRows = await knexRaw<
            Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
        >(
            knex,
            `-- sql
                SELECT c.id, cc.full as config
                FROM charts c
                JOIN chart_configs cc ON c.configId=cc.id
                WHERE c.id IN (?)
            `,
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
            `-- sql
                SELECT
                    v.id,
                    cc_etl.patch AS grapherConfigETL,
                    cc_admin.patch AS grapherConfigAdmin
                FROM variables v
                    LEFT JOIN chart_configs cc_admin ON cc_admin.id=v.grapherConfigIdAdmin
                    LEFT JOIN chart_configs cc_etl ON cc_etl.id=v.grapherConfigIdETL
                WHERE v.id IN (?)
            `,
            [requiredVariableIds]
        )

        // check if all required variable IDs exist in the database
        const missingIds = requiredVariableIds.filter(
            (id) => !partialGrapherConfigRows.find((row) => row.id === id)
        )
        if (missingIds.length > 0) {
            void logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `Referenced variable IDs do not exist in the database for explorer ${transformedProgram.slug}: ${missingIds.join(", ")}.`
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
            const mergedConfig = mergeGrapherConfigs(etlConfig, adminConfig)
            // explorers set their own dimensions, so we don't need to include them here
            const mergedConfigWithoutDimensions = lodash.omit(
                mergedConfig,
                "dimensions"
            )
            return mergedConfigWithoutDimensions
        })

    const wpContent = transformedProgram.wpBlockId
        ? await renderReusableBlock(
              await getBlockContentFromSnapshot(
                  knex,
                  transformedProgram.wpBlockId
              ),
              transformedProgram.wpBlockId,
              knex
          )
        : undefined

    return (
        `<!doctype html>` +
        ReactDOMServer.renderToStaticMarkup(
            <ExplorerPage
                grapherConfigs={grapherConfigs}
                partialGrapherConfigs={partialGrapherConfigs}
                program={transformedProgram}
                wpContent={wpContent}
                baseUrl={BAKED_BASE_URL}
                urlMigrationSpec={opts?.urlMigrationSpec}
                isPreviewing={opts?.isPreviewing}
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
            explorer.explorerGrapherConfig.title ??
            (explorer.explorerGrapherConfig.grapherId
                ? (
                      await getEnrichedChartById(
                          knex,
                          explorer.explorerGrapherConfig.grapherId
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
    return `<img src="${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${chartSlug}.png" />`
}

const renderExplorerDefaultThumbnail = (): string => {
    return ReactDOMServer.renderToStaticMarkup(
        <img src={`${BAKED_BASE_URL}/${DEFAULT_THUMBNAIL_FILENAME}`} />
    )
}
