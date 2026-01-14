import * as db from "../../db/db.js"
import {
    makeCalloutGrapherStateKey,
    searchParamsToMultiDimView,
    Url,
} from "@ourworldindata/utils"
import { groupBy, partition, pickBy } from "remeda"
import { getChartConfigById, mapSlugsToIds } from "../../db/model/Chart.js"
import {
    prepareCalloutChart,
    prepareExplorerCalloutChart,
} from "../../db/model/Gdoc/dataCallouts.js"
import { getMultiDimDataPageBySlug } from "../../db/model/MultiDimDataPage.js"
import { getChartConfigByUuid } from "../../db/model/ChartConfigs.js"
import {
    constructGrapherValuesJson,
    getEntityNamesParam,
    GrapherState,
    isValuesJsonValid,
} from "@ourworldindata/grapher"
import {
    ChartCalloutValuesTableName,
    DbInsertChartCalloutValue,
} from "@ourworldindata/types"

async function main(): Promise<void> {
    await db.knexReadWriteTransaction(async (trx) => {
        const [grapherUrlsByCalloutKey, explorerUrlsByCalloutKey] = await db
            .getCalloutUrlsForPublishedGdocs(trx)
            .then((urls) =>
                partition(urls, (url) => url.startsWith("/grapher/")).map(
                    (urls) =>
                        groupBy(urls, (url) => makeCalloutGrapherStateKey(url))
                )
            )

        const grapherStatesByCalloutKey: Record<
            string,
            GrapherState | undefined
        > = {}

        // Prepare graphers and multi-dims
        const slugToIdMap = await mapSlugsToIds(trx)
        for (const calloutKey of Object.keys(grapherUrlsByCalloutKey)) {
            const url = Url.fromURL(calloutKey)
            const chartId = slugToIdMap[url.slug as string]
            // It's a grapher
            if (chartId) {
                const chartConfig = await getChartConfigById(trx, chartId)
                if (chartConfig) {
                    const grapherState = await prepareCalloutChart(
                        chartConfig.config
                    )
                    // TODO: filter out entities that aren't available from callout urls
                    if (grapherState) {
                        grapherStatesByCalloutKey[calloutKey] = grapherState
                    }
                }
            } else {
                // It's a multi-dim
                const multiDimPage = await getMultiDimDataPageBySlug(
                    trx,
                    url.slug as string
                )
                if (multiDimPage) {
                    const searchParams = new URLSearchParams(url.queryStr)
                    const view = searchParamsToMultiDimView(
                        multiDimPage.config,
                        searchParams
                    )
                    const chartConfig = await getChartConfigByUuid(
                        trx,
                        view.fullConfigId
                    )
                    if (chartConfig) {
                        const grapherState =
                            await prepareCalloutChart(chartConfig)
                        if (grapherState) {
                            grapherStatesByCalloutKey[calloutKey] = grapherState
                        }
                    }
                }
            }
        }

        // Prepare explorers
        for (const calloutKey of Object.keys(explorerUrlsByCalloutKey)) {
            const url = Url.fromURL(calloutKey)
            const queryParams: Record<string, string> = {}
            const grapherState = await prepareExplorerCalloutChart(
                trx,
                url.slug!,
                queryParams,
                url.queryStr
            )
            if (grapherState) {
                grapherStatesByCalloutKey[calloutKey] = grapherState
            }
        }

        const valuesToUpsert: Record<string, DbInsertChartCalloutValue> = {}
        const invalidValuesSummary: Record<
            string,
            { invalid: number; total: number }
        > = {}

        // Generate values for graphers, multi-dims, and explorers
        for (const [calloutKey, urls] of Object.entries({
            ...grapherUrlsByCalloutKey,
            ...explorerUrlsByCalloutKey,
        })) {
            const grapherState = grapherStatesByCalloutKey[calloutKey]
            if (!grapherState) {
                console.warn(`No grapher state for callout key: ${calloutKey}`)
                continue
            }

            invalidValuesSummary[calloutKey] = {
                invalid: 0,
                total: 0,
            }

            for (const urlString of urls) {
                const url = Url.fromURL(urlString)
                grapherState.populateFromQueryParams(url.queryParams)
                const entityNames = getEntityNamesParam(url.queryParams.country)
                if (!entityNames) {
                    console.warn(
                        `No entity names for callout URL: ${urlString}`
                    )
                    continue
                }
                // TODO: how to make sure that the first entity is the right one?
                // Could be coming from a callout that was specified like
                // https://ourworldindata.org/grapher/some-slug?country=USA~$entityCode
                const entityName = entityNames[0]
                const values = constructGrapherValuesJson(
                    grapherState,
                    entityName,
                    url.queryParams.time
                )
                invalidValuesSummary[calloutKey].total += 1
                if (!isValuesJsonValid(values)) {
                    invalidValuesSummary[calloutKey].invalid += 1
                    continue
                }
                valuesToUpsert[urlString] = {
                    id: urlString,
                    value: values,
                }
            }
        }

        // Upsert all values
        for (const calloutValue of Object.values(valuesToUpsert)) {
            await trx
                .table(ChartCalloutValuesTableName)
                .insert(calloutValue)
                .onConflict("id")
                .merge()
        }

        const calloutSummary = pickBy(
            invalidValuesSummary,
            ({ invalid }) => invalid > 0
        )
        if (Object.keys(calloutSummary).length > 0) {
            console.warn("Skipped invalid callout values:")
            for (const [calloutKey, { invalid, total }] of Object.entries(
                calloutSummary
            )) {
                console.warn(
                    `${calloutKey}: ${invalid}/${total} countries had invalid values`
                )
            }
        }
    })
}

main()
    .catch((error) => {
        console.error(`Error refreshing ${ChartCalloutValuesTableName}:`, error)
        process.exit(1)
    })
    .finally(async () => {
        process.exit(0)
    })
