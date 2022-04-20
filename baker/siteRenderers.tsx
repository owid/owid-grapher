import {
    formatWordpressEditLink,
    LongFormPage,
    PageOverrides,
} from "../site/LongFormPage.js"
import { BlogIndexPage } from "../site/BlogIndexPage.js"
import { FrontPage } from "../site/FrontPage.js"
import { ChartsIndexPage, ChartIndexItem } from "../site/ChartsIndexPage.js"
import { CovidPage } from "../site/CovidPage.js"
import { SearchPage } from "../site/SearchPage.js"
import { NotFoundPage } from "../site/NotFoundPage.js"
import { DonatePage } from "../site/DonatePage.js"
import React from "react"
import ReactDOMServer from "react-dom/server.js"
import * as lodash from "lodash"
import {
    extractFormattingOptions,
    formatCountryProfile,
    isCanonicalInternalUrl,
} from "./formatting.js"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "../baker/GrapherBakingUtils.js"
import * as cheerio from "cheerio"
import { Post } from "../db/model/Post.js"
import {
    BAKED_BASE_URL,
    BLOG_POSTS_PER_PAGE,
} from "../settings/serverSettings.js"
import { RECAPTCHA_SITE_KEY } from "../settings/clientSettings.js"
import {
    EntriesByYearPage,
    EntriesForYearPage,
} from "../site/EntriesByYearPage.js"
import { VariableCountryPage } from "../site/VariableCountryPage.js"
import { FeedbackPage } from "../site/FeedbackPage.js"
import { getCountry, Country } from "../clientUtils/countries.js"
import { memoize } from "../clientUtils/Util.js"
import { CountryProfileSpec } from "../site/countryProfileProjects.js"
import {
    FormattedPost,
    FormattingOptions,
    FullPost,
    JsonError,
    PostRow,
    WP_PostType,
} from "../clientUtils/owidTypes.js"
import { formatPost } from "./formatWordpressPost.js"
import {
    getBlogIndex,
    getEntriesByCategory,
    getFullPost,
    getLatestPostRevision,
    getPostBySlug,
    getPosts,
    selectHomepagePosts,
    isPostCitable,
    getBlockContent,
} from "../db/wpdb.js"
import { mysqlFirst, queryMysql, knexTable } from "../db/db.js"
import { getPageOverrides, isPageOverridesCitable } from "./pageOverrides.js"
import { Url } from "../clientUtils/urls/Url.js"
import { logContentErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"
import { ProminentLink } from "../site/blocks/ProminentLink.js"
import { formatUrls } from "../site/formatting.js"
import { renderHelp } from "../site/blocks/Help.js"
import { renderAdditionalInformation } from "../site/blocks/AdditionalInformation.js"

import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import {
    Grapher,
    GrapherProgrammaticInterface,
} from "../grapher/core/Grapher.js"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { ExplorerPageUrlMigrationSpec } from "../explorer/urlMigrations/ExplorerPageUrlMigrationSpec.js"
import { ExplorerPage } from "../site/ExplorerPage.js"
import { Chart } from "../db/model/Chart.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { ExplorerFullQueryParams } from "../explorer/ExplorerConstants.js"
import { resolveInternalRedirect } from "./redirects.js"
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
                AND config ->> "$.isPublished" = "true"`
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
    const postsApi = await getPosts([WP_PostType.Post], selectHomepagePosts, 10)
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
    const country = getCountry(countrySlug)
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
                    logContentErrorAndMaybeSendToSlack(
                        new Error(
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
                    ? await renderGrapherImageByChartSlug(resolvedUrl.slug)
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

export const renderBlocks = async (
    cheerioEl: CheerioStatic,
    containerPostId: number
) => {
    renderAdditionalInformation(cheerioEl)
    renderHelp(cheerioEl)
    await renderProminentLinks(cheerioEl, containerPostId)
}

export const renderExplorerPage = async (
    program: ExplorerProgram,
    urlMigrationSpec?: ExplorerPageUrlMigrationSpec
) => {
    const { requiredGrapherIds } = program.decisionMatrix
    let grapherConfigRows: any[] = []
    if (requiredGrapherIds.length)
        grapherConfigRows = await queryMysql(
            `SELECT id, config FROM charts WHERE id IN (?)`,
            [requiredGrapherIds]
        )

    const wpContent = program.wpBlockId
        ? await renderReusableBlock(
              await getBlockContent(program.wpBlockId),
              program.wpBlockId
          )
        : undefined

    const grapherConfigs: GrapherInterface[] = grapherConfigRows.map((row) => {
        const config: GrapherProgrammaticInterface = JSON.parse(row.config)
        config.id = row.id // Ensure each grapher has an id
        config.manuallyProvideData = true
        return new Grapher(config).toObject()
    })

    return (
        `<!doctype html>` +
        ReactDOMServer.renderToStaticMarkup(
            <ExplorerPage
                grapherConfigs={grapherConfigs}
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

const renderGrapherImageByChartSlug = async (
    chartSlug: string
): Promise<string | null> => {
    const chart = await Chart.getBySlug(chartSlug)
    if (!chart) return null

    const canonicalSlug = chart?.config?.slug
    if (!canonicalSlug) return null

    return `<img src="${BAKED_BASE_URL}/grapher/exports/${canonicalSlug}.svg" />`
}

const renderExplorerDefaultThumbnail = (): string => {
    return ReactDOMServer.renderToStaticMarkup(
        <img src={`${BAKED_BASE_URL}/default-thumbnail.jpg`} />
    )
}
