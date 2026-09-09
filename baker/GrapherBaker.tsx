import * as _ from "lodash-es"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    mergeGrapherConfigs,
    Url,
    isUrlInActiveExperiment,
    DATA_PAGE_METADATA_EXPERIMENT_ID,
} from "@ourworldindata/utils"
import fs from "fs-extra"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import {
    getPostIdFromSlug,
    getPostRelatedCharts,
    getRelatedArticles,
    getRelatedResearchAndWritingForVariables,
} from "../db/model/Post.js"
import {
    AdditionalIndicator,
    GrapherInterface,
    DimensionProperty,
    OwidVariableWithSource,
    OwidChartDimensionInterface,
    FaqEntryData,
    ImageMetadata,
    DbPlainChart,
    DbRawChartConfig,
    DbEnrichedImage,
    ArchiveMetaInformation,
    ArchiveContext,
} from "@ourworldindata/types"
import ProgressBar from "progress"
import {
    getVariableDistribution,
    getIndicatorChartConfig,
    getVariableMetadata,
    getVariableOfDatapageIfApplicable,
    getOwnersForVariables,
} from "../db/model/Variable.js"
import {
    fetchAndParseFaqs,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { getMinimalAuthorsByNames } from "../db/model/Gdoc/GdocBase.js"
import { getDatapageDataV2 } from "../site/dataPage.js"
import { getAllImages } from "../db/model/Image.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

import { deleteOldGraphers } from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import {
    getRelatedChartsForVariable,
    getRelatedChartsForChart,
} from "../db/model/Chart.js"
import { getAllMultiDimDataPageSlugs } from "../db/model/MultiDimDataPage.js"
import pMap from "p-map"
import { stringify } from "safe-stable-stringify"
import { GrapherArchivalManifest } from "../serverUtils/archivalUtils.js"
import { getLatestArchivedChartPageVersionsIfEnabled } from "../db/model/ArchivedChartVersion.js"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archiveContextDictionary,
        forceDatapage,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archiveContextDictionary?: Record<number, ArchiveContext | undefined>
        forceDatapage?: boolean
    } = {}
) => {
    let variable
    try {
        variable = await getVariableOfDatapageIfApplicable(knex, grapher, {
            forceDatapage,
        })
    } catch (error) {
        // Charts that are only datapages because the experiment forces them
        // had no data-API dependency at bake time before this experiment. If
        // the primary indicator's metadata fetch fails (Data API/S3 outage,
        // deleted variable), fall back to baking the plain grapher page for
        // this cycle rather than failing the whole charts bake / archival run
        // — the fetch is awaited uncaught by SiteBaker's pMap and by the
        // archival loop. Charts with a real `datapages` row keep failing
        // loudly, exactly as on master.
        if (!forceDatapage) throw error
        await logErrorAndMaybeCaptureInSentry(
            new Error(
                `Data page error loading primary indicator for forced datapage ${grapher.slug}, baking as grapher page: ${error}`
            )
        )
        return undefined
    }

    if (!variable) return undefined

    // When baking from `bakeSingleGrapherChart`, we cache imageMetadata to avoid fetching every image for every chart
    // But when rendering a datapage from the mockSiteRouter we want to be able to fetch imageMetadata on the fly
    // And this function is the point in the two paths where it makes sense to do so
    if (!imageMetadataDictionary) {
        imageMetadataDictionary = await getAllImages(knex).then((images) =>
            _.keyBy(images, "filename")
        )
    }

    return await renderDataPageV2(
        {
            variableId: variable.id,
            variableMetadata: variable.metadata,
            isPreviewing: isPreviewing,
            useIndicatorGrapherConfigs: false,
            pageGrapher: grapher,
            imageMetadataDictionary,
            archiveContextDictionary,
        },
        knex
    )
}

/**
 * Whether this grapher should bake with the redesigned data-page treatment:
 * forced data-page rendering (even for charts that don't qualify for a
 * datapage by the usual rules, e.g. multi-indicator charts) plus the
 * metadata box with an indicator switcher.
 *
 * Currently this is gated on enrolment in the data-page metadata experiment.
 * The plan is to soon move ALL grapher pages over to the data page design —
 * when that happens, this function should simply return true (and the
 * matching client-side gate, `useNewDatapageDesign` in
 * site/DataPageV2Content.tsx, goes away with the experiment). Everything
 * downstream — forceDatapage, per-indicator metadata loading, the indicator
 * switcher — is keyed off this one predicate, so flipping it is the whole
 * migration on the baker side.
 */
export const shouldBakeAsDatapage = (grapher: GrapherInterface): boolean =>
    !!grapher.slug &&
    isUrlInActiveExperiment(
        DATA_PAGE_METADATA_EXPERIMENT_ID,
        `/grapher/${grapher.slug}`
    )

/**
 * Render a datapage if available, otherwise render a grapher page.
 *
 * Charts for which `shouldBakeAsDatapage` is true are forced to bake as
 * data pages — otherwise a grapher that wouldn't normally qualify (e.g. a
 * multi-indicator chart without a primary datapage indicator) would fall
 * through to `renderGrapherPage` and never see the metadata-box treatment.
 */
export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archiveContextDictionary,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archiveContextDictionary?: Record<number, ArchiveContext | undefined>
    } = {}
): Promise<string> => {
    const forceDatapage = shouldBakeAsDatapage(grapher)

    const datapage = await renderDatapageIfApplicable(grapher, false, knex, {
        imageMetadataDictionary,
        archiveContextDictionary,
        forceDatapage,
    })
    if (datapage) return datapage
    return renderGrapherPage(grapher, knex, {
        archiveContext:
            grapher.id !== undefined
                ? archiveContextDictionary?.[grapher.id]
                : undefined,
    })
}

export async function renderDataPageV2(
    {
        variableId,
        variableMetadata,
        isPreviewing,
        useIndicatorGrapherConfigs,
        pageGrapher,
        imageMetadataDictionary = {},
        archiveContextDictionary,
    }: {
        variableId: number
        variableMetadata: OwidVariableWithSource
        isPreviewing: boolean
        useIndicatorGrapherConfigs: boolean
        pageGrapher?: GrapherInterface
        imageMetadataDictionary?: Record<string, ImageMetadata>
        archiveContextDictionary?: Record<number, ArchiveContext | undefined>
    },
    knex: db.KnexReadonlyTransaction
) {
    // Only merge the grapher config on the indicator if the caller tells us to do so -
    // this is true for preview pages for datapages on the indicator level but false
    // if we are on Grapher pages. Once we have a good way in the grapher admin for how
    // to use indicator level defaults, we should reconsider how this works here.
    const grapher = useIndicatorGrapherConfigs
        ? mergeGrapherConfigs(
              (await getIndicatorChartConfig(knex, variableId)) ?? {},
              pageGrapher ?? {}
          )
        : (pageGrapher ?? {})

    // Cache parsed FAQ gdocs across the primary + additional indicators —
    // the Y-indicators of a multi-indicator chart usually come from the same
    // dataset and share their FAQ documents, so without this each pane
    // re-fetches and re-parses the same gdoc.
    type FaqGdocMap = Awaited<ReturnType<typeof fetchAndParseFaqs>>
    const faqGdocCache = new Map<string, FaqGdocMap[string] | undefined>()
    const fetchAndParseFaqsCached = async (
        faqDocIds: string[]
    ): Promise<FaqGdocMap> => {
        const missingIds = faqDocIds.filter((id) => !faqGdocCache.has(id))
        if (missingIds.length > 0) {
            const fetched = await fetchAndParseFaqs(knex, missingIds, {
                isPreviewing,
            })
            // Also cache ids that came back empty so they aren't re-fetched.
            for (const id of missingIds) faqGdocCache.set(id, fetched[id])
        }
        const result: FaqGdocMap = {}
        for (const id of faqDocIds) {
            const gdoc = faqGdocCache.get(id)
            if (gdoc !== undefined) result[id] = gdoc
        }
        return result
    }

    // Resolve the FAQ blocks for a single variable. Factored out so we can
    // resolve FAQs both for the primary indicator and, on charts enrolled in
    // the metadata box experiment, for each additional Y-indicator.
    const resolveFaqsForOneVariable = async (
        metadata: OwidVariableWithSource,
        idForLog: number
    ): Promise<FaqEntryData> => {
        const faqDocIds = _.compact(
            _.uniq(metadata.presentation?.faqs?.map((faq) => faq.gdocId))
        )
        const faqGdocs = await fetchAndParseFaqsCached(faqDocIds)
        const { resolvedFaqs, errors: faqResolveErrors } =
            resolveFaqsForVariable(faqGdocs, metadata)
        if (faqResolveErrors.length > 0) {
            for (const error of faqResolveErrors) {
                await logErrorAndMaybeCaptureInSentry(
                    new Error(
                        `Data page error in finding FAQs for variable ${idForLog}: ${error.error}`
                    )
                )
            }
        }
        return {
            faqs: resolvedFaqs?.flatMap((faq) => faq.enrichedFaq.content) ?? [],
        }
    }

    const faqEntries = await resolveFaqsForOneVariable(
        variableMetadata,
        variableId
    )

    // If we are rendering this in the context of an indicator page preview or similar,
    // then the chart config might be entirely empty. Make sure that dimensions is
    // set to the variableId as a Y variable in theses cases.
    if (!grapher.dimensions || grapher.dimensions.length === 0) {
        const dimensions: OwidChartDimensionInterface[] = [
            { variableId: variableId, property: DimensionProperty.y },
        ]
        grapher.dimensions = dimensions
    }
    const variableIds = _.uniq(
        _.compact(grapher.dimensions.map(({ variableId }) => variableId))
    )
    const distribution = await getVariableDistribution(knex, variableIds)

    const datapageMetadataExperimentActive = shouldBakeAsDatapage(grapher)

    // For multi-indicator charts the per-dimension `display.name` (set by the
    // chart author) is the right per-indicator label — the chart-level `title`
    // describes the whole chart, not any one indicator. Fall back to the
    // variable's own display/database name so two indicators without a
    // dimension name don't both end up labelled with the chart title in the
    // switcher. Only used on enrolled charts so non-enrolled data pages keep
    // their existing title resolution (which falls back to
    // `grapherConfig.title`).
    const indicatorTitleOverrideFor = (
        varId: number,
        metadata: OwidVariableWithSource
    ): string | undefined =>
        grapher.dimensions?.find(
            (d) => d.property === DimensionProperty.y && d.variableId === varId
        )?.display?.name ??
        metadata.display?.name ??
        metadata.name

    const additionalYVariableIds = _.uniq(
        _.compact(
            grapher.dimensions
                .filter((d) => d.property === DimensionProperty.y)
                .map((d) => d.variableId)
        )
    ).filter((id) => id !== variableId)
    // Only the switcher on a MULTI-indicator chart needs per-indicator labels;
    // on an enrolled single-indicator chart the per-indicator override would
    // replace the curated chart title in the box heading, the citations, and
    // (when the config has no explicit title) <title>/og:title with the
    // variable's display/database name.
    const isMultiIndicator = additionalYVariableIds.length > 0

    const datapageData = getDatapageDataV2(
        variableMetadata,
        grapher,
        datapageMetadataExperimentActive && isMultiIndicator
            ? {
                  indicatorTitleOverride: indicatorTitleOverrideFor(
                      variableId,
                      variableMetadata
                  ),
              }
            : undefined
    )

    // The metadata box experiment renders an indicator switcher over all of a
    // chart's Y-indicators. Only the enrolled charts (the experiment's `paths`)
    // pay the cost of loading the extra per-indicator metadata; everything else
    // bakes exactly as before with `additionalIndicators` left undefined.
    let additionalIndicators: AdditionalIndicator[] | undefined
    if (datapageMetadataExperimentActive) {

        const maybeAdditionalIndicators = await pMap(
            additionalYVariableIds,
            async (id): Promise<AdditionalIndicator | undefined> => {
                try {
                    // noCache to match how the primary indicator's metadata is
                    // fetched (getVariableOfDatapageIfApplicable), so a bake
                    // always reflects the latest variable metadata.
                    const metadata = await getVariableMetadata(id, {
                        noCache: true,
                    })
                    const indicatorDatapageData = getDatapageDataV2(
                        metadata,
                        grapher,
                        {
                            indicatorTitleOverride: indicatorTitleOverrideFor(
                                id,
                                metadata
                            ),
                        }
                    )
                    // "Managed by" is a dataset-level field (datasets.owners);
                    // each pane shows the owners of its own indicator's
                    // dataset.
                    indicatorDatapageData.owners = await getOwnersForVariables(
                        knex,
                        [id]
                    )
                    // Each pane resolves its own primary topic — without this
                    // the "part of the following publication" segment of
                    // getCitationDatapage silently disappears from every
                    // non-primary pane's "Cite this data".
                    indicatorDatapageData.primaryTopic = await getPrimaryTopic(
                        knex,
                        indicatorDatapageData.topicTagsLinks
                    )
                    // The indicator's grapher config is only consumed while
                    // building the pane data above (title/license overrides).
                    // Nothing reads it client-side — only the PRIMARY
                    // indicator's chartConfig is used (DataPageV2 merges it
                    // into the main chart) — and at ~5KB per indicator it
                    // dominated the hydration props blob on many-indicator
                    // charts (~150KB of 204KB on the 31-indicator deaths
                    // page). Strip it before serialization.
                    indicatorDatapageData.chartConfig = {}
                    return {
                        datapageData: indicatorDatapageData,
                        faqEntries: await resolveFaqsForOneVariable(
                            metadata,
                            id
                        ),
                    }
                } catch (error) {
                    // Don't let one broken additional indicator (e.g. a
                    // deleted variable or a transient S3 failure) take down
                    // the whole page bake — the chart baked fine without it
                    // before this experiment.
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Data page error loading additional indicator ${id} for chart ${grapher.slug}: ${error}`
                        )
                    )
                    return undefined
                }
            },
            { concurrency: 5 }
        )
        additionalIndicators = _.compact(maybeAdditionalIndicators)
    }

    datapageData.primaryTopic = await getPrimaryTopic(
        knex,
        datapageData.topicTagsLinks
    )

    let imageMetadata: Record<string, ImageMetadata> = {}

    if (datapageMetadataExperimentActive) {
        // "Managed by" is a dataset-level field (datasets.owners). Each pane
        // shows the owners of its own indicator's dataset: the primary
        // indicator's owners here, the additional indicators' owners set in
        // the loop above. Deliberately y-indicators only — the x-dimension
        // (usually GDP per capita or population on scatterplots/Marimekkos)
        // never gets a pane.
        datapageData.owners = await getOwnersForVariables(knex, [variableId])

        // Author links for the Byline are resolved once, across every pane's
        // owners, and attached to the primary datapageData (that's what the
        // page's AttachmentsContext reads).
        const ownerNames = _.uniq(
            [
                ...(datapageData.owners ?? []),
                ...(additionalIndicators ?? []).flatMap(
                    (ind) => ind.datapageData.owners ?? []
                ),
            ].flatMap((dataset) => dataset.owners)
        )
        datapageData.linkedAuthors = await getMinimalAuthorsByNames(
            knex,
            ownerNames
        )
    }

    const archiveContext =
        grapher.id !== undefined
            ? archiveContextDictionary?.[grapher.id]
            : undefined

    // If we're baking to an archival page, then we want to skip a bunch of sections
    // where the links would break
    if (archiveContext?.type !== "archive-page") {
        // Get the charts this variable is being used in (aka "related charts")
        // and exclude the current chart to avoid duplicates
        const allCharts = await getRelatedChartsForVariable(
            knex,
            variableId,
            grapher && "id" in grapher ? [grapher.id as number] : [],
            true
        )
        datapageData.allCharts = allCharts.map((chart) => ({
            ...chart,
            archiveContext: archiveContextDictionary?.[chart.chartId],
        }))

        if (datapageMetadataExperimentActive && grapher.id !== undefined) {
            const relatedChartsByCoview = await getRelatedChartsForChart(
                knex,
                grapher.id
            )
            datapageData.relatedChartsByCoview = relatedChartsByCoview.map(
                (chart) => ({
                    ...chart,
                    archiveContext: archiveContextDictionary?.[chart.chartId],
                })
            )
        }

        datapageData.relatedResearch =
            await getRelatedResearchAndWritingForVariables(knex, [variableId])

        const relatedResearchFilenames = datapageData.relatedResearch
            .map((r) => r.imageUrl)
            .filter((f): f is string => !!f)

        imageMetadata = {
            ...imageMetadata,
            ..._.pick(
                imageMetadataDictionary,
                _.uniq(relatedResearchFilenames)
            ),
        }
    }

    let canonicalUrl: string
    if (archiveContext?.type === "archive-page") {
        canonicalUrl = archiveContext.archiveUrl
    } else {
        canonicalUrl = grapher?.slug
            ? `${BAKED_GRAPHER_URL}/${grapher.slug}`
            : ""
    }

    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            additionalIndicators={additionalIndicators}
            useNewDatapageDesign={datapageMetadataExperimentActive}
            canonicalUrl={canonicalUrl}
            baseUrl={BAKED_BASE_URL}
            isPreviewing={isPreviewing}
            imageMetadata={imageMetadata}
            faqEntries={faqEntries}
            archiveContext={archiveContext}
            distribution={distribution}
        />
    )
}

/**
 *
 * Similar to renderDataPageOrGrapherPage(), but for admin previews
 */
export const renderPreviewDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    chartId: number,
    knex: db.KnexReadonlyTransaction,
    options?: { forceDatapage?: boolean }
) => {
    // Match renderDataPageOrGrapherPage: charts for which
    // shouldBakeAsDatapage is true preview as data pages too.
    const forceDatapage =
        options?.forceDatapage || shouldBakeAsDatapage(grapher)

    const archiveContextDictionary =
        await getLatestArchivedChartPageVersionsIfEnabled(knex)
    const datapage = await renderDatapageIfApplicable(grapher, true, knex, {
        archiveContextDictionary,
        forceDatapage,
    })
    if (datapage) return datapage

    return renderGrapherPage(grapher, knex, {
        archiveContext: archiveContextDictionary[chartId],
        isPreviewing: true,
    })
}

const renderGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        archiveContext,
        isPreviewing,
    }: {
        archiveContext?: ArchiveContext
        isPreviewing?: boolean
    } = {}
) => {
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const postSlug = Url.fromURL(grapher.originUrl ?? "").slug
    // TODO: update this to use gdocs posts
    const postId =
        postSlug && !isOnArchivalPage
            ? await getPostIdFromSlug(knex, postSlug)
            : undefined
    const relatedCharts =
        postId && !isOnArchivalPage
            ? await getPostRelatedCharts(knex, postId)
            : undefined
    const relatedArticles =
        grapher.id && !isOnArchivalPage
            ? await getRelatedArticles(knex, grapher.id)
            : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            archiveContext={archiveContext}
            isPreviewing={isPreviewing}
        />
    )
}

export const bakeSingleGrapherPageForArchival = async (
    bakedSiteDir: string,
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archiveInfo,
        manifest,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archiveInfo: ArchiveMetaInformation
        manifest: GrapherArchivalManifest
    }
) => {
    const outPathHtml = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPathHtml,
        await renderDataPageOrGrapherPage(grapher, knex, {
            imageMetadataDictionary,
            archiveContextDictionary: {
                [grapher.id as number]: archiveInfo,
            },
        })
    )
    const outPathManifest = `${bakedSiteDir}/grapher/${grapher.slug}.manifest.json`

    await fs.writeFile(outPathManifest, stringify(manifest, undefined, 2))
}

const bakeGrapherPage = async (
    args: BakeSingleGrapherChartArguments,
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    // Need to set up the connection for using TypeORM in
    // renderDataPageOrGrapherPage() when baking using multiple worker threads
    // (MAX_NUM_BAKE_PROCESSES > 1). It could be done in
    // renderDataPageOrGrapherPage() too, but given that this render function is also used
    // for rendering a datapage preview in the admin where worker threads are
    // not used, lifting the connection set up here seems more appropriate.

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${args.bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPath,
        await renderDataPageOrGrapherPage(grapher, knex, {
            imageMetadataDictionary: args.imageMetadataDictionary,
            archiveContextDictionary: args.archiveContextDictionary,
        })
    )
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
    imageMetadataDictionary: Record<string, DbEnrichedImage>
    archiveContextDictionary: Record<number, ArchiveContext | undefined>
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments,
    knex: db.KnexReadonlyTransaction
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log(`⏩ ${grapher.slug} redirects to explorer`)
        return
    }

    await bakeGrapherPage(args, grapher, knex)
    return args
}

export const bakeAllChangedGrapherPagesAndDeleteRemovedGraphers = async (
    bakedSiteDir: string,
    knex: db.KnexReadonlyTransaction
) => {
    const chartsToBake = await knexRaw<
        Pick<DbPlainChart, "id"> & {
            config: DbRawChartConfig["config"]
            slug: string
        }
    >(
        knex,
        `-- sql
        SELECT
            c.id,
            cc.config as config,
            cc.slug
        FROM charts c
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE JSON_EXTRACT(cc.config, "$.isPublished")=true
        ORDER BY cc.slug ASC`
    )

    await fs.mkdirp(bakedSiteDir + "/grapher")

    // Prefetch imageMetadata and archiveContextDictionary instead of each grapher page fetching them
    // individually. imageMetadata is used by the google docs powering rich
    // text (including images) in data pages.
    const imageMetadataDictionary = await getAllImages(knex).then((images) =>
        _.keyBy(images, "filename")
    )
    const archiveContextDictionary =
        await getLatestArchivedChartPageVersionsIfEnabled(knex)

    const jobs: BakeSingleGrapherChartArguments[] = chartsToBake.map((row) => ({
        id: row.id,
        config: row.config,
        bakedSiteDir: bakedSiteDir,
        slug: row.slug,
        imageMetadataDictionary,
        archiveContextDictionary,
    }))

    const progressBar = new ProgressBar(
        "bake grapher page [:bar] :current/:total :elapseds :rate/s :name\n",
        {
            width: 20,
            total: jobs.length + 1,
            renderThrottle: 0,
        }
    )

    await pMap(
        jobs,
        async (job) => {
            // We want to run this code on multiple threads, so we need to
            // be able to use multiple transactions so that we can use
            // multiple connections to the database.
            // Read-write consistency is not a concern here, thankfully.
            await db.knexReadWriteTransaction(
                async (knex) => await bakeSingleGrapherChart(job, knex),
                db.TransactionCloseMode.KeepOpen
            )
            progressBar.tick({ name: job.slug })
        },
        { concurrency: 10 }
    )

    // Multi-dim data pages are baked into the same directory as graphers
    // and they are handled separately.
    const multiDimSlugs = await getAllMultiDimDataPageSlugs(knex)
    const newSlugs = excludeUndefined([
        ...chartsToBake.map((row) => row.slug),
        ...multiDimSlugs,
    ])
    await deleteOldGraphers(bakedSiteDir, newSlugs)
    progressBar.tick({ name: `✅ Deleted old graphers` })
}
