import * as _ from "lodash-es"
import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    getUniqueNamesFromTagHierarchies,
    merge,
    dimensionsToViewId,
    MultiDimXChartConfigsTableName,
    parseChartConfig,
} from "@ourworldindata/utils"
import { toPlaintext } from "@ourworldindata/components"
import * as db from "../../../db/db.js"
import { getAllPublishedMultiDimDataPages } from "../../../db/model/MultiDimDataPage.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import { ChartRecord, ChartRecordType } from "@ourworldindata/types"
import {
    getRelevantVariableIds,
    getRelevantVariableMetadata,
} from "../../MultiDimBaker.js"
import { GrapherState } from "@ourworldindata/grapher"
import {
    maybeAddChangeInPrefix,
    parseJsonStringArray,
    uniqNonEmptyStrings,
} from "./shared.js"
import { getMultiDimRedirectTargets } from "../../../db/model/MultiDimRedirects.js"
import { getMaxViews7d, PageviewsByUrl } from "./pageviews.js"
import { DatasetDimensionsForVariable } from "./types.js"

// Published multi-dim must have a slug.
type PublishedMultiDimWithSlug = DbEnrichedMultiDimDataPage & { slug: string }
type RedirectSourcesByTarget = Map<string, string[]>
type RedirectSourcesBySlug = Map<string, string[]>

function getRedirectKey(slug: string, queryStr?: string): string {
    return queryStr ? `${slug}?${queryStr}` : slug
}

function dimensionsToSortedQueryStr(
    dimensions: Record<string, string>
): string {
    const sortedDimensions = Object.entries(dimensions).sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB)
    )
    const params = new URLSearchParams()
    for (const [dimension, choice] of sortedDimensions) {
        params.set(dimension, choice)
    }
    return params.toString()
}

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
    pageviews: PageviewsByUrl,
    redirectSourcesByTarget: RedirectSourcesByTarget,
    redirectSourcesBySlug: RedirectSourcesBySlug
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
    const datasetDimensionsByVariableId =
        await getDatasetDimensionsByVariableIds(trx, [...relevantVariableIds])
    return multiDim.config.views.map((view) => {
        const viewId = dimensionsToViewId(view.dimensions)
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
        const subtitle = toPlaintext(
            metadata.descriptionShort || chartConfig.subtitle || ""
        )
        const availableEntities = metadata.dimensions.entities.values
            .map((entity) => entity.name)
            .filter(Boolean)
        const redirectSources = [
            ...(redirectSourcesBySlug.get(slug) ?? []),
            ...(redirectSourcesByTarget.get(getRedirectKey(slug, queryStr)) ??
                []),
        ]
        const views_7d = getMaxViews7d(pageviews, [
            `/grapher/${slug}`,
            ...redirectSources,
        ])
        const score = views_7d * 10 - title.length

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
            id: `mdim/${slug}${queryStr}`,
            chartId: -1,
            chartConfigId: view.fullConfigId,
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
            datasetNamespaces,
            datasetVersions,
            datasetProducts,
            datasetProducers,
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
            topicHierarchiesByChildName
        )

        result.push({ multiDim: multiDimWithSlug, tags: topicTags })
    }

    return result
}

export async function getMdimViewRecords(trx: db.KnexReadonlyTransaction) {
    console.log("Getting mdim view records")
    const multiDimsWithTags = await getMultiDimDataPagesWithInheritedTags(trx)
    const pageviews = await getAnalyticsPageviewsByUrlObj(trx)
    const [grapherRedirects, explorerRedirects] = await Promise.all([
        getMultiDimRedirectTargets(trx, undefined, "/grapher/"),
        getMultiDimRedirectTargets(trx, undefined, "/explorers/"),
    ])
    const redirectSourcesByTarget = new Map<string, string[]>()
    const redirectSourcesBySlug = new Map<string, string[]>()
    for (const [sourceSlug, target] of grapherRedirects) {
        const sourcePath = `/grapher/${sourceSlug}`
        if (target.queryStr) {
            const sources = redirectSourcesByTarget.get(
                getRedirectKey(target.targetSlug, target.queryStr)
            )
            if (sources) sources.push(sourcePath)
            else
                redirectSourcesByTarget.set(
                    getRedirectKey(target.targetSlug, target.queryStr),
                    [sourcePath]
                )
        } else {
            const sources = redirectSourcesBySlug.get(target.targetSlug)
            if (sources) sources.push(sourcePath)
            else redirectSourcesBySlug.set(target.targetSlug, [sourcePath])
        }
    }
    for (const [sourceSlug, target] of explorerRedirects) {
        const sourcePath = `/explorers/${sourceSlug}`
        if (target.queryStr) {
            const sources = redirectSourcesByTarget.get(
                getRedirectKey(target.targetSlug, target.queryStr)
            )
            if (sources) sources.push(sourcePath)
            else
                redirectSourcesByTarget.set(
                    getRedirectKey(target.targetSlug, target.queryStr),
                    [sourcePath]
                )
        } else {
            const sources = redirectSourcesBySlug.get(target.targetSlug)
            if (sources) sources.push(sourcePath)
            else redirectSourcesBySlug.set(target.targetSlug, [sourcePath])
        }
    }
    const records = await Promise.all(
        multiDimsWithTags.map(({ multiDim, tags }) =>
            getRecords(
                trx,
                multiDim,
                tags,
                pageviews,
                redirectSourcesByTarget,
                redirectSourcesBySlug
            )
        )
    )
    return records.flat()
}
