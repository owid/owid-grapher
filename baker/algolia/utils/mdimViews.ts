import * as _ from "lodash-es"
import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    getUniqueNamesFromTagHierarchies,
    multiDimDimensionsToViewId,
    MultiDimXChartConfigsTableName,
    parseChartConfig,
    queryParamsToStr,
} from "@ourworldindata/utils"
import * as db from "../../../db/db.js"
import { getAllPublishedMultiDimDataPages } from "../../../db/model/MultiDimDataPage.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    ChartRecord,
    ChartRecordType,
} from "../../../site/search/searchTypes.js"
import {
    getRelevantVariableIds,
    getRelevantVariableMetadata,
} from "../../MultiDimBaker.js"
import { GrapherState } from "@ourworldindata/grapher"

async function getChartConfigsByIds(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
) {
    const rows = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("id", "full")
        .whereIn("id", ids)
    return new Map(rows.map((row) => [row.id, parseChartConfig(row.full)]))
}

async function getMultiDimXChartConfigIdMap(trx: db.KnexReadonlyTransaction) {
    const rows = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    ).select("id", "multiDimId", "viewId")
    return new Map(
        rows.map((row) => [`${row.multiDimId}-${row.viewId}`, row.id])
    )
}

async function getRecords(
    trx: db.KnexReadonlyTransaction,
    multiDim: DbEnrichedMultiDimDataPage,
    tags: string[],
    pageviews: Record<string, { views_7d: number }>
) {
    const { slug } = multiDim
    console.log(
        `Creating ${multiDim.config.views.length} records for mdim ${slug}`
    )
    const multiDimXChartConfigIdMap = await getMultiDimXChartConfigIdMap(trx)
    const chartConfigs = await getChartConfigsByIds(
        trx,
        multiDim.config.views.map((view) => view.fullConfigId)
    )
    const relevantVariableIds = getRelevantVariableIds(multiDim.config)
    const relevantVariableMetadata =
        await getRelevantVariableMetadata(relevantVariableIds)
    return multiDim.config.views.map((view) => {
        const viewId = multiDimDimensionsToViewId(view.dimensions)
        const id = multiDimXChartConfigIdMap.get(`${multiDim.id}-${viewId}`)
        if (!id) {
            throw new Error(
                `MultiDimXChartConfig not found multiDimId=${multiDim.id} viewId=${viewId}`
            )
        }
        const chartConfig = chartConfigs.get(view.fullConfigId)
        if (!chartConfig) {
            throw new Error(
                `MultiDim view chart config not found id=${multiDim.id} ` +
                    `viewId=${viewId} chartConfigId=${view.fullConfigId}`
            )
        }
        const grapherState = new GrapherState(chartConfig)
        const queryStr = queryParamsToStr(view.dimensions)
        const variableId = view.indicators.y[0].id
        const metadata = _.merge(
            relevantVariableMetadata[variableId],
            multiDim.config.metadata,
            view.metadata
        )
        const title =
            metadata.presentation?.titlePublic ||
            chartConfig.title ||
            metadata.display?.name ||
            metadata.name ||
            ""
        const subtitle = metadata.descriptionShort || chartConfig.subtitle || ""
        const availableEntities = metadata.dimensions.entities.values
            .map((entity) => entity.name)
            .filter(Boolean)
        const views_7d = pageviews[`/grapher/${slug}`]?.views_7d ?? 0
        const score = views_7d * 10 - title.length
        return {
            type: ChartRecordType.MultiDimView,
            objectID: `mdim-view-${id}`,
            id: `mdim/${slug}${queryStr}`,
            chartId: -1,
            slug,
            queryParams: queryStr,
            title,
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
            numRelatedArticles: 0,
            views_7d,
            score,
            isIncomeGroupSpecificFM: false,
        } as ChartRecord
    })
}

async function getMultiDimDataPagesWithInheritedTags(
    trx: db.KnexReadonlyTransaction
) {
    const multiDims = await getAllPublishedMultiDimDataPages(trx)
    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(trx)

    const result = []
    for (const multiDim of multiDims) {
        const tags = multiDim.config.topicTags ?? []
        if (tags.length === 0) {
            await logErrorAndMaybeCaptureInSentry(
                new Error(`MultiDim "${multiDim.slug}" has no tags.`)
            )
        }

        const topicTags = getUniqueNamesFromTagHierarchies(
            tags,
            topicHierarchiesByChildName
        )

        result.push({ multiDim, tags: topicTags })
    }

    return result
}

export async function getMdimViewRecords(trx: db.KnexReadonlyTransaction) {
    console.log("Getting mdim view records")
    const multiDimsWithTags = await getMultiDimDataPagesWithInheritedTags(trx)
    const pageviews = await getAnalyticsPageviewsByUrlObj(trx)
    const records = await Promise.all(
        multiDimsWithTags.map(({ multiDim, tags }) =>
            getRecords(trx, multiDim, tags, pageviews)
        )
    )
    return records.flat()
}
