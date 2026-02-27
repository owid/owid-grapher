import express, { Router } from "express"
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
    BAKED_BASE_URL,
    BASE_DIR,
    LEGACY_WORDPRESS_IMAGE_URL,
} from "../settings/serverSettings.js"

import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import {
    countriesIndexPage,
    countryIndexPage,
} from "../baker/countryIndexes.js"
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

// todo: switch to an object literal where the key is the path and the value is the request handler? easier to test, reflect on, and manipulate
const mockSiteRouter = Router()

mockSiteRouter.use(express.urlencoded({ extended: true }))
mockSiteRouter.use(express.json())

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/atom.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeed = await makeAtomFeed(trx)
        res.send(atomFeed)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/atom-no-topic-pages.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeedNoTopicPages = await makeAtomFeedNoTopicPages(trx)
        res.send(atomFeedNoTopicPages)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
    async (_, res, trx) => {
        res.set("Content-Type", "application/xml")
        const atomFeedDataInsights = await makeDataInsightsAtomFeed(trx)
        res.send(atomFeedDataInsights)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/sitemap.xml",
    async (req, res, trx) => {
        res.set("Content-Type", "application/xml")
        const sitemap = await makeSitemap(explorerAdminServer, trx)
        res.send(sitemap)
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/data/:variableId.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        res.json((await getVariableData(expectInt(req.params.variableId))).data)
    }
)

mockSiteRouter.get(
    "/grapher/data/variables/metadata/:variableId.json",
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*")
        const variableData = await getVariableData(
            expectInt(req.params.variableId)
        )
        res.json(variableData.metadata)
    }
)

mockSiteRouter.get("/assets/embedCharts.js", async (req, res) => {
    res.contentType("text/javascript").send(generateEmbedSnippet())
})

const explorerAdminServer = new ExplorerAdminServer()

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}`,
    async (_, res, trx) => {
        return res.send(await renderExplorerIndexPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    `/${EXPLORERS_ROUTE_FOLDER}/:slug`,
    async (req, res, trx) => {
        res.set("Access-Control-Allow-Origin", "*")
        const explorers =
            await explorerAdminServer.getAllPublishedExplorers(trx)
        const explorerProgram = explorers.find(
            (program) => program.slug === req.params.slug
        )
        if (explorerProgram) {
            const explorerPage = await renderExplorerPage(explorerProgram, trx)

            res.send(explorerPage)
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
    async (req, res, trx, next) => {
        const explorerRedirect = getExplorerRedirectForPath(req.path)
        // If no explorer redirect exists, continue to next express handler
        if (!explorerRedirect) return next?.()

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
        res.send(explorerPage)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/collection/top-charts",
    async (_, res, trx) => {
        return res.send(await renderTopChartsCollectionPage(trx))
    }
)

mockSiteRouter.get("/collection/custom", async (_, res) => {
    return res.send(await renderDynamicCollectionPage())
})

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/by-uuid/:uuid.config.json",
    async (req, res, trx) => {
        const chartRow = await db.knexRawFirst<Pick<DbRawChartConfig, "full">>(
            trx,
            "SELECT full FROM chart_configs WHERE id = ?",
            [req.params.uuid]
        )
        if (!chartRow) throw new JsonError("No such chart", 404)
        const config = parseChartConfig(chartRow.full)
        res.json(config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug.config.json",
    async (req, res, trx) => {
        const chartRow = await getChartConfigBySlug(trx, req.params.slug)
        res.json(chartRow.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/multi-dim/:slug.json",
    async (req, res, trx) => {
        const multiDim = await getMultiDimDataPageBySlug(trx, req.params.slug, {
            onlyPublished: false,
        })
        if (!multiDim) throw new JsonError("No such multi-dim", 404)
        res.json(multiDim.config)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/grapher/:slug",
    async (req, res, trx) => {
        const chartRow = await getChartConfigBySlug(trx, req.params.slug).catch(
            console.error
        )
        if (chartRow) {
            // XXX add dev-prod parity for this
            res.set("Access-Control-Allow-Origin", "*")

            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(
                    chartRow.config,
                    chartRow.id,
                    chartRow.forceDatapage,
                    trx
                )
            res.send(previewDataPageOrGrapherPage)
            return
        } else {
            const page = await renderMultiDimDataPageBySlug(
                trx,
                req.params.slug
            ).catch(console.error)
            if (page) {
                res.send(page)
                return
            }
        }

        throw new JsonError("No such chart", 404)
    }
)

getPlainRouteWithROTransaction(mockSiteRouter, "/", async (_, res, trx) => {
    const frontPage = await renderFrontPage(trx)
    res.send(frontPage)
})

getPlainRouteWithROTransaction(mockSiteRouter, "/donate", async (_, res, trx) =>
    res.send(await renderDonatePage(trx))
)

mockSiteRouter.get("/thank-you", async (req, res) =>
    res.send(await renderThankYouPage())
)

mockSiteRouter.get("/subscribe", async (req, res) =>
    res.send(await renderSubscribePage())
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/data-insights{/:pageNumberOrSlug}",
    async (req, res, trx) => {
        const topicName = req.query.topic as string | undefined
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
        const pageNumberOrSlug = req.params.pageNumberOrSlug
        if (!pageNumberOrSlug) {
            const dataInsights = await GdocDataInsight.getPublishedDataInsights(
                trx,
                1,
                topicTag?.slug
            )
            return res.send(await renderIndexPage(1, dataInsights, topicTag))
        }

        const pageNumber = parseInt(pageNumberOrSlug)
        if (!isNaN(pageNumber)) {
            if (pageNumber < 1 || pageNumber > totalPageCount) {
                return res.redirect(
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
                return res.status(404).send(renderNotFoundPage())
            }
            return res.send(
                await renderIndexPage(pageNumber, dataInsights, topicTag)
            )
        }

        try {
            return res.send(
                await renderGdocsPageBySlug(
                    trx,
                    pageNumberOrSlug,
                    [OwidGdocType.DataInsight],
                    true
                )
            )
        } catch (e) {
            console.error(e)
            return res.status(404).send(renderNotFoundPage())
        }
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    SEARCH_BASE_PATH,
    async (_, res, trx) => {
        res.send(await renderSearchPage(trx))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/datapage-preview/:id",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.id)
        const variableMetadata = await getVariableMetadata(variableId)

        res.send(
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

getPlainRouteWithROTransaction(
    mockSiteRouter,
    SEARCH_BASE_PATH,
    async (_, res, trx) => res.send(await renderSearchPage(trx))
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

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/latest",
    async (_, res, trx) => {
        const latest = await handleLatestPageRequest(trx, 1)
        res.send(latest)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/latest/page/:pageno",
    async (req, res, trx) => {
        const pagenum = parseInt(req.params.pageno, 10)
        if (isNaN(pagenum) || pagenum < 1) {
            throw new Error("invalid page number")
        }

        const html = await handleLatestPageRequest(trx, pagenum)
        res.send(html)
    }
)

mockSiteRouter.use(
    // Not all /app/uploads paths are going through formatting
    // and being rewritten as /uploads. E.g. blog index images paths
    // on front page.
    ["/uploads", "/app/uploads"],
    (req, res) => {
        const assetPath = req.path.replace(/^\/(app\/)?uploads\//, "")
        // Ensure no trailing slash on the base URL and manage the slash between URLs safely
        const baseUrl = LEGACY_WORDPRESS_IMAGE_URL.replace(/\/+$/, "")
        const path = assetPath.replace(/^\/+/, "")
        const assetUrl = `${baseUrl}/${path}`
        res.redirect(assetUrl)
    }
)

mockSiteRouter.use("/assets", express.static("dist/assets"))

mockSiteRouter.use(
    "/fonts",
    express.static(path.join(BASE_DIR, "public/fonts"), {
        setHeaders: (res) => {
            res.set("Access-Control-Allow-Origin", "*")
        },
    })
)

mockSiteRouter.use("/", express.static(path.join(BASE_DIR, "public")))

mockSiteRouter.get("/countries", async (req, res) =>
    res.send(await countriesIndexPage(BAKED_BASE_URL))
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/country/:countrySlug",
    async (req, res, trx) =>
        res.send(
            await countryIndexPage(trx, req.params.countrySlug, BAKED_BASE_URL)
        )
)

mockSiteRouter.get("/feedback", async (req, res) =>
    res.send(await feedbackPage())
)

mockSiteRouter.get("/multiEmbedderTest", async (req, res) =>
    res.send(renderToHtmlPage(MultiEmbedderTestPage()))
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/dods.json",
    async (_, res, trx) => {
        res.set("Access-Control-Allow-Origin", "*")
        const dods = await getParsedDodsDictionary(trx)
        res.send(dods)
    }
)

getPlainRouteNonIdempotentWithRWTransaction(
    mockSiteRouter,
    "/team/:authorSlug",
    async (req, res, trx) => {
        try {
            const page = await renderGdocsPageBySlug(
                trx,
                req.params.authorSlug,
                [OwidGdocType.Author],
                true
            )
            res.send(page)
            return
        } catch (e) {
            console.error(e)
            res.status(404).send(renderNotFoundPage())
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
    async (req, res, trx) => {
        const tombstone = await getTombstoneBySlug(
            trx,
            req.params.tombstoneSlug
        )
        if (!tombstone) {
            res.status(404).send(renderNotFoundPage())
            return
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
        res.status(404).send(renderGdocTombstone(pageData, attachments))
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/topicTagGraph.json",
    async (req, res, trx) => {
        const headerMenu = await db.generateTopicTagGraph(trx)
        res.send(headerMenu)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/dataInsights.json",
    async (req, res, trx) => {
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
            // removes data that isn't need for rendering the feed page (based on comments in DataInsightsIndexPageContent.tsx)
            // (but we kep tags b/c we need it to filter dataInsights.json)
            rest.linkedIndicators = {}
            rest.latestDataInsights = []

            return rest
        })
        res.send(publishedDataInsightsForJson)
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/profile/:profileSlug/:entity",
    async (req, res, trx) => {
        const { profileSlug, entity: entityParam } = req.params

        if (!profileSlug || !entityParam) {
            return res.status(404).send(renderNotFoundPage())
        }

        try {
            const gdoc = await getAndLoadGdocBySlug(trx, profileSlug, [
                OwidGdocType.Profile,
            ])

            if (!gdoc || gdoc.content.type !== OwidGdocType.Profile) {
                return res.status(404).send(renderNotFoundPage())
            }

            const entity = getRegionBySlug(entityParam)
            if (!entity) {
                return res.status(404).send(renderNotFoundPage())
            }

            const entitiesInScope = getEntitiesForProfile(
                gdoc.content.scope,
                gdoc.content.exclude
            )
            const isEntityInScope = entitiesInScope.some(
                (profileEntity) => profileEntity.code === entity.code
            )
            if (!isEntityInScope) {
                return res.status(404).send(renderNotFoundPage())
            }

            const instantiatedProfile = await instantiateProfileForEntity(
                gdoc as GdocProfile,
                entity,
                { knex: trx }
            )

            if (!checkShouldProfileRender(instantiatedProfile.content)) {
                return res.status(404).send(renderNotFoundPage())
            }

            return res.send(renderGdoc(instantiatedProfile, true))
        } catch (error) {
            console.error("Error loading profile:", error)
            return res.status(404).send(renderNotFoundPage())
        }
    }
)

getPlainRouteWithROTransaction(
    mockSiteRouter,
    "/{*splat}",
    async (req, res, trx) => {
        // Remove leading and trailing slashes
        const slug = req.path.replace(/^\/|\/$/g, "")

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
            res.send(page)
            return
        } catch (e) {
            console.error(e)
        }

        try {
            const page = await renderPageBySlug(slug, trx)
            res.send(page)
        } catch (e) {
            console.error(e)
            res.status(404).send(renderNotFoundPage())
        }
    }
)

export { mockSiteRouter }
