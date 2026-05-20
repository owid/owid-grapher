import * as _ from "lodash-es"
import {
    ChartConfigsTableName,
    DbEnrichedMultiDimDataPage,
    DbPlainMultiDimXChartConfig,
    DbRawChartConfig,
    getUniqueNamesFromTagHierarchies,
    merge,
    dimensionsToViewId,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    MultiDimXChartConfigsTableName,
    parseChartConfig,
} from "@ourworldindata/utils"
import { toPlaintext } from "@ourworldindata/components"
import * as db from "../../../db/db.js"
import { getAllPublishedMultiDimDataPages } from "../../../db/model/MultiDimDataPage.js"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    ChartRecord,
    ChartRecordType,
    ContentGraphLinkType,
    IndexingContext,
} from "@ourworldindata/types"
import {
    createMultiDimIndexingContext,
    MultiDimRedirectWithLookupKey,
} from "./context.js"
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
    views: Map<string, number>,
    redirects: MultiDimRedirectWithLookupKey[]
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
    const linksFromGdocs = await getPublishedLinksTo(
        trx,
        [slug],
        ContentGraphLinkType.Grapher
    )
    // Attribute each link to the specific multi-dim view it points to based
    // on the dimension params in its queryString. Links without dimension
    // params (or with params that don't match any dimension) resolve to the
    // default view.
    const mdimConfig = MultiDimDataPageConfig.fromObject(multiDim.config)
    const defaultViewDimensions = mdimConfig.filterToAvailableChoices(
        {}
    ).selectedChoices
    const defaultViewQueryStr = dimensionsToSortedQueryStr(
        defaultViewDimensions
    )
    const numRelatedArticlesByViewId = new Map<string, number>()
    for (const link of linksFromGdocs) {
        const searchParams = new URLSearchParams(link.queryString ?? "")
        const dimensionChoices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            mdimConfig
        )
        const resolvedChoices =
            mdimConfig.filterToAvailableChoices(
                dimensionChoices
            ).selectedChoices
        const viewId = dimensionsToViewId(resolvedChoices)
        numRelatedArticlesByViewId.set(
            viewId,
            (numRelatedArticlesByViewId.get(viewId) ?? 0) + 1
        )
    }
    // Bucket grapher/explorer sources that now redirect into this mdim by the
    // target view's queryStr, so each view can pick up its own predecessors. A
    // redirect without a queryStr targets the mdim's default view.
    const predecessorsByQueryStr = new Map<
        string,
        MultiDimRedirectWithLookupKey[]
    >()
    for (const redirect of redirects) {
        const key = redirect.targetQueryStr ?? defaultViewQueryStr
        const list = predecessorsByQueryStr.get(key)
        if (list) list.push(redirect)
        else predecessorsByQueryStr.set(key, [redirect])
    }
    return multiDim.config.views.map((view) => {
        const viewId = dimensionsToViewId(view.dimensions)
        const viewNumRelatedArticles =
            numRelatedArticlesByViewId.get(viewId) ?? 0
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
        const containerTitle = multiDim.config.title.title
        const subtitle = toPlaintext(
            metadata.descriptionShort || chartConfig.subtitle || ""
        )
        const availableEntities = metadata.dimensions.entities.values
            .map((entity) => entity.name)
            .filter(Boolean)
        // Keyed by config ID so we don't have to worry about slug renames/redirects
        const ownViews_7d = views.get(view.fullConfigId) ?? 0
        // Inherit views_7d from grapher charts or explorers that now redirect
        // to this view. Math.max (not sum) avoids double-counting traffic
        // during the redirect's first week; after ~7 days the predecessor's
        // count decays and the view's own count takes over. Explorer
        // predecessors contribute their default-view's views_7d (the closest
        // pre-redirect signal we can attribute to this mdim view).
        const predecessors = predecessorsByQueryStr.get(queryStr) ?? []
        const views_7d = predecessors.reduce(
            (max, pred) =>
                pred.lookupKey
                    ? Math.max(max, views.get(pred.lookupKey) ?? 0)
                    : max,
            ownViews_7d
        )
        const score = computeRecordScore(
            viewNumRelatedArticles,
            views_7d,
            title.length
        )

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

export async function getMdimViewRecords(
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
    ).filter(
        (m) =>
            // temp test
            m.multiDim.slug === "academic-performance"
        // id === undefined || m.multiDim.id === id
    )

    const records = await pMap(
        multiDimsWithTags,
        ({ multiDim, tags }) =>
            getRecords(
                trx,
                multiDim,
                tags,
                context.chartViews,
                context.redirectsByMdimSlug.get(multiDim.slug) ?? []
            ),
        { concurrency: 10 }
    )
    return records.flat()
}
