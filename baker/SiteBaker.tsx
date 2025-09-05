// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../serverUtils/instrument.js"

import * as _ from "lodash-es"
import fs from "fs-extra"
import path from "path"
import { glob } from "glob"
import ProgressBar from "progress"
import * as db from "../db/db.js"
import { BLOG_POSTS_PER_PAGE, BASE_DIR } from "../settings/serverSettings.js"

import {
    renderFrontPage,
    renderBlogByPageNum,
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
    TombstonePageData,
    gdocUrlRegex,
    NarrativeChartInfo,
    ArchiveContext,
} from "@ourworldindata/utils"
import { execWrapper } from "../db/execWrapper.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { getRedirects, flushCache as redirectsFlushCache } from "./redirects.js"
import { bakeAllChangedGrapherPagesAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import {
    bakeAllExplorerRedirects,
    bakeAllPublishedExplorers,
} from "./ExplorerBaker.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { getBlogIndex, postsFlushCache } from "../db/model/Post.js"
import { getAllImages } from "../db/model/Image.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"
import { mapSlugsToConfigs } from "../db/model/Chart.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
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
    getLinkedIndicatorsForCharts,
} from "../db/model/Gdoc/GdocBase.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/SiteConstants.js"
import { getTombstones } from "../db/model/GdocTombstone.js"
import { bakeAllMultiDimDataPages } from "./MultiDimBaker.js"
import { getAllLinkedPublishedMultiDimDataPages } from "../db/model/MultiDimDataPage.js"
import { getPublicDonorNames } from "../db/model/Donor.js"
import { getNarrativeChartsInfo } from "../db/model/NarrativeChart.js"
import { getGrapherRedirectsMap } from "./redirectsFromDb.js"
import * as R from "remeda"
import { getDods, getParsedDodsDictionary } from "../db/model/Dod.js"
import {
    getLatestChartArchivedVersionsIfEnabled,
    getLatestMultiDimArchivedVersionsIfEnabled,
} from "../db/model/archival/archivalDb.js"
import { SEARCH_BASE_PATH } from "../site/search/searchUtils.js"

type PrefetchedAttachments = {
    donors: string[]
    linkedAuthors: LinkedAuthor[]
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    archivedVersions: {
        charts: Record<number, ArchiveContext | undefined>
        multiDims: Record<number, ArchiveContext | undefined>
    }
    linkedCharts: {
        graphers: Record<string, LinkedChart>
        explorers: Record<string, LinkedChart>
    }
    linkedIndicators: Record<number, LinkedIndicator>
    linkedNarrativeCharts: Record<string, NarrativeChartInfo>
}

// These aren't all "wordpress" steps
// But they're only run when you have the full stack available
const wordpressSteps = ["assets", "blogIndex", "redirects", "rss"] as const

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
        this.explorerAdminServer = new ExplorerAdminServer()
    }

    private async bakeCountryProfiles(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("countryProfiles")) return
        this.progressBar.tick({ name: "Baking country profiles" })
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
                    path !== SEARCH_BASE_PATH.slice(1) &&
                    path !== "index" &&
                    path !== "identifyadmin" &&
                    path !== "404" &&
                    path !== "google8272294305985984"
            )

        return _.without(existingSlugs, ...postSlugsFromDb)
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
            console.log("Prefetching donors")
            const donors = await getPublicDonorNames(knex)
            console.log(`✅ Prefetched ${donors.length} donors`)

            console.log("Prefetching gdocs")
            const publishedGdocs = await getAllMinimalGdocBaseObjects(knex)
            const publishedGdocsDictionary = _.keyBy(publishedGdocs, "id")
            console.log(`✅ Prefetched ${publishedGdocs.length} gdocs`)

            console.log("Prefetching images")
            const imageMetadataDictionary = await getAllImages(knex).then(
                (images) => _.keyBy(images, "filename")
            )
            console.log(
                `✅ Prefetched ${Object.keys(imageMetadataDictionary).length} images`
            )

            console.log("Prefetching explorers")
            const publishedExplorersBySlug = await this.explorerAdminServer
                .getAllPublishedExplorersBySlugCached(knex)
                .then((results) =>
                    _.mapValues(results, (explorer) => {
                        return makeExplorerLinkedChart(explorer, explorer.slug)
                    })
                )
            console.log(
                `✅ Prefetched ${Object.keys(publishedExplorersBySlug).length} explorers`
            )

            console.log("Prefetching archived versions")
            const [archivedChartVersions, archivedMultiDimVersions] =
                await Promise.all([
                    getLatestChartArchivedVersionsIfEnabled(knex),
                    getLatestMultiDimArchivedVersionsIfEnabled(knex),
                ])

            const archivedVersions = {
                charts: archivedChartVersions,
                multiDims: archivedMultiDimVersions,
            }
            const archiveCount = _.sum(
                Object.values(archivedVersions).map(
                    (v) => Object.keys(v).length
                )
            )
            console.log(`✅ Prefetched ${archiveCount} archived versions`)

            console.log("Prefetching charts")
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

            for (const publishedChartsRawChunk of R.chunk(
                publishedChartsRaw,
                20
            )) {
                await Promise.all(
                    publishedChartsRawChunk.map(async (chart) => {
                        publishedCharts.push(
                            await makeGrapherLinkedChart(
                                knex,
                                chart.config,
                                chart.slug,
                                {
                                    archivedChartInfo:
                                        archivedVersions.charts[chart.id] ||
                                        undefined,
                                }
                            )
                        )
                    })
                )
            }

            const multiDims = await getAllLinkedPublishedMultiDimDataPages(knex)
            for (const { id, slug, config } of multiDims) {
                publishedCharts.push(
                    makeMultiDimLinkedChart(config, slug, {
                        archivedChartInfo:
                            archivedVersions.multiDims[id] || undefined,
                    })
                )
            }

            const publishedChartsBySlug = _.keyBy(
                publishedCharts,
                "originalSlug"
            )
            console.log(`✅ Prefetched ${publishedCharts.length} charts`)

            // The only reason we need linkedIndicators is for the KeyIndicator+KeyIndicatorCollection components.
            // The homepage is currently the only place that uses them (and it handles its data fetching separately)
            // so all of this is kind of redundant, but it's here for completeness if we start using them elsewhere
            const allLinkedIndicatorSlugs = await db.getLinkedIndicatorSlugs({
                knex,
                excludeHomepage: true,
            })

            console.log("Prefetching linked indicators")
            const linkedIndicatorCharts = publishedCharts.filter(
                (chart) =>
                    allLinkedIndicatorSlugs.has(chart.originalSlug) &&
                    chart.indicatorId
            )
            const linkedIndicators: LinkedIndicator[] =
                await getLinkedIndicatorsForCharts(
                    knex,
                    linkedIndicatorCharts.map((linkedChart) => ({
                        indicatorId: linkedChart.indicatorId as number,
                        chartTitle: linkedChart.title,
                    }))
                )
            const datapageIndicatorsById = _.keyBy(linkedIndicators, "id")
            console.log(`✅ Prefetched ${linkedIndicators.length} indicators`)

            console.log("Prefetching authors")
            const publishedAuthors = await getMinimalAuthors(knex)
            console.log(`✅ Prefetched ${publishedAuthors.length} authors`)

            console.log("Prefetching narrative charts")
            const narrativeChartsInfo = await getNarrativeChartsInfo(knex)
            const narrativeChartsInfoByName = _.keyBy(
                narrativeChartsInfo,
                "name"
            )
            console.log(
                `✅ Prefetched ${narrativeChartsInfo.length} narrative charts`
            )

            const prefetchedAttachments = {
                donors,
                linkedAuthors: publishedAuthors,
                linkedDocuments: publishedGdocsDictionary,
                imageMetadata: imageMetadataDictionary,
                archivedVersions: {
                    charts: archivedVersions.charts,
                    multiDims: archivedVersions.multiDims,
                },
                linkedCharts: {
                    explorers: publishedExplorersBySlug,
                    graphers: publishedChartsBySlug,
                },
                linkedIndicators: datapageIndicatorsById,
                linkedNarrativeCharts: narrativeChartsInfoByName,
            }
            this._prefetchedAttachmentsCache = prefetchedAttachments
        }
        if (picks) {
            const [
                authorNames,
                linkedDocumentIds,
                imageFilenames,
                linkedGrapherSlugs,
                linkedExplorerSlugs,
                linkedNarrativeChartNames,
            ] = picks
            const linkedDocuments = _.pick(
                this._prefetchedAttachmentsCache.linkedDocuments,
                linkedDocumentIds
            )
            // Gdoc.linkedImageFilenames normally gets featuredImages, but it relies on linkedDocuments already being populated,
            // which is isn't when we're prefetching attachments. So we have to do it manually here.
            const featuredImages = Object.values(linkedDocuments)
                .map((gdoc) => gdoc["featured-image"])
                .filter((filename): filename is string => !!filename)

            const linkedGrapherCharts = _.pick(
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
                imageMetadata: _.pick(
                    this._prefetchedAttachmentsCache.imageMetadata,
                    [...imageFilenames, ...featuredImages]
                ),

                // not using _.pick on these, since they're not directly attached to the _OWID_GDOC_PROPS object anyhow
                archivedVersions:
                    this._prefetchedAttachmentsCache.archivedVersions,

                linkedCharts: {
                    graphers: {
                        ...linkedGrapherCharts,
                    },
                    explorers: {
                        ..._.pick(
                            this._prefetchedAttachmentsCache.linkedCharts
                                .explorers,
                            linkedExplorerSlugs
                        ),
                    },
                },
                linkedIndicators: _.pick(
                    this._prefetchedAttachmentsCache.linkedIndicators,
                    linkedIndicatorIds
                ),
                linkedAuthors:
                    this._prefetchedAttachmentsCache.linkedAuthors.filter(
                        (author) => authorNames.includes(author.name)
                    ),
                linkedNarrativeCharts: _.pick(
                    this._prefetchedAttachmentsCache.linkedNarrativeCharts,
                    linkedNarrativeChartNames
                ),
            }
        }
        return this._prefetchedAttachmentsCache
    }

    private async removeDeletedPosts(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("removeDeletedPosts")) return
        this.progressBar.tick({ name: "Removing deleted posts" })

        const gdocPosts = await getAllMinimalGdocBaseObjects(knex)
        const postSlugs = gdocPosts.map((post) => post.slug)

        // Delete any previously rendered posts that aren't in the database
        for (const slug of this.getPostSlugsToRemove(postSlugs)) {
            const outPath = `${this.bakedSiteDir}/${slug}.html`
            await fs.unlink(outPath)
            this.stage(outPath, `DELETING ${outPath}`)
        }
    }

    // Bake all GDoc posts, or a subset of them if slugs are provided

    async bakeGDocPosts(knex: db.KnexReadonlyTransaction, slugs?: string[]) {
        if (!this.bakeSteps.has("gdocPosts")) return
        this.progressBar.tick({ name: "Baking Google doc posts" })
        // We don't need to call `load` on these, because we prefetch all attachments
        const publishedGdocs = await db
            .getPublishedGdocsWithTags(knex)
            .then((gdocs) => gdocs.map(gdocFromJSON))

        const tagHierarchiesByChildName =
            await db.getTagHierarchiesByChildName(knex)

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
                publishedGdoc.linkedNarrativeChartNames,
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
            publishedGdoc.linkedNarrativeCharts =
                attachments.linkedNarrativeCharts

            if (
                !publishedGdoc.manualBreadcrumbs?.length &&
                publishedGdoc.tags?.length
            ) {
                publishedGdoc.breadcrumbs = db.getBestBreadcrumbs(
                    publishedGdoc.tags,
                    tagHierarchiesByChildName
                )
            }

            // this is a no-op if the gdoc doesn't have an all-chart block
            if ("loadRelatedCharts" in publishedGdoc) {
                await publishedGdoc.loadRelatedCharts(
                    knex,
                    attachments.archivedVersions.charts
                )
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
    }

    async bakeGDocTombstones(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("gdocTombstones")) return
        this.progressBar.tick({ name: "Baking Google doc tombstones" })
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
    }

    // Bake unique individual pages

    private async bakeSpecialPages(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("specialPages")) return
        this.progressBar.tick({ name: "Baking special pages" })
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
            `${this.bakedSiteDir}${SEARCH_BASE_PATH}.html`,
            await renderSearchPage(knex)
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
    }

    private async bakeExplorers(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("explorers")) return
        this.progressBar.tick({ name: "Baking explorers" })

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
    }

    private async validateGrapherDodReferences(
        knex: db.KnexReadonlyTransaction
    ) {
        if (!this.bakeSteps.has("dods") || !this.bakeSteps.has("charts")) return
        console.log("Validating grapher DoDs")

        const details = await getDods(knex).then((dods) =>
            R.indexBy(dods, (dod) => dod.name)
        )

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
    }

    private async bakeMultiDimPages(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("multiDimPages")) return
        this.progressBar.tick({ name: "Baking multi-dim pages" })
        const { imageMetadata } = await this.getPrefetchedGdocAttachments(knex)
        await bakeAllMultiDimDataPages(knex, this.bakedSiteDir, imageMetadata)
    }

    private async bakeDetailsOnDemand(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("dods")) return
        this.progressBar.tick({ name: "Baking dods.json" })

        const parsedDods = await getParsedDodsDictionary(knex)

        await this.stageWrite(
            `${this.bakedSiteDir}/dods.json`,
            JSON.stringify(parsedDods)
        )
    }

    private async bakeDataInsights(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("dataInsights")) return
        this.progressBar.tick({ name: "Baking data insights" })
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
                dataInsight.linkedNarrativeChartNames,
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

        // bake all data insights to dataInsights.json to allow for a topic-filtered
        // view of the feed (temporary, for the purposes of a data pages experiment).
        const publishedDataInsightsForJson = publishedDataInsights.map((di) => {
            // removes fields that are omitted from <DataInsightBody /> props
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { markdown, publicationContext, revisionId, ...rest } = di

            // removes data that isn't need for rendering the feed page (based on comments in DataInsightsIndexPageContent.tsx)
            // (but we kep tags b/c we need it to filter dataInsights.json)
            rest.linkedIndicators = {}
            rest.latestDataInsights = []
            return rest
        })
        await this.stageWrite(
            `${this.bakedSiteDir}/dataInsights.json`,
            JSON.stringify(publishedDataInsightsForJson)
        )
    }

    private async bakeAuthors(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("authors")) return
        this.progressBar.tick({ name: "Baking author pages" })

        const publishedAuthors = await GdocAuthor.getPublishedAuthors(knex)

        for (const publishedAuthor of publishedAuthors) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                publishedAuthor.content.authors,
                publishedAuthor.linkedDocumentIds,
                publishedAuthor.linkedImageFilenames,
                publishedAuthor.linkedChartSlugs.grapher,
                publishedAuthor.linkedChartSlugs.explorer,
                publishedAuthor.linkedNarrativeChartNames,
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
    }

    // Bake the blog index

    private async bakeBlogIndex(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("blogIndex")) return
        this.progressBar.tick({ name: "Baking blog index" })
        const allPosts = await getBlogIndex(knex)
        const numPages = Math.ceil(allPosts.length / BLOG_POSTS_PER_PAGE)

        for (let i = 1; i <= numPages; i++) {
            const slug = i === 1 ? "latest" : `latest/page/${i}`
            const html = await renderBlogByPageNum(i, knex)
            await this.stageWrite(`${this.bakedSiteDir}/${slug}.html`, html)
        }
    }

    // Bake the RSS feed

    private async bakeRSS(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("rss")) return
        this.progressBar.tick({ name: "Baking RSS feeds" })
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
        this.progressBar.tick({ name: "Baking assets" })

        await execWrapper(
            `rm -rf ${this.bakedSiteDir}/assets && cp -r ${BASE_DIR}/dist/assets ${this.bakedSiteDir}/assets`
        )

        await fs.writeFile(
            `${this.bakedSiteDir}/topicTagGraph.json`,
            await db
                .generateTopicTagGraph(trx)
                .then((nav) => JSON.stringify(nav))
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
    }

    async bakeRedirects(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("redirects")) return
        this.progressBar.tick({ name: "Baking site redirects" })
        const redirects = await getRedirects(knex)
        await this.stageWrite(
            path.join(this.bakedSiteDir, `_redirects`),
            redirects.join("\n")
        )

        this.progressBar.tick({ name: "Baking grapher redirects" })
        const grapherRedirects = await getGrapherRedirectsMap(knex, "")
        await this.stageWrite(
            path.join(this.bakedSiteDir, `grapher/_grapherRedirects.json`),
            JSON.stringify(Object.fromEntries(grapherRedirects), null, 2)
        )
    }

    async bakeWordpressPages(knex: db.KnexReadonlyTransaction) {
        await this.bakeRedirects(knex)
        await this.bakeBlogIndex(knex)
        await this.bakeRSS(knex)
        await this.bakeAssets(knex)
    }

    private async _bakeNonWordpressPages(knex: db.KnexReadonlyTransaction) {
        if (this.bakeSteps.has("countries")) {
            await bakeCountries(this, knex)
        }
        await this.bakeSpecialPages(knex)
        await this.bakeCountryProfiles(knex)
        await this.bakeExplorers(knex)
        if (this.bakeSteps.has("charts")) {
            this.progressBar.tick({
                name: "Baking all changed grapher pages and deleting removed graphers",
            })
            await bakeAllChangedGrapherPagesAndDeleteRemovedGraphers(
                this.bakedSiteDir,
                knex
            )
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
        this.progressBar.tick({ name: "Flushing cache" })
        // Clear caches to allow garbage collection while waiting for next run
        postsFlushCache()
        siteBakingFlushCache()
        redirectsFlushCache()
    }
}
