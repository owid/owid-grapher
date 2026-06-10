import * as _ from "lodash-es"
import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbRawChartConfig,
    getUniqueNamesFromTagHierarchies,
    merge,
    dimensionsToViewId,
    MultiDimDataPageConfig,
    parseChartConfig,
} from "@ourworldindata/utils"
import { toPlaintext } from "@ourworldindata/components"
import * as db from "../../../db/db.js"
import { getAllPublishedMultiDimDataPages } from "../../../db/model/MultiDimDataPage.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    ChartRecord,
    ChartRecordType,
    ChartViewsMap,
    ContentGraphLinkType,
    IndexingContext,
} from "@ourworldindata/types"
import { createMultiDimIndexingContext } from "./context.js"
import {
    attributeLinksToViewIds,
    dimensionsToSortedQueryStr,
} from "./mdimViewsLogic.js"
import {
    getRelevantVariableIds,
    getRelevantVariableMetadata,
} from "../../MultiDimBaker.js"
import { GrapherState } from "@ourworldindata/grapher"
import {
    computeRecordScore,
    maybeAddChangeInPrefix,
    parseJsonStringArray,
    uniqNonEmptyStrings,
} from "./shared.js"
import { getPublishedLinksTo } from "../../../db/model/Link.js"
import { DatasetDimensionsForVariable } from "./types.js"
import pMap from "p-map"

// Published multi-dim must have a slug.
type PublishedMultiDimWithSlug = DbEnrichedMultiDimDataPage & { slug: string }

async function getChartConfigsByIds(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
) {
    const rows = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "full")
        .whereIn("id", ids)
    return new Map(rows.map((row) => [row.id, parseChartConfig(row.full)]))
}

async function getDatasetDimensionsByVariableIds(
    trx: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<Map<number, DatasetDimensionsForVariable>> {
    if (variableIds.length === 0) return new Map()

    const rows = await trx("dataset_dimensions_by_variable as ddv")
        .select(
            "ddv.variableId",
            "ddv.datasetNamespace",
            "ddv.datasetVersion",
            "ddv.datasetProduct",
            "ddv.datasetProducers"
        )
        .whereIn("ddv.variableId", variableIds)

    return new Map(
        rows.map((row) => [
            row.variableId as number,
            {
                datasetNamespace: row.datasetNamespace,
                datasetVersion: row.datasetVersion,
                datasetProduct: row.datasetProduct,
                datasetProducers: parseJsonStringArray(row.datasetProducers),
            },
        ])
    )
}

async function getRecords(
    trx: db.KnexReadonlyTransaction,
    multiDim: PublishedMultiDimWithSlug,
    tags: string[],
    chartViewsMap: ChartViewsMap,
    predecessorMaxChartViewsByMultiDimViewConfigId: Map<string, number>,
    multiDimXChartConfigIdMap: Map<string, number>
) {
    const { slug } = multiDim
    console.log(
        `Creating ${multiDim.config.views.length} records for mdim ${slug}`
    )
    const chartConfigs = await getChartConfigsByIds(
        trx,
        multiDim.config.views.map((view) => view.fullConfigId)
    )
    const relevantVariableIds = getRelevantVariableIds(multiDim.config)
    const relevantVariableMetadata =
        await getRelevantVariableMetadata(relevantVariableIds)
    const datasetDimensionsByVariableId =
        await getDatasetDimensionsByVariableIds(trx, [...relevantVariableIds])
    const linksFromGdocs = await getPublishedLinksTo(
        trx,
        [slug],
        ContentGraphLinkType.Grapher
    )
    const multiDimConfig = MultiDimDataPageConfig.fromObject(multiDim.config)
    const numRelatedArticlesByViewId = attributeLinksToViewIds(
        linksFromGdocs,
        multiDimConfig
    )

    return multiDim.config.views.flatMap((view) => {
        const viewId = dimensionsToViewId(view.dimensions)
        const viewNumRelatedArticles =
            numRelatedArticlesByViewId.get(viewId) ?? 0
        const id = multiDimXChartConfigIdMap.get(`${multiDim.id}-${viewId}`)
        if (!id) {
            console.warn(
                `Skipping mdim view: MultiDimXChartConfig not found multiDimId=${multiDim.id} viewId=${viewId}`
            )
            return []
        }
        const chartConfig = chartConfigs.get(view.fullConfigId)
        if (!chartConfig) {
            console.warn(
                `Skipping mdim view: chart config not found id=${multiDim.id} ` +
                    `viewId=${viewId} chartConfigId=${view.fullConfigId}`
            )
            return []
        }
        const grapherState = new GrapherState(chartConfig)
        const queryStr = dimensionsToSortedQueryStr(view.dimensions)
        const variableId = view.indicators.y[0].id
        const metadata = merge(
            relevantVariableMetadata[variableId],
            multiDim.config.metadata ?? {},
            view.metadata ?? {}
        )
        const title = maybeAddChangeInPrefix(
            metadata.presentation?.titlePublic ||
                chartConfig.title ||
                metadata.display?.name ||
                metadata.name ||
                "",
            grapherState.shouldAddChangeInPrefixToTitle
        )
        const containerTitle = multiDim.config.title.title
        const subtitle = toPlaintext(
            metadata.descriptionShort || chartConfig.subtitle || ""
        )
        const availableEntities = metadata.dimensions.entities.values
            .map((entity) => entity.name)
            .filter(Boolean)

        const views_7d = Math.max(
            chartViewsMap.byConfigId.get(view.fullConfigId) ?? 0,
            predecessorMaxChartViewsByMultiDimViewConfigId.get(
                view.fullConfigId
            ) ?? 0
        )
        const score = computeRecordScore(viewNumRelatedArticles, views_7d)

        const datasetDimensions = view.indicators.y
            .map((ind) => datasetDimensionsByVariableId.get(ind.id))
            .filter(Boolean)
        const datasetNamespaces = uniqNonEmptyStrings(
            datasetDimensions.map((dataset) => dataset?.datasetNamespace)
        )
        const datasetVersions = uniqNonEmptyStrings(
            datasetDimensions.map((dataset) => dataset?.datasetVersion)
        )
        const datasetProducts = uniqNonEmptyStrings(
            datasetDimensions.map((dataset) => dataset?.datasetProduct)
        )
        const datasetProducers = uniqNonEmptyStrings(
            datasetDimensions.map((dataset) => dataset?.datasetProducers)
        )

        return {
            type: ChartRecordType.MultiDimView,
            objectID: `mdim-view-${id}`,
            id: `mdim/${slug}${queryStr ? `?${queryStr}` : ""}`,
            chartId: -1,
            chartConfigId: view.fullConfigId,
            slug,
            queryParams: queryStr ? `?${queryStr}` : "",
            title,
            containerTitle,
            subtitle,
            variantName: chartConfig.variantName,
            availableTabs: grapherState.availableTabs,
            keyChartForTags: [],
            tags,
            availableEntities,
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            numDimensions: chartConfig.dimensions?.length ?? 0,
            titleLength: title.length,
            numRelatedArticles: viewNumRelatedArticles,
            views_7d,
            views_14d: 0,
            views_365d: 0,
            score,
            isIncomeGroupSpecificFM: false,
            isFM: false,
            datasetNamespaces,
            datasetVersions,
            datasetProducts,
            datasetProducers,
        } as ChartRecord
    })
}

async function getMultiDimDataPagesWithInheritedTags(
    trx: db.KnexReadonlyTransaction,
    topicHierarchies: IndexingContext["topicHierarchies"]
) {
    const multiDims = await getAllPublishedMultiDimDataPages(trx)

    const result = []
    for (const multiDim of multiDims) {
        if (!multiDim.slug) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(`MultiDim with id ${multiDim.id} is missing a slug.`)
            )
            continue
        }
        const multiDimWithSlug = multiDim as PublishedMultiDimWithSlug
        const tags = multiDim.config.topicTags ?? []
        if (tags.length === 0) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(`MultiDim "${multiDim.slug}" has no tags.`)
            )
        }

        const topicTags = getUniqueNamesFromTagHierarchies(
            tags,
            topicHierarchies
        )

        result.push({ multiDim: multiDimWithSlug, tags: topicTags })
    }

    return result
}

export async function getMultiDimViewRecords(
    trx: db.KnexReadonlyTransaction,
    options?: {
        id?: number
        baseContext?: IndexingContext
    }
) {
    const { id, baseContext } = options ?? {}

    console.log("Getting mdim view records")

    const context = await createMultiDimIndexingContext(trx, baseContext)

    const multiDimsWithTags = (
        await getMultiDimDataPagesWithInheritedTags(
            trx,
            context.topicHierarchies
        )
    ).filter((m) => id === undefined || m.multiDim.id === id)

    const records = await pMap(
        multiDimsWithTags,
        ({ multiDim, tags }) =>
            getRecords(
                trx,
                multiDim,
                tags,
                context.chartViewsMap,
                context.predecessorMaxChartViewsByMultiDimViewConfigId,
                context.multiDimXChartConfigIdMap
            ),
        { concurrency: 10 }
    )
    return records.flat()
}
