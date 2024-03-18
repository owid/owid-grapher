import fs from "fs-extra"
import path from "path"
import { glob } from "glob"
import { keyBy, without, uniq, mapValues, pick } from "lodash"
import ProgressBar from "progress"
import * as wpdb from "../db/wpdb.js"
import * as db from "../db/db.js"
import {
    BLOG_POSTS_PER_PAGE,
    BASE_DIR,
    WORDPRESS_DIR,
    GDOCS_DETAILS_ON_DEMAND_ID,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"

import {
    renderFrontPage,
    renderBlogByPageNum,
    renderChartsPage,
    renderMenuJson,
    renderSearchPage,
    renderDonatePage,
    entriesByYearPage,
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
} from "../baker/siteRenderers.js"
import {
    bakeGrapherUrls,
    getGrapherExportsByUrl,
    GrapherExports,
} from "../baker/GrapherBakingUtils.js"
import { makeSitemap } from "../baker/sitemap.js"
import { bakeCountries } from "../baker/countryProfiles.js"
import { bakeDriveImages } from "../baker/GDriveImagesBaker.js"
import {
    countries,
    FullPost,
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
    GrapherTabOption,
} from "@ourworldindata/utils"

import { execWrapper } from "../db/execWrapper.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import {
    getGrapherRedirectsMap,
    getRedirects,
    flushCache as redirectsFlushCache,
} from "./redirects.js"
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import { EXPLORERS_ROUTE_FOLDER } from "../explorer/ExplorerConstants.js"
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
    postsTable,
} from "../db/model/Post.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { Image, getAllImages } from "../db/model/Image.js"
import { generateEmbedSnippet } from "../site/viteUtils.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import {
    getChartEmbedUrlsInPublishedWordpressPosts,
    mapSlugsToConfigs,
} from "../db/model/Chart.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../settings/clientSettings.js"
import pMap from "p-map"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"
import { calculateDataInsightIndexPageCount } from "../db/model/Gdoc/gdocUtils.js"
import {
    getVariableMetadata,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import { getAllMinimalGdocBaseObjects } from "../db/model/Gdoc/GdocFactory.js"
import { getBakePath } from "@ourworldindata/components"
import { GdocAuthor } from "../db/model/Gdoc/GdocAuthor.js"
import { DATA_INSIGHTS_ATOM_FEED_NAME } from "../site/gdocs/utils.js"

type PrefetchedAttachments = {
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    linkedCharts: {
        graphers: Record<string, LinkedChart>
        explorers: Record<string, LinkedChart>
    }
    linkedIndicators: Record<number, LinkedIndicator>
}

// These aren't all "wordpress" steps
// But they're only run when you have the full stack available
const wordpressSteps = [
    "assets",
    "blogIndex",
    "embeds",
    "googleScholar",
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
    "gdocPosts",
    "gdriveImages",
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
    return total
}

export class SiteBaker {
    private grapherExports!: GrapherExports
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
            }
        )
        this.explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)
    }

    private async bakeEmbeds(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("embeds")) return

        // Find all grapher urls used as embeds in all Wordpress posts on the site
        const grapherUrls = uniq(
            await getChartEmbedUrlsInPublishedWordpressPosts(knex)
        )

        await bakeGrapherUrls(knex, grapherUrls)

        this.grapherExports = await getGrapherExportsByUrl()
        this.progressBar.tick({ name: "✅ baked embeds" })
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
                        knex,
                        this.grapherExports
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

    // Bake an individual post/page
    private async bakePost(post: FullPost, knex: db.KnexReadonlyTransaction) {
        const html = await renderPost(
            post,
            knex,
            this.baseUrl,
            this.grapherExports
        )

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
                    !path.startsWith("entries-by-year") &&
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

    // Prefetches all linkedDocuments, imageMetadata, linkedCharts, and linkedIndicators instead of having to fetch them
    // for each individual gdoc. Optionally takes a tuple of string arrays to pick from the prefetched
    // dictionaries.
    _prefetchedAttachmentsCache: PrefetchedAttachments | undefined = undefined
    private async getPrefetchedGdocAttachments(
        knex: db.KnexReadonlyTransaction,
        picks?: [string[], string[], string[], string[]]
    ): Promise<PrefetchedAttachments> {
        if (!this._prefetchedAttachmentsCache) {
            const publishedGdocs = await getAllMinimalGdocBaseObjects(knex)
            const publishedGdocsDictionary = keyBy(publishedGdocs, "id")

            const imageMetadataDictionary: Record<string, Image> =
                await getAllImages(knex).then((images) =>
                    keyBy(images, "filename")
                )
            const publishedExplorersBySlug = await this.explorerAdminServer
                .getAllPublishedExplorersBySlugCached()
                .then((results) =>
                    mapValues(results, (cur) => ({
                        originalSlug: cur.slug,
                        resolvedUrl: `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${cur.slug}`,
                        queryString: "",
                        title: cur.title || "",
                        thumbnail:
                            cur.thumbnail ||
                            `${BAKED_BASE_URL}/default-thumbnail.jpg`,
                        tags: [],
                    }))
                )

            // Includes redirects
            const publishedChartsRaw = await mapSlugsToConfigs(knex)
            const publishedCharts: LinkedChart[] = await Promise.all(
                publishedChartsRaw.map(async (chart) => {
                    const tab = chart.config.tab ?? GrapherTabOption.chart
                    const datapageIndicator =
                        await getVariableOfDatapageIfApplicable(chart.config)
                    return {
                        originalSlug: chart.slug,
                        resolvedUrl: `${BAKED_GRAPHER_URL}/${chart.config.slug}`,
                        tab,
                        queryString: "",
                        title: chart.config.title || "",
                        thumbnail: `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chart.config.slug}.svg`,
                        indicatorId: datapageIndicator?.id,
                        tags: [],
                    }
                })
            )
            const publishedChartsBySlug = keyBy(publishedCharts, "originalSlug")

            const publishedChartsWithIndicatorIds = publishedCharts.filter(
                (chart) => chart.indicatorId
            )

            const datapageIndicators: LinkedIndicator[] = await Promise.all(
                publishedChartsWithIndicatorIds.map(async (linkedChart) => {
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
            const datapageIndicatorsById = keyBy(datapageIndicators, "id")

            const prefetchedAttachments = {
                linkedDocuments: publishedGdocsDictionary,
                imageMetadata: imageMetadataDictionary,
                linkedCharts: {
                    explorers: publishedExplorersBySlug,
                    graphers: publishedChartsBySlug,
                },
                linkedIndicators: datapageIndicatorsById,
            }
            this._prefetchedAttachmentsCache = prefetchedAttachments
        }
        if (picks) {
            const [
                linkedDocumentIds,
                imageFilenames,
                linkedGrapherSlugs,
                linkedExplorerSlugs,
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
        // TODO: the knex instance should be handed down as a parameter
        const alreadyPublishedViaGdocsSlugsSet =
            await db.getSlugsWithPublishedGdocsSuccessors(knex)

        const postsApi = await getPostsFromSnapshots(
            knex,
            undefined,
            (postrow) => !alreadyPublishedViaGdocsSlugsSet.has(postrow.slug)
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async bakeGDocPosts(knex: db.KnexReadWriteTransaction, slugs?: string[]) {
        if (!this.bakeSteps.has("gdocPosts")) return
        const publishedGdocs = await GdocPost.getPublishedGdocPosts(knex)

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
                publishedGdoc.linkedDocumentIds,
                publishedGdoc.linkedImageFilenames,
                publishedGdoc.linkedChartSlugs.grapher,
                publishedGdoc.linkedChartSlugs.explorer,
            ])
            publishedGdoc.linkedDocuments = attachments.linkedDocuments
            publishedGdoc.imageMetadata = attachments.imageMetadata
            publishedGdoc.linkedCharts = {
                ...attachments.linkedCharts.graphers,
                ...attachments.linkedCharts.explorers,
            }
            publishedGdoc.linkedIndicators = attachments.linkedIndicators

            // this is a no-op if the gdoc doesn't have an all-chart block
            await publishedGdoc.loadRelatedCharts(knex)

            await publishedGdoc.validate(knex)
            if (
                publishedGdoc.errors.filter(
                    (e) => e.type === OwidGdocErrorMessageType.Error
                ).length
            ) {
                await logErrorAndMaybeSendToBugsnag(
                    `Error(s) baking "${
                        publishedGdoc.slug
                    }" :\n  ${publishedGdoc.errors
                        .map((error) => error.message)
                        .join("\n  ")}`
                )
            }
            try {
                await this.bakeOwidGdoc(publishedGdoc)
            } catch (e) {
                await logErrorAndMaybeSendToBugsnag(
                    `Error baking gdoc post with id "${publishedGdoc.id}" and slug "${publishedGdoc.slug}": ${e}`
                )
            }
        }

        this.progressBar.tick({ name: "✅ baked google doc posts" })
    }

    // Bake unique individual pages

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async bakeSpecialPages(knex: db.KnexReadWriteTransaction) {
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
            `${this.bakedSiteDir}/headerMenu.json`,
            await renderMenuJson()
        )

        await this.stageWrite(
            `${this.bakedSiteDir}/sitemap.xml`,
            await makeSitemap(this.explorerAdminServer, knex)
        )

        await this.stageWrite(
            `${this.bakedSiteDir}/charts.html`,
            await renderChartsPage(knex, this.explorerAdminServer)
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
                    config ->> '$.slug' as slug,
                    config ->> '$.subtitle' as subtitle,
                    config ->> '$.note' as note
                FROM
                    charts
                WHERE
                    JSON_EXTRACT(config, "$.isPublished") = true
                AND (
                    JSON_EXTRACT(config, "$.subtitle") LIKE "%#dod:%"
                    OR JSON_EXTRACT(config, "$.note") LIKE "%#dod:%"
                )
                ORDER BY
                    JSON_EXTRACT(config, "$.slug") ASC
            `
            )

        for (const chart of charts) {
            const detailIds = new Set(
                extractDetailsFromSyntax(`${chart.note} ${chart.subtitle}`)
            )
            for (const detailId of detailIds) {
                if (!details[detailId]) {
                    await logErrorAndMaybeSendToBugsnag(
                        `Grapher with slug ${chart.slug} references dod "${detailId}" which does not exist`
                    )
                }
            }
        }

        this.progressBar.tick({ name: "✅ validated grapher dods" })
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
            await logErrorAndMaybeSendToBugsnag(
                `Error(s) baking details: ${parseErrors
                    .map((e) => e.message)
                    .join(", ")}`
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async bakeDataInsights(knex: db.KnexReadWriteTransaction) {
        if (!this.bakeSteps.has("dataInsights")) return
        const latestDataInsights = await db.getPublishedDataInsights(knex, 5)
        const publishedDataInsights =
            await GdocDataInsight.getPublishedDataInsights(knex)

        for (const dataInsight of publishedDataInsights) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                dataInsight.linkedDocumentIds,
                dataInsight.linkedImageFilenames,
                dataInsight.linkedChartSlugs.grapher,
                dataInsight.linkedChartSlugs.explorer,
            ])
            dataInsight.linkedDocuments = attachments.linkedDocuments
            dataInsight.imageMetadata = attachments.imageMetadata
            dataInsight.linkedCharts = {
                ...attachments.linkedCharts.graphers,
                ...attachments.linkedCharts.explorers,
            }
            dataInsight.latestDataInsights = latestDataInsights

            await dataInsight.validate(knex)
            if (
                dataInsight.errors.filter(
                    (e) => e.type === OwidGdocErrorMessageType.Error
                ).length
            ) {
                await logErrorAndMaybeSendToBugsnag(
                    `Error(s) baking data insight "${
                        dataInsight.slug
                    }" :\n  ${dataInsight.errors
                        .map((error) => error.message)
                        .join("\n  ")}`
                )
            }
            try {
                await this.bakeOwidGdoc(dataInsight)
            } catch (e) {
                await logErrorAndMaybeSendToBugsnag(
                    `Error baking gdoc post with id "${dataInsight.id}" and slug "${dataInsight.slug}": ${e}`
                )
            }
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async bakeAuthors(knex: db.KnexReadWriteTransaction) {
        if (!this.bakeSteps.has("authors")) return

        const publishedAuthors = await GdocAuthor.getPublishedAuthors(knex)

        for (const publishedAuthor of publishedAuthors) {
            const attachments = await this.getPrefetchedGdocAttachments(knex, [
                publishedAuthor.linkedDocumentIds,
                publishedAuthor.linkedImageFilenames,
                publishedAuthor.linkedChartSlugs.grapher,
                publishedAuthor.linkedChartSlugs.explorer,
            ])

            // We don't need these to be attached to the gdoc in the current
            // state of author pages. We'll keep them here as documentation
            // of intent, until we need them.
            // publishedAuthor.linkedCharts = {
            //     ...attachments.linkedCharts.graphers,
            //     ...attachments.linkedCharts.explorers,
            // }

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
                await logErrorAndMaybeSendToBugsnag(
                    `Error(s) baking "${
                        publishedAuthor.slug
                    }" :\n  ${publishedAuthor.errors
                        .map((error) => error.message)
                        .join("\n  ")}`
                )
            }
            try {
                await this.bakeOwidGdoc(publishedAuthor)
            } catch (e) {
                await logErrorAndMaybeSendToBugsnag(
                    `Error baking author with id "${publishedAuthor.id}" and slug "${publishedAuthor.slug}": ${e}`
                )
            }
        }

        this.progressBar.tick({ name: "✅ baked author pages" })
    }

    // Pages that are expected by google scholar for indexing
    private async bakeGoogleScholar(trx: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("googleScholar")) return
        await this.stageWrite(
            `${this.bakedSiteDir}/entries-by-year.html`,
            await entriesByYearPage(trx)
        )

        const rows = (await trx
            .table(postsTable)
            .where({ status: "publish" })
            .whereNot({ type: "wp_block" })
            .join("post_tags", { "post_tags.post_id": "posts.id" })
            .join("tags", { "tags.id": "post_tags.tag_id" })
            .where({ "tags.name": "Entries" })
            .select(trx.raw("distinct year(published_at) as year"))
            .orderBy("year", "DESC")) as { year: number }[]

        const years = rows.map((r) => r.year)

        for (const year of years) {
            await this.stageWrite(
                `${this.bakedSiteDir}/entries-by-year/${year}.html`,
                await entriesByYearPage(trx, year)
            )
        }

        this.progressBar.tick({ name: "✅ baked google scholar" })
    }

    // Bake the blog index

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async bakeBlogIndex(knex: db.KnexReadWriteTransaction) {
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async bakeRSS(knex: db.KnexReadWriteTransaction) {
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

    private async bakeDriveImages(knex: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("gdriveImages")) return
        await this.ensureDir("images/published")
        await bakeDriveImages(knex, this.bakedSiteDir)
        this.progressBar.tick({ name: "✅ baked google drive images" })
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
                await logErrorAndMaybeSendToBugsnag(
                    `Tag icon "${icon}" does not have a corresponding tag in the database.`
                )
            }
        }
    }

    // Bake the static assets
    private async bakeAssets(trx: db.KnexReadonlyTransaction) {
        if (!this.bakeSteps.has("assets")) return

        // do not delete images/published folder so that we don't have to sync gdrive images again
        const excludes = "--exclude images/published"

        await execWrapper(
            `rsync -havL --delete ${WORDPRESS_DIR}/web/app/uploads ${this.bakedSiteDir}/ ${excludes}`
        )

        await execWrapper(
            `rm -rf ${this.bakedSiteDir}/assets && cp -r ${BASE_DIR}/dist/assets ${this.bakedSiteDir}/assets`
        )
        await this.validateTagIcons(trx)
        await execWrapper(
            `rsync -hav --delete ${BASE_DIR}/public/* ${this.bakedSiteDir}/ ${excludes}`
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

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async bakeWordpressPages(knex: db.KnexReadWriteTransaction) {
        await this.bakeRedirects(knex)
        await this.bakeEmbeds(knex)
        await this.bakeBlogIndex(knex)
        await this.bakeRSS(knex)
        await this.bakeAssets(knex)
        await this.bakeGoogleScholar(knex)
        await this.bakePosts(knex)
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    private async _bakeNonWordpressPages(knex: db.KnexReadWriteTransaction) {
        if (this.bakeSteps.has("countries")) {
            await bakeCountries(this, knex)
        }
        await this.bakeSpecialPages(knex)
        await this.bakeCountryProfiles(knex)
        await this.bakeExplorers(knex)
        if (this.bakeSteps.has("charts")) {
            await bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
                this.bakedSiteDir,
                knex
            )
            this.progressBar.tick({
                name: "✅ bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers",
            })
        }
        await this.bakeDetailsOnDemand(knex)
        await this.validateGrapherDodReferences(knex)
        await this.bakeGDocPosts(knex)
        await this.bakeDataInsights(knex)
        await this.bakeAuthors(knex)
        await this.bakeDriveImages(knex)
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async bakeNonWordpressPages(knex: db.KnexReadWriteTransaction) {
        const progressBarTotal = nonWordpressSteps
            .map((step) => this.bakeSteps.has(step))
            .filter((hasStep) => hasStep).length
        this.progressBar = new ProgressBar(
            "--- BakeAll [:bar] :current/:total :elapseds :name\n",
            {
                total: progressBarTotal,
            }
        )
        await this._bakeNonWordpressPages(knex)
    }

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    async bakeAll(knex: db.KnexReadWriteTransaction) {
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
        await wpdb.singleton.end()
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
