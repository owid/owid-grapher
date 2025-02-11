// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../serverUtils/instrument.js"

import fs from "fs-extra"
import path from "path"
import { glob } from "glob"
import { keyBy, without, mapValues, pick, chunk } from "lodash"
import ProgressBar from "progress"
import * as db from "../db/db.js"
import {
    BLOG_POSTS_PER_PAGE,
    BASE_DIR,
    GDOCS_DETAILS_ON_DEMAND_ID,
    FEATURE_FLAGS,
} from "../settings/serverSettings.js"

import {
    renderFrontPage,
    renderBlogByPageNum,
    renderDataCatalogPage,
    renderSearchPage,
    renderDonatePage,
    makeAtomFeed,
    feedbackPage,
    renderNotFoundPage,
    renderCountryProfile,
    flushCache as siteBakingFlushCache,
    renderPost,
    renderGdoc,
    makeAtomFeedNoTopicPages,
    renderDynamicCollectionPage,
    renderTopChartsCollectionPage,
    renderDataInsightsIndexPage,
    renderThankYouPage,
    makeDataInsightsAtomFeed,
    renderGdocTombstone,
    renderExplorerIndexPage,
} from "../baker/siteRenderers.js"
import { makeSitemap } from "../baker/sitemap.js"
import { bakeCountries } from "../baker/countryProfiles.js"
import {
    countries,
    FullPost,
    LinkedAuthor,
    LinkedChart,
    LinkedIndicator,
    extractDetailsFromSyntax,
    OwidGdocErrorMessageType,
    ImageMetadata,
    OwidGdoc,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    OwidGdocMinimalPostInterface,
    excludeUndefined,
    grabMetadataForGdocLinkedIndicator,
    TombstonePageData,
    gdocUrlRegex,
    ChartViewInfo,
} from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import {
    getGrapherRedirectsMap,
    getRedirects,
    flushCache as redirectsFlushCache,
} from "./redirects.js"
import { bakeAllChangedGrapherPagesAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import {
    bakeAllExplorerRedirects,
    bakeAllPublishedExplorers,
} from "./ExplorerBaker.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import {
    getBlogIndex,
    getFullPost,
    getPostsFromSnapshots,
    postsFlushCache,
} from "../db/model/Post.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { getAllImages } from "../db/model/Image.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import { mapSlugsToConfigs } from "../db/model/Chart.js"
import { FeatureFlagFeature } from "../settings/clientSettings.js"
import pMap from "p-map"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import { getVariableMetadata } from "../db/model/Variable.js"
import {
    gdocFromJSON,
    getAllMinimalGdocBaseObjects,
    getLatestDataInsights,
} from "../db/model/Gdoc/GdocFactory.js"
import { getBakePath } from "@ourworldindata/components"
import { GdocAuthor, getMinimalAuthors } from "../db/model/Gdoc/GdocAuthor.js"
import {
    makeExplorerLinkedChart,
    makeGrapherLinkedChart,
    makeMultiDimLinkedChart,
} from "../db/model/Gdoc/GdocBase.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/SiteConstants.js"
import { getRedirectsFromDb } from "../db/model/Redirect.js"
import { getTombstones } from "../db/model/GdocTombstone.js"
import { bakeAllMultiDimDataPages } from "./MultiDimBaker.js"
import { getAllLinkedPublishedMultiDimDataPages } from "../db/model/MultiDimDataPage.js"
import { getPublicDonorNames } from "../db/model/Donor.js"
import { getChartViewsInfo } from "../db/model/ChartView.js"

type PrefetchedAttachments = {
    donors: string[]
    linkedAuthors: LinkedAuthor[]
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    linkedCharts: {
        graphers: Record<string, LinkedChart>
        explorers: Record<string, LinkedChart>
    }
    linkedIndicators: Record<number, LinkedIndicator>
    linkedChartViews: Record<string, ChartViewInfo>
}

// These aren't all "wordpress" steps
// But they're only run when you have the full stack available
const wordpressSteps = [
    "assets",
    "blogIndex",
    "redirects",
    "rss",
    "wordpressPosts",
] as const

const nonWordpressSteps = [
    "specialPages",
    "countries",
    "countryProfiles",
    "explorers",
    "charts",
    "multiDimPages",
    "gdocPosts",
    "gdocTombstones",
    "dods",
    "dataInsights",
    "authors",
] as const

const otherSteps = ["removeDeletedPosts"] as const

export const bakeSteps = [
    ...wordpressSteps,
    ...nonWordpressSteps,
    ...otherSteps,
]

export type BakeStep = (typeof bakeSteps)[number]

export type BakeStepConfig = Set<BakeStep>

const defaultSteps = new Set(bakeSteps)

function getProgressBarTotal(bakeSteps: BakeStepConfig): number {
    // There are 2 non-optional steps: flushCache at the beginning and flushCache at the end (again)
    const minimum = 2
    let total = minimum + bakeSteps.size
    // Redirects has two progress bar ticks
    if (bakeSteps.has("redirects")) total++
    // Add a tick for the validation step that occurs when these two steps run
    if (bakeSteps.has("dods") && bakeSteps.has("charts")) total++
    // Add ticks for prefetching attachments, which will only run if any of these steps are enabled
    if (
        bakeSteps.has("gdocPosts") ||
        bakeSteps.has("gdocTombstones") ||
        bakeSteps.has("dataInsights") ||
        bakeSteps.has("authors") ||
        bakeSteps.has("multiDimPages")
    ) {
        total += 9
    }
    return total
}

export class SiteBaker {
    private bakedSiteDir: string
    baseUrl: string
    progressBar: ProgressBar
    explorerAdminServer: ExplorerAdminServer
    bakeSteps: BakeStepConfig

    constructor(
        bakedSiteDir: string,
        baseUrl: string,
        bakeSteps: BakeStepConfig = defaultSteps
    ) {
        this.bakedSiteDir = bakedSiteDir
        this.baseUrl = baseUrl
        this.bakeSteps = bakeSteps
        this.progressBar = new ProgressBar(
            "--- BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: getProgressBarTotal(bakeSteps),
                renderThrottle: 0,
            }
        )
        this.explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    }

    private async bakeCountryProfiles(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("countryProfiles")) return
        await Promise.all(
            countryProfileSpecs.map(async (spec) => {
                // Delete all country profiles before regenerating them
                await fs.remove(`${this.bakedSiteDir}/${spec.rootPath}`)

                // Not necessary, as this is done by stageWrite already
                // await this.ensureDir(profile.rootPath)
                for (const country of countries) {
                    const html = await renderCountryProfile(
                        spec,
                        country,
                        knex
                    ).catch(() =>
                        console.error(
                            `${country.name} country profile not baked for project "${spec.project}". Check that both pages "${spec.landingPageSlug}" and "${spec.genericProfileSlug}" exist and are published.`
                        )
                    )

                    if (html) {
                        const outPath = path.join(
                            this.bakedSiteDir,
                            `${spec.rootPath}/${country.slug}.html`
                        )
                        await this.stageWrite(outPath, html)
                    }
                }
            })
        )
        this.progressBar.tick({ name: "✅ baked country profiles" })
    }

    // Bake an individual post/page
    private async bakeOwidGdoc(gdoc: OwidGdoc) {
        const html = renderGdoc(gdoc)
        const outPath = `${getBakePath(this.bakedSiteDir, gdoc)}.html`
        await fs.mkdirp(path.dirname(outPath))
        await this.stageWrite(outPath, html)
    }

    private async bakeOwidGdocTombstone(
        tombstone: TombstonePageData,
        attachments: PrefetchedAttachments
    ) {
        const html = renderGdocTombstone(tombstone, {
            ...attachments,
            linkedCharts: {},
            relatedCharts: [],
            tags: [],
        })
        const outPath = path.join(
            this.bakedSiteDir,
            "deleted",
            `${tombstone.slug}.html`
        )
        await this.stageWrite(outPath, html)
    }

    // Bake an individual post/page
    private async bakePost(post: FullPost, knex: db.KnexReadonlyTransaction) {
        const html = await renderPost(post, knex, this.baseUrl)

        const outPath = path.join(this.bakedSiteDir, `${post.slug}.html`)
        await fs.mkdirp(path.dirname(outPath))
        await this.stageWrite(outPath, html)
    }

    // Returns the slugs of posts which exist on the filesystem but are not in the DB anymore.
    // This happens when posts have been saved in previous bakes but have been since then deleted, unpublished or renamed.
    // Among all existing slugs on the filesystem, some are not coming from WP. They are baked independently and should not
    // be deleted if WP does not list them (e.g. grapher/*).
    private getPostSlugsToRemove(postSlugsFromDb: string[]) {
        const existingSlugs = glob
            .sync(`${this.bakedSiteDir}/**/*.html`)
            .map((path) =>
                path.replace(`${this.bakedSiteDir}/`, "").replace(".html", "")
            )
            .filter(
                (path) =>
                    !path.startsWith("uploads") &&
                    !path.startsWith("grapher") &&
                    !path.startsWith("countries") &&
                    !path.startsWith("country") &&
                    !path.startsWith("latest") &&
                    !path.startsWith("explore") &&
                    !countryProfileSpecs.some((spec) =>
                        path.startsWith(spec.rootPath)
                    ) &&
                    path !== "donate" &&
                    path !== "feedback" &&
                    path !== "charts" &&
                    path !== "search" &&
                    path !== "index" &&
                    path !== "identifyadmin" &&
                    path !== "404" &&
                    path !== "google8272294305985984"
            )

        return without(existingSlugs, ...postSlugsFromDb)
    }

    // Prefetches all linkedAuthors, linkedDocuments, imageMetadata,
    // linkedCharts, and linkedIndicators instead of having to fetch them for
    // each individual gdoc. Optionally takes a tuple of string arrays to pick
    // from the prefetched dictionaries.
    _prefetchedAttachmentsCache: PrefetchedAttachments | undefined = undefined
    private async getPrefetchedGdocAttachments(
        knex: db.KnexReadonlyTransaction,
        picks?: [string[], string[], string[], string[], string[], string[]]
    ): Promise<PrefetchedAttachments> {
        if (!this._prefetchedAttachmentsCache) {
            console.log("Prefetching attachments...")

            const donors = await getPublicDonorNames(knex)
            this.progressBar.tick({
                name: `✅ Prefetched donors`,
            })

            const publishedGdocs = await getAllMinimalGdocBaseObjects(knex)
            const publishedGdocsDictionary = keyBy(publishedGdocs, "id")
            this.progressBar.tick({
                name: `✅ Prefetched ${publishedGdocs.length} gdocs`,
            })

            const imageMetadataDictionary = await getAllImages(knex).then(
                (images) => keyBy(images, "filename")
            )

            this.progressBar.tick({
                name: `✅ Prefetched ${Object.values(imageMetadataDictionary).length} images`,
            })

            const publishedExplorersBySlug = await this.explorerAdminServer
                .getAllPublishedExplorersBySlugCached()
                .then((results) =>
                    mapValues(results, (explorer) => {
                        return makeExplorerLinkedChart(explorer, explorer.slug)
                    })
                )
            this.progressBar.tick({
                name: `✅ Prefetched ${Object.values(publishedExplorersBySlug).length} explorers`,
            })

            // Get all grapher links from the database so that we only prefetch the ones that are actually in use
            // 2024-06-25 before/after: 6266/2194
            const grapherLinks = await db
                .getGrapherLinkTargets(knex)
                .then((rows) => rows.map((row) => row.target))
                .then((targets) => new Set(targets))

            // Includes redirects
            const publishedChartsRaw = await mapSlugsToConfigs(knex).then(
                (configs) => {
                    return configs.filter((config) =>
                        grapherLinks.has(config.slug)
                    )
                }
            )
            const publishedCharts: LinkedChart[] = []

            for (const publishedChartsRawChunk of chunk(
                publishedChartsRaw,
                20
            )) {
                await Promise.all(
                    publishedChartsRawChunk.map(async (chart) => {
                        publishedCharts.push(
                            await makeGrapherLinkedChart(
                                chart.config,
                                chart.slug
                            )
                        )
                    })
                )
            }

            const multiDims = await getAllLinkedPublishedMultiDimDataPages(knex)
            for (const { slug, config } of multiDims) {
                publishedCharts.push(makeMultiDimLinkedChart(config, slug))
            }

            const publishedChartsBySlug = keyBy(publishedCharts, "originalSlug")
            this.progressBar.tick({
                name: `✅ Prefetched ${publishedCharts.length} charts`,
            })

            // The only reason we need linkedIndicators is for the KeyIndicator+KeyIndicatorCollection components.
            // The homepage is currently the only place that uses them (and it handles its data fetching separately)
            // so all of this is kind of redundant, but it's here for completeness if we start using them elsewhere
            const allLinkedIndicatorSlugs = await db.getLinkedIndicatorSlugs({
                knex,
                excludeHomepage: true,
            })

            const linkedIndicatorCharts = publishedCharts.filter(
                (chart) =>
                    allLinkedIndicatorSlugs.has(chart.originalSlug) &&
                    chart.indicatorId
            )
            const linkedIndicators: LinkedIndicator[] = await Promise.all(
                linkedIndicatorCharts.map(async (linkedChart) => {
                    const indicatorId = linkedChart.indicatorId as number
                    const metadata = await getVariableMetadata(indicatorId)
                    return {
                        id: indicatorId,
                        ...grabMetadataForGdocLinkedIndicator(metadata, {
                            chartConfigTitle: linkedChart.title,
                        }),
                    }
                })
            )
            this.progressBar.tick({
                name: `✅ Prefetched ${linkedIndicators.length} linked indicators`,
            })
            const datapageIndicatorsById = keyBy(linkedIndicators, "id")

            const publishedAuthors = await getMinimalAuthors(knex)

            this.progressBar.tick({
                name: `✅ Prefetched ${publishedAuthors.length} authors`,
            })

            const chartViewsInfo = await getChartViewsInfo(knex)
            const chartViewsInfoByName = keyBy(chartViewsInfo, "name")
            this.progressBar.tick({
                name: `✅ Prefetched ${chartViewsInfo.length} chart views`,
            })

            const prefetchedAttachments = {
                donors,
                linkedAuthors: publishedAuthors,
                linkedDocuments: publishedGdocsDictionary,
                imageMetadata: imageMetadataDictionary,
                linkedCharts: {
                    explorers: publishedExplorersBySlug,
                    graphers: publishedChartsBySlug,
                },
                linkedIndicators: datapageIndicatorsById,
                linkedChartViews: chartViewsInfoByName,
            }
            this.progressBar.tick({ name: "✅ Prefetched attachments" })
            this._prefetchedAttachmentsCache = prefetchedAttachments
        }
        if (picks) {
            const [
                authorNames,
                linkedDocumentIds,
                imageFilenames,
                linkedGrapherSlugs,
                linkedExplorerSlugs,
                linkedChartViewNames,
            ] = picks
            const linkedDocuments = pick(
                this._prefetchedAttachmentsCache.linkedDocuments,
                linkedDocumentIds
            )
            // Gdoc.linkedImageFilenames normally gets featuredImages, but it relies on linkedDocuments already being populated,
            // which is isn't when we're prefetching attachments. So we have to do it manually here.
            const featuredImages = Object.values(linkedDocuments)
                .map((gdoc) => gdoc["featured-image"])
                .filter((filename): filename is string => !!filename)

            const linkedGrapherCharts = pick(
                this._prefetchedAttachmentsCache.linkedCharts.graphers,
                linkedGrapherSlugs
            )
            const linkedIndicatorIds = excludeUndefined(
                Object.values(linkedGrapherCharts).map(
                    (chart) => chart.indicatorId
                )
            )

            return {
                donors: this._prefetchedAttachmentsCache.donors,
                linkedDocuments,
                imageMetadata: pick(
                    this._prefetchedAttachmentsCache.imageMetadata,
                    [...imageFilenames, ...featuredImages]
                ),
                linkedCharts: {
                    graphers: {
                        ...linkedGrapherCharts,
                    },
                    explorers: {
                        ...pick(
                            this._prefetchedAttachmentsCache.linkedCharts
                                .explorers,
                            linkedExplorerSlugs
                        ),
                    },
                },
                linkedIndicators: pick(
                    this._prefetchedAttachmentsCache.linkedIndicators,
                    linkedIndicatorIds
                ),
                linkedAuthors:
                    this._prefetchedAttachmentsCache.linkedAuthors.filter(
                        (author) => authorNames.includes(author.name)
                    ),
                linkedChartViews: pick(
                    this._prefetchedAttachmentsCache.linkedChartViews,
                    linkedChartViewNames
                ),
            }
        }
        return this._prefetchedAttachmentsCache
    }

    private async removeDeletedPosts(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("removeDeletedPosts")) return

        const postsApi = await getPostsFromSnapshots(knex)

        const postSlugs = []
        for (const postApi of postsApi) {
            const post = await getFullPost(knex, postApi)
            postSlugs.push(post.slug)
        }

        const gdocPosts = await getAllMinimalGdocBaseObjects(knex)

        for (const post of gdocPosts) {
            postSlugs.push(post.slug)
        }

        // Delete any previously rendered posts that aren't in the database
        for (const slug of this.getPostSlugsToRemove(postSlugs)) {
            const outPath = `${this.bakedSiteDir}/${slug}.html`
            await fs.unlink(outPath)
            this.stage(outPath, `DELETING ${outPath}`)
        }

        this.progressBar.tick({ name: "✅ removed deleted posts" })
    }

    private async bakePosts(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("wordpressPosts")) return
        const alreadyPublishedViaGdocsSlugsSet =
            await db.getSlugsWithPublishedGdocsSuccessors(knex)
        const redirects = await getRedirectsFromDb(knex)

        const postsApi = await getPostsFromSnapshots(
            knex,
            undefined,
            (postrow) =>
                // Exclude posts that are already published via GDocs
                !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug) &&
                // Exclude posts that are redirect sources
                !redirects.some((row) => row.source.slice(1) === postrow.slug)
        )

        await pMap(
            postsApi,
            async (postApi) =>
                getFullPost(knex, postApi).then((post) =>
                    this.bakePost(post, knex)
                ),
            { concurrency: 10 }
        )

        this.progressBar.tick({ name: "✅ baked posts" })
    }

    // Bake all GDoc posts, or a subset of them if slugs are provided

    async bakeGDocPosts(knex: db.KnexReadonlyTransaction, slugs?: string[]) {
        if (!this.bakeSteps.has("gdocPosts")) return
        // We don't need to call `load` on these, because we prefetch all attachments
        const publishedGdocs = await db
            .getPublishedGdocPostsWithTags(knex)
            .then((gdocs) => gdocs.map(gdocFromJSON))

        const allParentTagArraysByChildName =
            await db.getParentTagArraysByChildName(knex)

        const gdocsToBake =
            slugs !== undefined
                ? publishedGdocs.filter((gdoc) => slugs.includes(gdoc.slug))
                : publishedGdocs

        // Ensure we have a published gdoc for each slug given
        if (slugs !== undefined && slugs.length !== gdocsToBake.length) {
            const slugsNotFound = slugs.filter(
                (slug) => !gdocsToBake.find((gdoc) => gdoc.slug === slug)
            )
            throw new Error(
                `Some of the gdoc slugs were not found or are not published: ${slugsNotFound}`
            )
        }

        for (const publishedGdoc of gdocsToBake) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                publishedGdoc.content.authors,
                publishedGdoc.linkedDocumentIds,
                publishedGdoc.linkedImageFilenames,
                publishedGdoc.linkedChartSlugs.grapher,
                publishedGdoc.linkedChartSlugs.explorer,
                publishedGdoc.linkedChartViewNames,
            ])
            publishedGdoc.donors = attachments.donors
            publishedGdoc.linkedAuthors = attachments.linkedAuthors
            publishedGdoc.linkedDocuments = attachments.linkedDocuments
            publishedGdoc.imageMetadata = attachments.imageMetadata
            publishedGdoc.linkedCharts = {
                ...attachments.linkedCharts.graphers,
                ...attachments.linkedCharts.explorers,
            }
            publishedGdoc.linkedIndicators = attachments.linkedIndicators
            publishedGdoc.linkedChartViews = attachments.linkedChartViews

            if (
                !publishedGdoc.manualBreadcrumbs?.length &&
                publishedGdoc.tags?.length
            ) {
                publishedGdoc.breadcrumbs = db.getBestBreadcrumbs(
                    publishedGdoc.tags,
                    allParentTagArraysByChildName
                )
            }

            // this is a no-op if the gdoc doesn't have an all-chart block
            if ("loadRelatedCharts" in publishedGdoc) {
                await publishedGdoc.loadRelatedCharts(knex)
            }

            await publishedGdoc.validate(knex)
            try {
                await this.bakeOwidGdoc(publishedGdoc)
            } catch (e) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Error baking gdoc post with id "${publishedGdoc.id}" and slug "${publishedGdoc.slug}": ${e}`
                    )
                )
            }
        }

        this.progressBar.tick({ name: "✅ baked google doc posts" })
    }

    async bakeGDocTombstones(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("gdocTombstones")) return
        const tombstones = await getTombstones(knex)

        for (const tombstone of tombstones) {
            const attachments = await this.getPrefetchedGdocAttachments(knex)
            const linkedGdocId =
                tombstone.relatedLinkUrl?.match(gdocUrlRegex)?.[1]
            if (linkedGdocId) {
                const linkedDocument = attachments.linkedDocuments[linkedGdocId]
                if (!linkedDocument) {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Tombstone with id "${tombstone.id}" references a gdoc with id "${linkedGdocId}" which was not found`
                        )
                    )
                }
            }
            try {
                await this.bakeOwidGdocTombstone(tombstone, attachments)
            } catch (e) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Error baking gdoc tombstone with id "${tombstone.id}" and slug "${tombstone.slug}": ${e}`
                    )
                )
            }
        }

        this.progressBar.tick({ name: "✅ baked google doc tombstones" })
    }

    // Bake unique individual pages

    private async bakeSpecialPages(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("specialPages")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/index.html`,
            await renderFrontPage(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/donate.html`,
            await renderDonatePage(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/thank-you.html`,
            await renderThankYouPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/feedback.html`,
            await feedbackPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/search.html`,
            await renderSearchPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/explorers.html`,
            await renderExplorerIndexPage(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/collection/custom.html`,
            await renderDynamicCollectionPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/collection/top-charts.html`,
            await renderTopChartsCollectionPage(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/404.html`,
            await renderNotFoundPage()
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/sitemap.xml`,
            await makeSitemap(this.explorerAdminServer, knex)
        )

        await this.stageWrite(
            `${this.bakedSiteDir}/data.html`,
            await renderDataCatalogPage(knex)
        )
        this.progressBar.tick({ name: "✅ baked special pages" })
    }

    private async bakeExplorers(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("explorers")) return

        await bakeAllExplorerRedirects(
            this.bakedSiteDir,
            this.explorerAdminServer,
            knex
        )

        await bakeAllPublishedExplorers(
            `${this.bakedSiteDir}/${EXPLORERS_ROUTE_FOLDER}`,
            this.explorerAdminServer,
            knex
        )

        this.progressBar.tick({ name: "✅ baked explorers" })
    }

    private async validateGrapherDodReferences(
        knex: db.KnexReadonlyTransaction
    ) {
        if (!this.bakeSteps.has("dods") || !this.bakeSteps.has("charts")) return
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to validate dods."
            )
            return
        }

        const { details } = await GdocPost.getDetailsOnDemandGdoc(knex)

        if (!details) {
            this.progressBar.tick({
                name: "✅ no details exist. skipping grapher dod validation step",
            })
            return
        }

        const charts: { slug: string; subtitle: string; note: string }[] =
            await db.knexRaw<{ slug: string; subtitle: string; note: string }>(
                knex,
                `-- sql
                SELECT
                    cc.slug,
                    cc.full ->> '$.subtitle' as subtitle,
                    cc.full ->> '$.note' as note
                FROM
                    charts c
                JOIN
                    chart_configs cc ON c.configId = cc.id
                WHERE
                    JSON_EXTRACT(cc.full, "$.isPublished") = true
                AND (
                    JSON_EXTRACT(cc.full, "$.subtitle") LIKE "%#dod:%"
                    OR JSON_EXTRACT(cc.full, "$.note") LIKE "%#dod:%"
                )
                ORDER BY
                    cc.slug ASC
            `
            )

        for (const chart of charts) {
            const detailIds = new Set(
                extractDetailsFromSyntax(`${chart.note} ${chart.subtitle}`)
            )
            for (const detailId of detailIds) {
                if (!details[detailId]) {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Grapher with slug ${chart.slug} references dod "${detailId}" which does not exist`
                        )
                    )
                }
            }
        }

        this.progressBar.tick({ name: "✅ validated grapher dods" })
    }

    private async bakeMultiDimPages(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("multiDimPages")) return
        if (!FEATURE_FLAGS.has(FeatureFlagFeature.MultiDimDataPage)) {
            console.log(
                "Skipping baking multi-dim pages because feature flag is not set"
            )
            return
        }
        const { imageMetadata } = await this.getPrefetchedGdocAttachments(knex)
        await bakeAllMultiDimDataPages(knex, this.bakedSiteDir, imageMetadata)

        this.progressBar.tick({ name: "✅ baked multi-dim pages" })
    }

    private async bakeDetailsOnDemand(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("dods")) return
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to bake dods."
            )
            return
        }

        const { details, parseErrors } =
            await GdocPost.getDetailsOnDemandGdoc(knex)
        if (parseErrors.length) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Error(s) baking details: ${parseErrors
                        .map((e) => e.message)
                        .join(", ")}`
                )
            )
        }

        if (details) {
            await this.stageWrite(
                `${this.bakedSiteDir}/dods.json`,
                JSON.stringify(details)
            )
            this.progressBar.tick({ name: "✅ baked dods.json" })
        } else {
            throw Error("Details on demand not found")
        }
    }

    private async bakeDataInsights(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("dataInsights")) return
        const {
            dataInsights: latestDataInsights,
            imageMetadata: latestDataInsightsImageMetadata,
        } = await getLatestDataInsights(knex)
        const publishedDataInsights =
            await GdocDataInsight.getPublishedDataInsights(knex)

        for (const dataInsight of publishedDataInsights) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                dataInsight.content.authors,
                dataInsight.linkedDocumentIds,
                dataInsight.linkedImageFilenames,
                dataInsight.linkedChartSlugs.grapher,
                dataInsight.linkedChartSlugs.explorer,
                dataInsight.linkedChartViewNames,
            ])
            dataInsight.linkedDocuments = attachments.linkedDocuments
            dataInsight.imageMetadata = {
                ...attachments.imageMetadata,
                ...latestDataInsightsImageMetadata,
            }
            dataInsight.linkedCharts = {
                ...attachments.linkedCharts.graphers,
                ...attachments.linkedCharts.explorers,
            }
            dataInsight.latestDataInsights = latestDataInsights

            await dataInsight.validate(knex)
            try {
                await this.bakeOwidGdoc(dataInsight)
            } catch (e) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Error baking gdoc post with id "${dataInsight.id}" and slug "${dataInsight.slug}": ${e}`
                    )
                )
            }
            // We don't need the latest data insights nor their images in the
            // feed later, when we render the list of all data insights.
            dataInsight.latestDataInsights = []
            dataInsight.imageMetadata = attachments.imageMetadata
        }

        const totalPageCount = calculateDataInsightIndexPageCount(
            publishedDataInsights.length
        )

        for (let pageNumber = 0; pageNumber < totalPageCount; pageNumber++) {
            const html = renderDataInsightsIndexPage(
                publishedDataInsights.slice(
                    pageNumber * DATA_INSIGHTS_INDEX_PAGE_SIZE,
                    (pageNumber + 1) * DATA_INSIGHTS_INDEX_PAGE_SIZE
                ),
                pageNumber,
                totalPageCount
            )
            // Page 0 is data-insights.html, page 1 is data-insights/2.html, etc.
            const filename = pageNumber === 0 ? "" : `/${pageNumber + 1}`
            const outPath = path.join(
                this.bakedSiteDir,
                `data-insights${filename}.html`
            )
            await fs.mkdirp(path.dirname(outPath))
            await this.stageWrite(outPath, html)
        }
    }

    private async bakeAuthors(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("authors")) return

        const publishedAuthors = await GdocAuthor.getPublishedAuthors(knex)

        for (const publishedAuthor of publishedAuthors) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                publishedAuthor.content.authors,
                publishedAuthor.linkedDocumentIds,
                publishedAuthor.linkedImageFilenames,
                publishedAuthor.linkedChartSlugs.grapher,
                publishedAuthor.linkedChartSlugs.explorer,
                publishedAuthor.linkedChartViewNames,
            ])

            // We don't need these to be attached to the gdoc in the current
            // state of author pages. We'll keep them here as documentation
            // of intent, until we need them.
            // publishedAuthor.linkedCharts = {
            //     ...attachments.linkedCharts.graphers,
            //     ...attachments.linkedCharts.explorers,
            // }
            // publishedAuthor.linkedAuthors = attachments.linkedAuthors

            // Attach documents metadata linked to in the "featured work" section
            publishedAuthor.linkedDocuments = attachments.linkedDocuments

            // Attach image metadata for the profile picture and the "featured work" images
            publishedAuthor.imageMetadata = attachments.imageMetadata

            // Attach image metadata for the “latest work" images
            await publishedAuthor.loadLatestWorkImages(knex)

            await publishedAuthor.validate(knex)
            if (
                publishedAuthor.errors.filter(
                    (e) => e.type === OwidGdocErrorMessageType.Error
                ).length
            ) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Error(s) baking "${
                            publishedAuthor.slug
                        }" :\n  ${publishedAuthor.errors
                            .map((error) => error.message)
                            .join("\n  ")}`
                    )
                )
            }
            try {
                await this.bakeOwidGdoc(publishedAuthor)
            } catch (e) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Error baking author with id "${publishedAuthor.id}" and slug "${publishedAuthor.slug}": ${e}`
                    )
                )
            }
        }

        this.progressBar.tick({ name: "✅ baked author pages" })
    }

    // Bake the blog index

    private async bakeBlogIndex(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("blogIndex")) return
        const allPosts = await getBlogIndex(knex)
        const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)

        for (let i = 1; i <= numPages; i++) {
            const slug = i === 1 ? "latest" : `latest/page/${i}`
            const html = await renderBlogByPageNum(i, knex)
            await this.stageWrite(`${this.bakedSiteDir}/${slug}.html`, html)
        }
        this.progressBar.tick({ name: "✅ baked blog index" })
    }

    // Bake the RSS feed

    private async bakeRSS(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("rss")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/atom.xml`,
            await makeAtomFeed(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/atom-no-topic-pages.xml`,
            await makeAtomFeedNoTopicPages(knex)
        )
        await this.stageWrite(
            `${this.bakedSiteDir}/${DATA_INSIGHTS_ATOM_FEED_NAME}`,
            await makeDataInsightsAtomFeed(knex)
        )
        this.progressBar.tick({ name: "✅ baked rss" })
    }

    // We don't have an icon for every single tag (yet), but for the icons that we *do* have,
    // we want to make sure that we have a corresponding tag in the database.
    private async validateTagIcons(trx: db.KnexReadonlyTransaction) {
        const allTags = await trx
            .table("tags")
            .select<{ name: string }[]>("name")
        const tagNames = new Set(allTags.map((tag) => tag.name))
        const tagIcons = await fs.readdir("public/images/tag-icons")
        for (const icon of tagIcons) {
            const iconName = icon.split(".")[0]
            if (!tagNames.has(iconName)) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Tag icon "${icon}" does not have a corresponding tag in the database.`
                    )
                )
            }
        }
    }

    // Bake the static assets
    private async bakeAssets(trx: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("assets")) return

        await execWrapper(
            `rm -rf ${this.bakedSiteDir}/assets && cp -r ${BASE_DIR}/dist/assets ${this.bakedSiteDir}/assets`
        )

        // The `assets-admin` folder is optional; don't fail if it doesn't exist
        await execWrapper(
            `rm -rf ${this.bakedSiteDir}/assets-admin && (cp -r ${BASE_DIR}/dist/assets-admin ${this.bakedSiteDir}/assets-admin || true)`
        )

        await this.validateTagIcons(trx)
        await execWrapper(
            `rsync -hav --delete ${BASE_DIR}/public/* ${this.bakedSiteDir}/`
        )

        await fs.writeFile(
            `${this.bakedSiteDir}/assets/embedCharts.js`,
            generateEmbedSnippet()
        )
        this.stage(`${this.bakedSiteDir}/assets/embedCharts.js`)

        await fs.ensureDir(`${this.bakedSiteDir}/grapher`)
        this.progressBar.tick({ name: "✅ baked assets" })
    }

    async bakeRedirects(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("redirects")) return
        const redirects = await getRedirects(knex)
        this.progressBar.tick({ name: "✅ got redirects" })
        await this.stageWrite(
            path.join(this.bakedSiteDir, `_redirects`),
            redirects.join("\n")
        )

        const grapherRedirects = await getGrapherRedirectsMap(knex, "")
        await this.stageWrite(
            path.join(this.bakedSiteDir, `grapher/_grapherRedirects.json`),
            JSON.stringify(Object.fromEntries(grapherRedirects), null, 2)
        )

        this.progressBar.tick({ name: "✅ baked redirects" })
    }

    async bakeWordpressPages(knex: db.KnexReadonlyTransaction) {
        await this.bakeRedirects(knex)
        await this.bakeBlogIndex(knex)
        await this.bakeRSS(knex)
        await this.bakeAssets(knex)
        await this.bakePosts(knex)
    }

    private async _bakeNonWordpressPages(knex: db.KnexReadonlyTransaction) {
        if (this.bakeSteps.has("countries")) {
            await bakeCountries(this, knex)
        }
        await this.bakeSpecialPages(knex)
        await this.bakeCountryProfiles(knex)
        await this.bakeExplorers(knex)
        if (this.bakeSteps.has("charts")) {
            await bakeAllChangedGrapherPagesAndDeleteRemovedGraphers(
                this.bakedSiteDir,
                knex
            )
            this.progressBar.tick({
                name: "✅ bakeAllChangedGrapherPagesAndDeleteRemovedGraphers",
            })
        }
        await this.bakeMultiDimPages(knex)
        await this.bakeDetailsOnDemand(knex)
        await this.validateGrapherDodReferences(knex)
        await this.bakeGDocPosts(knex)
        await this.bakeGDocTombstones(knex)
        await this.bakeDataInsights(knex)
        await this.bakeAuthors(knex)
    }

    async bakeNonWordpressPages(knex: db.KnexReadonlyTransaction) {
        const progressBarTotal = nonWordpressSteps
            .map((step) => this.bakeSteps.has(step))
            .filter((hasStep) => hasStep).length
        this.progressBar = new ProgressBar(
            "--- BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: progressBarTotal,
                renderThrottle: 0,
            }
        )
        await this._bakeNonWordpressPages(knex)
    }

    async bakeAll(knex: db.KnexReadonlyTransaction) {
        // Ensure caches are correctly initialized
        this.flushCache()
        await this.removeDeletedPosts(knex)
        await this.bakeWordpressPages(knex)
        await this._bakeNonWordpressPages(knex)
        this.flushCache()
    }

    async ensureDir(relPath: string) {
        const outPath = path.join(this.bakedSiteDir, relPath)
        await fs.mkdirp(outPath)
    }

    async writeFile(relPath: string, content: string) {
        const outPath = path.join(this.bakedSiteDir, relPath)
        await fs.writeFile(outPath, content)
        this.stage(outPath)
    }

    private async stageWrite(outPath: string, content: string) {
        await fs.mkdirp(path.dirname(outPath))
        await fs.writeFile(outPath, content)
        this.stage(outPath)
    }

    private stage(outPath: string, msg?: string) {
        console.log(msg || outPath)
    }

    async endDbConnections() {
        await db.closeTypeOrmAndKnexConnections()
    }

    private flushCache() {
        // Clear caches to allow garbage collection while waiting for next run
        postsFlushCache()
        siteBakingFlushCache()
        redirectsFlushCache()
        this.progressBar.tick({ name: "✅ cache flushed" })
    }
}
