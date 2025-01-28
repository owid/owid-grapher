import { GrapherPage } from "../site/GrapherPage.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    uniq,
    keyBy,
    compact,
    mergeGrapherConfigs,
} from "@ourworldindata/utils"
import fs from "fs-extra"
import * as lodash from "lodash"
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
    AssetMap,
} from "@ourworldindata/types"
import ProgressBar from "progress"
import {
    getMergedGrapherConfigForVariable,
    getVariableOfDatapageIfApplicable,
} from "../db/model/Variable.js"
import {
    fetchAndParseFaqs,
    getDatapageDataV2,
    getPrimaryTopic,
    resolveFaqsForVariable,
} from "./DatapageHelpers.js"
import { getAllImages } from "../db/model/Image.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

import { deleteOldGraphers, getTagToSlugMap } from "./GrapherBakingUtils.js"
import { knexRaw } from "../db/db.js"
import { getRelatedChartsForVariable } from "../db/model/Chart.js"
import { getAllMultiDimDataPageSlugs } from "../db/model/MultiDimDataPage.js"
import pMap from "p-map"

const renderDatapageIfApplicable = async (
    grapher: GrapherInterface,
    isPreviewing: boolean,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        assetMap,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        assetMap?: AssetMap
    } = {}
) => {
    const variable = await getVariableOfDatapageIfApplicable(grapher)

    if (!variable) return undefined

    // When baking from `bakeSingleGrapherChart`, we cache imageMetadata to avoid fetching every image for every chart
    // But when rendering a datapage from the mockSiteRouter we want to be able to fetch imageMetadata on the fly
    // And this function is the point in the two paths where it makes sense to do so
    if (!imageMetadataDictionary) {
        imageMetadataDictionary = await getAllImages(knex).then((images) =>
            keyBy(images, "filename")
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
            assetMap,
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
        assetMap,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        assetMap?: AssetMap
    } = {}
): Promise<string> => {
    const datapage = await renderDatapageIfApplicable(grapher, false, knex, {
        imageMetadataDictionary,
        assetMap,
    })
    if (datapage) return datapage
    return renderGrapherPage(grapher, knex)
}

export async function renderDataPageV2(
    {
        variableId,
        variableMetadata,
        isPreviewing,
        useIndicatorGrapherConfigs,
        pageGrapher,
        imageMetadataDictionary = {},
        assetMap,
    }: {
        variableId: number
        variableMetadata: OwidVariableWithSource
        isPreviewing: boolean
        useIndicatorGrapherConfigs: boolean
        pageGrapher?: GrapherInterface
        imageMetadataDictionary?: Record<string, ImageMetadata>
        assetMap?: AssetMap
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

    const faqDocIds = compact(
        uniq(variableMetadata.presentation?.faqs?.map((faq) => faq.gdocId))
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
    const datapageData = await getDatapageDataV2(
        variableMetadata,
        grapher ?? {}
    )

    const firstTopicTag = datapageData.topicTagsLinks?.[0]
    datapageData.primaryTopic = await getPrimaryTopic(knex, firstTopicTag)

    // Get the charts this variable is being used in (aka "related charts")
    // and exclude the current chart to avoid duplicates
    datapageData.allCharts = await getRelatedChartsForVariable(
        knex,
        variableId,
        grapher && "id" in grapher ? [grapher.id as number] : []
    )

    datapageData.relatedResearch =
        await getRelatedResearchAndWritingForVariables(knex, [variableId])

    const relatedResearchFilenames = datapageData.relatedResearch
        .map((r) => r.imageUrl)
        .filter((f): f is string => !!f)

    const imageMetadata = lodash.pick(
        imageMetadataDictionary,
        uniq(relatedResearchFilenames)
    )

    const tagToSlugMap = await getTagToSlugMap(knex)

    return renderToHtmlPage(
        <DataPageV2
            grapher={grapher}
            datapageData={datapageData}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
            isPreviewing={isPreviewing}
            imageMetadata={imageMetadata}
            faqEntries={faqEntries}
            tagToSlugMap={tagToSlugMap}
            assetMap={assetMap}
        />
    )
}

/**
 *
 * Similar to renderDataPageOrGrapherPage(), but for admin previews
 */
export const renderPreviewDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const datapage = await renderDatapageIfApplicable(grapher, true, knex)
    if (datapage) return datapage

    return renderGrapherPage(grapher, knex)
}

const renderGrapherPage = async (
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction
) => {
    const postSlug = urlToSlug(grapher.originUrl || "") as string | undefined
    // TODO: update this to use gdocs posts
    const postId = postSlug
        ? await getPostIdFromSlug(knex, postSlug)
        : undefined
    const relatedCharts = postId
        ? await getPostRelatedCharts(knex, postId)
        : undefined
    const relatedArticles = grapher.id
        ? await getRelatedArticles(knex, grapher.id)
        : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

export const bakeSingleGrapherPageForArchival = async (
    bakedSiteDir: string,
    grapher: GrapherInterface,
    knex: db.KnexReadonlyTransaction,
    {
        imageMetadataDictionary,
        assetMap,
    }: {
        imageMetadataDictionary?: Record<string, DbEnrichedImage>
        assetMap?: AssetMap
    } = {}
) => {
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPath,
        await renderDataPageOrGrapherPage(grapher, knex, {
            imageMetadataDictionary,
            assetMap,
        })
    )
    console.log(outPath)
}

const bakeGrapherPage = async (
    bakedSiteDir: string,
    imageMetadataDictionary: Record<string, DbEnrichedImage>,
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
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(
        outPath,
        await renderDataPageOrGrapherPage(
            grapher,
            knex,
            imageMetadataDictionary
        )
    )
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
    imageMetadataDictionary: Record<string, DbEnrichedImage>
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

    await bakeGrapherPage(
        args.bakedSiteDir,
        args.imageMetadataDictionary,
        grapher,
        knex
    )
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

    // Prefetch imageMetadata instead of each grapher page fetching
    // individually. imageMetadata is used by the google docs powering rich
    // text (including images) in data pages.
    const imageMetadataDictionary = await getAllImages(knex).then((images) =>
        keyBy(images, "filename")
    )

    const jobs: BakeSingleGrapherChartArguments[] = chartsToBake.map((row) => ({
        id: row.id,
        config: row.config,
        bakedSiteDir: bakedSiteDir,
        slug: row.slug,
        imageMetadataDictionary,
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
