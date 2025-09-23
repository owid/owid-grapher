import * as _ from "lodash-es"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    mergeGrapherConfigs,
    experiments,
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
    getMergedGrapherConfigForVariable,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import {
    fetchAndParseFaqs,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { getDatapageDataV2 } from "../site/dataPage.js"
import { getAllImages } from "../db/model/Image.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

import {
    deleteOldGraphers,
    getTagsWithDataInsights,
    getTagToSlugMap,
} from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import { getAllMultiDimDataPageSlugs } from "../db/model/MultiDimDataPage.js"
import pMap from "p-map"
import { stringify } from "safe-stable-stringify"
import { GrapherArchivalManifest } from "../serverUtils/archivalUtils.js"
import { getLatestChartArchivedVersionsIfEnabled } from "../db/model/archival/archivalDb.js"
import { GdocDataInsight } from "../db/model/Gdoc/GdocDataInsight.js"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archivedChartInfoDictionary,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archivedChartInfoDictionary?: Record<number, ArchiveContext | undefined>
    } = {}
) => {
    const variable = await getVariableOfDatapageIfApplicable(knex, grapher)

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
            archivedChartInfoDictionary,
        },
        knex
    )
}

/**
 *
 * Render a datapage if available, otherwise render a grapher page.
 */

export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        archivedChartInfoDictionary,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        archivedChartInfoDictionary?: Record<number, ArchiveContext | undefined>
    } = {}
): Promise<string> => {
    const datapage = await renderDatapageIfApplicable(grapher, false, knex, {
        imageMetadataDictionary,
        archivedChartInfoDictionary,
    })
    if (datapage) return datapage
    return renderGrapherPage(grapher, knex, {
        archivedChartInfo:
            grapher.id !== undefined
                ? archivedChartInfoDictionary?.[grapher.id]
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
        archivedChartInfoDictionary,
    }: {
        variableId: number
        variableMetadata: OwidVariableWithSource
        isPreviewing: boolean
        useIndicatorGrapherConfigs: boolean
        pageGrapher?: GrapherInterface
        imageMetadataDictionary?: Record<string, ImageMetadata>
        archivedChartInfoDictionary?: Record<number, ArchiveContext | undefined>
    },
    knex: db.KnexReadonlyTransaction
) {
    const grapherConfigForVariable = await getMergedGrapherConfigForVariable(
        knex,
        variableId
    )
    // Only merge the grapher config on the indicator if the caller tells us to do so -
    // this is true for preview pages for datapages on the indicator level but false
    // if we are on Grapher pages. Once we have a good way in the grapher admin for how
    // to use indicator level defaults, we should reconsider how this works here.
    const grapher = useIndicatorGrapherConfigs
        ? mergeGrapherConfigs(grapherConfigForVariable ?? {}, pageGrapher ?? {})
        : (pageGrapher ?? {})

    const faqDocIds = _.compact(
        _.uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
    )

    const faqGdocs = await fetchAndParseFaqs(knex, faqDocIds, { isPreviewing })

    const { resolvedFaqs, errors: faqResolveErrors } = resolveFaqsForVariable(
        faqGdocs,
        variableMetadata
    )

    if (faqResolveErrors.length > 0) {
        for (const error of faqResolveErrors) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(
                    `Data page error in finding FAQs for variable ${variableId}: ${error.error}`
                )
            )
        }
    }

    const faqEntries: FaqEntryData = {
        faqs: resolvedFaqs?.flatMap((faq) => faq.enrichedFaq.content) ?? [],
    }

    // If we are rendering this in the context of an indicator page preview or similar,
    // then the chart config might be entirely empty. Make sure that dimensions is
    // set to the variableId as a Y variable in theses cases.
    if (
        !grapher.dimensions ||
        (grapher.dimensions as OwidChartDimensionInterface[]).length === 0
    ) {
        const dimensions: OwidChartDimensionInterface[] = [
            {
                variableId: variableId,
                property: DimensionProperty.y,
                display: variableMetadata.display,
            },
        ]
        grapher.dimensions = dimensions
    }
    const datapageData = getDatapageDataV2(variableMetadata, grapher ?? {})

    datapageData.primaryTopic = await getPrimaryTopic(
        knex,
        datapageData.topicTagsLinks,
        grapher.slug
    )

    let imageMetadata: Record<string, ImageMetadata> = {}
    let tagToSlugMap: Record<string, string> = {}

    const archivedChartInfo =
        grapher.id !== undefined
            ? archivedChartInfoDictionary?.[grapher.id]
            : undefined

    // If we're baking to an archival page, then we want to skip a bunch of sections
    // where the links would break
    if (archivedChartInfo?.type !== "archive-page") {
        // Get the charts this variable is being used in (aka "related charts")
        // and exclude the current chart to avoid duplicates
        const allCharts = await getRelatedChartsForVariable(
            knex,
            variableId,
            grapher && "id" in grapher ? [grapher.id as number] : []
        )
        datapageData.allCharts = allCharts.map((chart) => ({
            ...chart,
            archivedChartInfo: archivedChartInfoDictionary?.[chart.chartId],
        }))

        datapageData.relatedResearch =
            await getRelatedResearchAndWritingForVariables(knex, [variableId])

        const relatedResearchFilenames = datapageData.relatedResearch
            .map((r) => r.imageUrl)
            .filter((f): f is string => !!f)

        imageMetadata = _.pick(
            imageMetadataDictionary,
            _.uniq(relatedResearchFilenames)
        )

        tagToSlugMap = await getTagToSlugMap(knex)
        const tagsWithDataInsights = await getTagsWithDataInsights(knex)

        datapageData.hasDataInsights = datapageData.primaryTopic?.topicTag
            ? tagsWithDataInsights.has(datapageData.primaryTopic.topicTag)
            : false

        const isInInsightsExperiment =
            grapher.slug !== undefined
                ? experiments.some(
                      (exp) =>
                          exp.id === "exp-data-page-insight-btns-2" &&
                          !exp.isExpired() &&
                          exp.isUrlInPaths(`/grapher/${grapher.slug}`)
                  )
                : false

        // only retrieve data insights and add to datapageData if topic has data
        // insights and grapher is in path of the exp-data-page-insight-btns-2 experiment
        if (
            datapageData.hasDataInsights &&
            isInInsightsExperiment &&
            datapageData.primaryTopic?.topicTag
        ) {
            const dataInsights = await GdocDataInsight.getPublishedDataInsights(
                knex,
                0,
                tagToSlugMap[datapageData.primaryTopic.topicTag]
            )
            datapageData.dataInsights = dataInsights.slice(0, 3).map((row) => {
                return {
                    title: row.content.title,
                    slug: row.slug,
                }
            })
        }
    }

    let canonicalUrl: string
    if (archivedChartInfo?.type === "archive-page") {
        canonicalUrl = archivedChartInfo.archiveUrl
    } else {
        canonicalUrl = grapher?.slug
            ? `${BAKED_GRAPHER_URL}/${grapher.slug}`
            : ""
    }

    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            canonicalUrl={canonicalUrl}
            baseUrl={BAKED_BASE_URL}
            isPreviewing={isPreviewing}
            imageMetadata={imageMetadata}
            faqEntries={faqEntries}
            tagToSlugMap={tagToSlugMap}
            archivedChartInfo={archivedChartInfo}
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
    knex: db.KnexReadonlyTransaction
) => {
    const archivedChartInfoDictionary =
        await getLatestChartArchivedVersionsIfEnabled(knex)
    const datapage = await renderDatapageIfApplicable(grapher, true, knex, {
        archivedChartInfoDictionary,
    })
    if (datapage) return datapage

    return renderGrapherPage(grapher, knex, {
        archivedChartInfo: archivedChartInfoDictionary[chartId],
        isPreviewing: true,
    })
}

const renderGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        archivedChartInfo,
        isPreviewing,
    }: {
        archivedChartInfo?: ArchiveContext
        isPreviewing?: boolean
    } = {}
) => {
    const isOnArchivalPage = archivedChartInfo?.type === "archive-page"
    const postSlug = urlToSlug(grapher.originUrl || "") as string | undefined
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
            archivedChartInfo={archivedChartInfo}
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
            archivedChartInfoDictionary: {
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
            archivedChartInfoDictionary: args.archivedChartInfoDictionary,
        })
    )
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
    imageMetadataDictionary: Record<string, DbEnrichedImage>
    archivedChartInfoDictionary: Record<number, ArchiveContext | undefined>
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
            config: DbRawChartConfig["full"]
            slug: string
        }
    >(
        knex,
        `-- sql
        SELECT
            c.id,
            cc.full as config,
            cc.slug
        FROM charts c
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE JSON_EXTRACT(cc.full, "$.isPublished")=true
        ORDER BY cc.slug ASC`
    )

    await fs.mkdirp(bakedSiteDir + "/grapher")

    // Prefetch imageMetadata and archivedChartInfoDictionary instead of each grapher page fetching them
    // individually. imageMetadata is used by the google docs powering rich
    // text (including images) in data pages.
    const imageMetadataDictionary = await getAllImages(knex).then((images) =>
        _.keyBy(images, "filename")
    )
    const archivedChartInfoDictionary =
        await getLatestChartArchivedVersionsIfEnabled(knex)

    const jobs: BakeSingleGrapherChartArguments[] = chartsToBake.map((row) => ({
        id: row.id,
        config: row.config,
        bakedSiteDir: bakedSiteDir,
        slug: row.slug,
        imageMetadataDictionary,
        archivedChartInfoDictionary,
    }))

    const progressBar = new ProgressBar(
        "bake grapher page [:bar] :current/:total :elapseds :rate/s :name\n",
        {
            width: 20,
            total: chartsToBake.length + 1,
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
