import { Hono } from "hono"
import { serveStatic } from "@hono/node-server/serve-static"
import path from "path"
import * as R from "remeda"
import {
    renderFrontPage,
    renderGdocsPageBySlug,
    renderPageBySlug,
    renderSearchPage,
    renderDonatePage,
    makeAtomFeed,
    feedbackPage,
    renderNotFoundPage,
    renderLatestPage,
    renderExplorerPage,
    makeAtomFeedNoTopicPages,
    renderDynamicCollectionPage,
    renderTopChartsCollectionPage,
    renderDataInsightsIndexPage,
    renderThankYouPage,
    makeDataInsightsAtomFeed,
    renderGdocTombstone,
    renderExplorerIndexPage,
    renderSubscribePage,
    renderGdoc,
} from "../baker/siteRenderers.js"
import {
    BASE_DIR,
    LEGACY_WORDPRESS_IMAGE_URL,
} from "../settings/serverSettings.js"

import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { makeSitemap } from "../baker/sitemap.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { getVariableData, getVariableMetadata } from "../db/model/Variable.js"
import { MultiEmbedderTestPage } from "../site/multiembedder/MultiEmbedderTestPage.js"
import {
    DbRawChartConfig,
    JsonError,
    parseChartConfig,
    TombstonePageData,
    gdocUrlRegex,
    OwidGdocMinimalPostInterface,
    ImageMetadata,
    queryParamsToStr,
    EnrichedBlockImage,
    OwidGdocType,
    getRegionBySlug,
    getEntitiesForProfile,
    ALL_GDOC_TYPES,
} from "@ourworldindata/utils"
import { checkShouldProfileRender } from "../db/model/Gdoc/dataCallouts.js"
import {
    EXPLORERS_ROUTE_FOLDER,
    explorerUrlMigrationsById,
} from "@ourworldindata/explorer"
import { getExplorerRedirectForPath } from "../explorerAdminServer/ExplorerRedirects.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import {
    renderPreviewDataPageOrGrapherPage,
    renderDataPageV2,
} from "../baker/GrapherBaker.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { getTombstoneBySlug } from "../db/model/GdocTombstone.js"
import * as db from "../db/db.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import {
    getPlainRouteNonIdempotentWithRWTransaction,
    getPlainRouteWithROTransaction,
} from "./plainRouterHelpers.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/SiteConstants.js"
import { renderMultiDimDataPageBySlug } from "../baker/MultiDimBaker.js"
import {
    KnexReadonlyTransaction,
    getImageMetadataByFilenames,
} from "../db/db.js"
import { getMinimalGdocPostsByIds } from "../db/model/Gdoc/GdocBase.js"
import { getMultiDimDataPageBySlug } from "../db/model/MultiDimDataPage.js"
import { getParsedDodsDictionary } from "../db/model/Dod.js"
import { getLatestArchivedPostPageVersionsIfEnabled } from "../db/model/ArchivedPostVersion.js"
import { TopicTag } from "../site/DataInsightsIndexPage.js"
import { getSlugForTopicTag } from "../baker/GrapherBakingUtils.js"
import { SEARCH_BASE_PATH } from "../site/search/searchUtils.js"
import {
    enrichLatestPageItems,
    getLatestPageItems,
} from "../db/model/Gdoc/GdocPost.js"
import { getAndLoadGdocBySlug } from "../db/model/Gdoc/GdocFactory.js"
import {
    instantiateProfileForEntity,
    GdocProfile,
} from "../db/model/Gdoc/GdocProfile.js"
import { AppVariables } from "./authentication.js"

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = new Hono<{ Variables: AppVariables }>()

getPlainRouteWithROTransaction(mockSiteRouter, "/atom.xml", async (c, trx) => {
    c.header("Content-Type", "application/xml")
    const atomFeed = await makeAtomFeed(trx)
    return c.html(atomFeed)
})

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/atom-no-topic-pages.xml",
    async (c, trx) => {
        c.header("Content-Type", "application/xml")
        const atomFeedNoTopicPages = await makeAtomFeedNoTopicPages(trx)
        return c.html(atomFeedNoTopicPages)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
    async (_c, trx) => {
        _c.header("Content-Type", "application/xml")
        const atomFeedDataInsights = await makeDataInsightsAtomFeed(trx)
        return _c.html(atomFeedDataInsights)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/sitemap.xml",
    async (c, trx) => {
        c.header("Content-Type", "application/xml")
        const sitemap = await makeSitemap(explorerAdminServer, trx)
        return c.html(sitemap)
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/data/:variableId.json",
    async (c) => {
        c.header("Access-Control-Allow-Origin", "*")
        return c.json(
            (await getVariableData(expectInt(c.req.param("variableId")!))).data
        )
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/metadata/:variableId.json",
    async (c) => {
        c.header("Access-Control-Allow-Origin", "*")
        const variableData = await getVariableData(
            expectInt(c.req.param("variableId")!)
        )
        return c.json(variableData.metadata)
    }
)

mockSiteRouter.get("/assets/embedCharts.js", async (c) => {
    c.header("Content-Type", "text/javascript")
    return c.text(generateEmbedSnippet())
})

const explorerAdminServer = new ExplorerAdminServer()

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}`,
    async (_c, trx) => {
        return _c.html(await renderExplorerIndexPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}/:slug`,
    async (c, trx) => {
        c.header("Access-Control-Allow-Origin", "*")
        const explorers =
            await explorerAdminServer.getAllPublishedExplorers(trx)
        const explorerProgram = explorers.find(
            (program) => program.slug === c.req.param("slug")!
        )
        if (explorerProgram) {
            const explorerPage = await renderExplorerPage(explorerProgram, trx)

            return c.html(explorerPage)
        } else
            throw new JsonError(
                "A published explorer with that slug was not found",
                404
            )
    }
)
getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/{*splat}",
    async (c, trx, next) => {
        const explorerRedirect = getExplorerRedirectForPath(c.req.path)
        // If no explorer redirect exists, continue to next handler
        if (!explorerRedirect) return next()

        const { migrationId, baseQueryStr } = explorerRedirect
        const { explorerSlug } = explorerUrlMigrationsById[migrationId]
        const program = await explorerAdminServer.getExplorerFromSlug(
            trx,
            explorerSlug
        )
        const explorerPage = await renderExplorerPage(program, trx, {
            urlMigrationSpec: {
                explorerUrlMigrationId: migrationId,
                baseQueryStr,
            },
        })
        return c.html(explorerPage)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/collection/top-charts",
    async (_c, trx) => {
        return _c.html(await renderTopChartsCollectionPage(trx))
    }
)

mockSiteRouter.get("/collection/custom", async (c) => {
    return c.html(renderDynamicCollectionPage())
})

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/by-uuid/:uuid.config.json",
    async (c, trx) => {
        const chartRow = await db.knexRawFirst<Pick<DbRawChartConfig, "full">>(
            trx,
            "SELECT full FROM chart_configs WHERE id = ?",
            [c.req.param("uuid")!]
        )
        if (!chartRow) throw new JsonError("No such chart", 404)
        const config = parseChartConfig(chartRow.full)
        return c.json(config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug.config.json",
    async (c, trx) => {
        const chartRow = await getChartConfigBySlug(trx, c.req.param("slug")!)
        return c.json(chartRow.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/multi-dim/:slug.json",
    async (c, trx) => {
        const multiDim = await getMultiDimDataPageBySlug(
            trx,
            c.req.param("slug")!,
            {
                onlyPublished: false,
            }
        )
        if (!multiDim) throw new JsonError("No such multi-dim", 404)
        return c.json(multiDim.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug",
    async (c, trx) => {
        const chartRow = await getChartConfigBySlug(
            trx,
            c.req.param("slug")!
        ).catch(console.error)
        if (chartRow) {
            // XXX add dev-prod parity for this
            c.header("Access-Control-Allow-Origin", "*")

            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chartRow.config,
                    chartRow.id,
                    chartRow.forceDatapage,
                    trx
                )
            return c.html(previewDataPageOrGrapherPage)
        } else {
            const page = await renderMultiDimDataPageBySlug(
                trx,
                c.req.param("slug")!
            ).catch(console.error)
            if (page) {
                return c.html(page)
            }
        }

        throw new JsonError("No such chart", 404)
    }
)

getPlainRouteWithROTransaction(mockSiteRouter, "/", async (_c, trx) => {
    const frontPage = await renderFrontPage(trx)
    return _c.html(frontPage)
})

getPlainRouteWithROTransaction(mockSiteRouter, "/donate", async (_c, trx) => {
    return _c.html(await renderDonatePage(trx))
})

mockSiteRouter.get("/thank-you", async (c) =>
    c.html(await renderThankYouPage())
)

mockSiteRouter.get("/subscribe", async (c) =>
    c.html(await renderSubscribePage())
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/data-insights{/:pageNumberOrSlug}",
    async (c, trx) => {
        const topicName = c.req.query("topic")
        const topicSlug = topicName
            ? await getSlugForTopicTag(trx, topicName)
            : undefined
        let topicTag: TopicTag | undefined =
            topicName && topicSlug
                ? {
                      name: topicName,
                      slug: topicSlug,
                  }
                : undefined

        const totalPageCount = calculateDataInsightIndexPageCount(
            await db.getPublishedDataInsightCount(trx, topicTag?.slug)
        )

        if (topicTag && topicTag.slug !== undefined) {
            // if topic slug is not a valid topic, render all data insights
            const validTopicSlugs = await db
                .getAllTopicTags(trx)
                .then((tags) => tags.map((tag) => tag.slug))
            if (!validTopicSlugs.includes(topicTag.slug)) {
                topicTag = undefined
            }
        }
        async function renderIndexPage(
            pageNumber: number,
            dataInsights: GdocDataInsight[],
            topicTag?: TopicTag
        ) {
            // calling fetchImageMetadata 20 times makes me sad, would be nice if we could cache this
            await Promise.all(
                dataInsights.map((insight) => insight.loadState(trx))
            )
            return renderDataInsightsIndexPage(
                dataInsights,
                pageNumber,
                totalPageCount,
                true,
                topicTag
            )
        }
        const pageNumberOrSlug = c.req.param("pageNumberOrSlug")!
        if (!pageNumberOrSlug) {
            const dataInsights = await GdocDataInsight.getPublishedDataInsights(
                trx,
                1,
                topicTag?.slug
            )
            return c.html(await renderIndexPage(1, dataInsights, topicTag))
        }

        const pageNumber = parseInt(pageNumberOrSlug)
        if (!isNaN(pageNumber)) {
            if (pageNumber < 1 || pageNumber > totalPageCount) {
                return c.redirect(
                    `/data-insights${topicName ? queryParamsToStr({ topic: topicName }) : ""}`
                )
            }
            const dataInsights = await GdocDataInsight.getPublishedDataInsights(
                trx,
                pageNumber,
                topicTag?.slug
            )
            // if no data insights are found, return NotFound page
            if (dataInsights.length === 0) {
                return c.html(renderNotFoundPage(), 404)
            }
            return c.html(
                await renderIndexPage(pageNumber, dataInsights, topicTag)
            )
        }

        try {
            const page = await renderGdocsPageBySlug(
                trx,
                pageNumberOrSlug,
                [OwidGdocType.DataInsight],
                true
            )
            return c.html(page!)
        } catch (e) {
            console.error(e)
            return c.html(renderNotFoundPage(), 404)
        }
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    SEARCH_BASE_PATH,
    async (_c, trx) => {
        return _c.html(await renderSearchPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/datapage-preview/:id",
    async (c, trx) => {
        const variableId = expectInt(c.req.param("id")!)
        const variableMetadata = await getVariableMetadata(variableId)

        return c.html(
            await renderDataPageV2(
                {
                    variableId,
                    variableMetadata,
                    isPreviewing: true,
                    useIndicatorGrapherConfigs: true,
                },
                trx
            )
        )
    }
)

const handleLatestPageRequest = async (
    trx: KnexReadonlyTransaction,
    pageNum: number
) => {
    const pageData = await getLatestPageItems(trx, pageNum, [
        OwidGdocType.Article,
        OwidGdocType.DataInsight,
        OwidGdocType.Announcement,
    ])

    const { linkedAuthors, imageMetadata, linkedDocuments, linkedCharts } =
        await enrichLatestPageItems(trx, pageData.items)

    return renderLatestPage(
        pageData.items,
        imageMetadata,
        linkedAuthors,
        linkedCharts,
        linkedDocuments,
        pageData.pagination.pageNum,
        pageData.pagination.totalPages
    )
}

getPlainRouteWithROTransaction(mockSiteRouter, "/latest", async (_c, trx) => {
    const latest = await handleLatestPageRequest(trx, 1)
    return _c.html(latest)
})

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/latest/page/:pageno",
    async (c, trx) => {
        const pagenum = parseInt(c.req.param("pageno")!, 10)
        if (isNaN(pagenum) || pagenum < 1) {
            throw new Error("invalid page number")
        }

        const html = await handleLatestPageRequest(trx, pagenum)
        return c.html(html)
    }
)

mockSiteRouter.get(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    "/uploads/*",
    (c) => {
        const assetPath = c.req.path.replace(/^\/(app\/)?uploads\//, "")
        const baseUrl = LEGACY_WORDPRESS_IMAGE_URL.replace(/\/+$/, "")
        const cleanPath = assetPath.replace(/^\/+/, "")
        const assetUrl = `${baseUrl}/${cleanPath}`
        return c.redirect(assetUrl)
    }
)

mockSiteRouter.get("/app/uploads/*", (c) => {
    const assetPath = c.req.path.replace(/^\/(app\/)?uploads\//, "")
    const baseUrl = LEGACY_WORDPRESS_IMAGE_URL.replace(/\/+$/, "")
    const cleanPath = assetPath.replace(/^\/+/, "")
    const assetUrl = `${baseUrl}/${cleanPath}`
    return c.redirect(assetUrl)
})

mockSiteRouter.use("/assets/*", serveStatic({ root: "dist" }))

mockSiteRouter.use(
    "/fonts/*",
    serveStatic({
        root: path.join(BASE_DIR, "public"),
        onFound: (_path, c) => {
            c.header("Access-Control-Allow-Origin", "*")
        },
    })
)

mockSiteRouter.use("/*", serveStatic({ root: path.join(BASE_DIR, "public") }))

mockSiteRouter.get("/feedback", async (c) => c.html(feedbackPage()))

mockSiteRouter.get("/multiEmbedderTest", async (c) =>
    c.html(renderToHtmlPage(MultiEmbedderTestPage()))
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/dods.json",
    async (_c, trx) => {
        _c.header("Access-Control-Allow-Origin", "*")
        const dods = await getParsedDodsDictionary(trx)
        return _c.json(dods as any)
    }
)

getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/team/:authorSlug",
    async (c, trx) => {
        try {
            const page = await renderGdocsPageBySlug(
                trx,
                c.req.param("authorSlug")!,
                [OwidGdocType.Author],
                true
            )
            return c.html(page!)
        } catch (e) {
            console.error(e)
            return c.html(renderNotFoundPage(), 404)
        }
    }
)

async function getTombstoneAttachments(
    knex: KnexReadonlyTransaction,
    { relatedLinkUrl, relatedLinkThumbnail }: TombstonePageData
) {
    const linkedGdocId = relatedLinkUrl?.match(gdocUrlRegex)?.[1]
    const linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    let linkedDocument: OwidGdocMinimalPostInterface | undefined
    let imageMetadata: Record<string, ImageMetadata> = {}
    if (linkedGdocId) {
        const posts = await getMinimalGdocPostsByIds(knex, [linkedGdocId])
        linkedDocument = posts[0]
        linkedDocuments[linkedGdocId] = linkedDocument
    }
    const imageFilename =
        relatedLinkThumbnail || linkedDocument?.["featured-image"]
    if (imageFilename) {
        imageMetadata = await getImageMetadataByFilenames(knex, [imageFilename])
    }
    return {
        imageMetadata,
        linkedCharts: {},
        linkedDocuments,
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/deleted/:tombstoneSlug",
    async (c, trx) => {
        const tombstone = await getTombstoneBySlug(
            trx,
            c.req.param("tombstoneSlug")!
        )
        if (!tombstone) {
            return c.html(renderNotFoundPage(), 404)
        }
        const archivedVersions =
            await getLatestArchivedPostPageVersionsIfEnabled(trx, [
                tombstone.gdocId,
            ])
        const pageData: TombstonePageData = {
            ...R.pick(tombstone, [
                "slug",
                "reason",
                "includeArchiveLink",
                "relatedLinkUrl",
                "relatedLinkTitle",
                "relatedLinkDescription",
                "relatedLinkThumbnail",
            ]),
            archiveUrl: tombstone.includeArchiveLink
                ? archivedVersions[tombstone.gdocId]?.archiveUrl
                : undefined,
        }
        const attachments = await getTombstoneAttachments(trx, pageData)
        return c.html(renderGdocTombstone(pageData, attachments), 404)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/topicTagGraph.json",
    async (_c, trx) => {
        const headerMenu = await db.generateTopicTagGraph(trx)
        return _c.json(headerMenu as any)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/dataInsights.json",
    async (_c, trx) => {
        const publishedDataInsights =
            await GdocDataInsight.getPublishedDataInsights(trx)
        const publishedDataInsightsForJson = publishedDataInsights.map((di) => {
            const firstImageIndex = di.content.body.findIndex(
                (block) => block.type === "image"
            )
            const firstImageBlock = di.content.body[firstImageIndex] as
                | EnrichedBlockImage
                | undefined
            const imgFilename =
                firstImageBlock?.smallFilename || firstImageBlock?.filename
            if (imgFilename) {
                di.imageMetadata = {
                    [imgFilename]: di.imageMetadata[imgFilename],
                }
            }

            // removes fields that are omitted from <DataInsightBody /> props
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { markdown, publicationContext, revisionId, ...rest } = di
            // removes data that isn't need for rendering the feed page (based on comments in DataInsightsIndexPage.tsx)
            // (but we kep tags b/c we need it to filter dataInsights.json)
            rest.linkedIndicators = {}
            rest.latestDataInsights = []

            return rest
        })
        return _c.json(publishedDataInsightsForJson as any)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/profile/:profileSlug/:entity",
    async (c, trx) => {
        const profileSlug = c.req.param("profileSlug")!
        const entityParam = c.req.param("entity")!

        if (!profileSlug || !entityParam) {
            return c.html(renderNotFoundPage(), 404)
        }

        try {
            const gdoc = await getAndLoadGdocBySlug(trx, profileSlug, [
                OwidGdocType.Profile,
            ])

            if (!gdoc || gdoc.content.type !== OwidGdocType.Profile) {
                return c.html(renderNotFoundPage(), 404)
            }

            const entity = getRegionBySlug(entityParam)
            if (!entity) {
                return c.html(renderNotFoundPage(), 404)
            }

            const entitiesInScope = getEntitiesForProfile(
                gdoc.content.scope,
                gdoc.content.exclude
            )
            const isEntityInScope = entitiesInScope.some(
                (profileEntity) => profileEntity.code === entity.code
            )
            if (!isEntityInScope) {
                return c.html(renderNotFoundPage(), 404)
            }

            const instantiatedProfile = await instantiateProfileForEntity(
                gdoc as GdocProfile,
                entity,
                { knex: trx }
            )

            if (!checkShouldProfileRender(instantiatedProfile.content)) {
                return c.html(renderNotFoundPage(), 404)
            }

            return c.html(renderGdoc(instantiatedProfile, true))
        } catch (error) {
            console.error("Error loading profile:", error)
            return c.html(renderNotFoundPage(), 404)
        }
    }
)

getPlainRouteWithROTransaction(mockSiteRouter, "/{*splat}", async (c, trx) => {
    // Remove leading and trailing slashes
    const slug = c.req.path.replace(/^\/|\/$/g, "")

    try {
        const page = await renderGdocsPageBySlug(
            trx,
            slug,
            // filter out the namespaced types that are handled above
            ALL_GDOC_TYPES.filter(
                (type) =>
                    type !== OwidGdocType.Profile &&
                    type !== OwidGdocType.DataInsight &&
                    type !== OwidGdocType.Author
            ),
            true
        )
        return c.html(page!)
    } catch (e) {
        console.error(e)
    }

    try {
        const page = await renderPageBySlug(slug, trx)
        return c.html(page)
    } catch (e) {
        console.error(e)
        return c.html(renderNotFoundPage(), 404)
    }
})

export { mockSiteRouter }
