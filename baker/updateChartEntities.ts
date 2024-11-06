/**
 * Updates the charts_x_entities table with the available entities for all published charts.
 * This is useful in search, where we want to be able to filter charts by entities that can be selected.
 * To do this, we need to instantiate a grapher, download its data, and then look at the available entities.
 */

import { Grapher } from "@ourworldindata/grapher"
import {
    ChartsXEntitiesTableName,
    DbPlainChart,
    GrapherInterface,
    GrapherTabOption,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    DbRawChartConfig,
} from "@ourworldindata/types"
import * as db from "../db/db.js"
import pMap from "p-map"
import { mapEntityNamesToEntityIds } from "../db/model/Entity.js"
import { getVariableData } from "../db/model/Variable.js"
import { uniq } from "@ourworldindata/utils"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

const FETCH_CONCURRENCY = 10
const VARIABLES_TO_PREFETCH = 300

let _commonVariablesMap:
    | Map<number, OwidVariableDataMetadataDimensions>
    | undefined = undefined

const _fetchVariablesCounters = { cached: 0, fetched: 0 }

// This is a poor-man's cache for variable data.
// It is unrealistic to cache all variables in memory - at the time of writing, there are about 8000 distinct variables.
// Instead, we pre-fetch the most common variables and cache them in memory.
// These include very common variables: Continents, Population, GDP per capita, etc.
const preFetchCommonVariables = async (
    trx: db.KnexReadonlyTransaction
): Promise<void> => {
    const commonVariables = (await db.knexRaw(
        trx,
        `-- sql
            SELECT variableId, COUNT(variableId) AS useCount
            FROM chart_dimensions cd
            JOIN charts c ON cd.chartId = c.id
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.full ->> "$.isPublished" = "true"
            GROUP BY variableId
            ORDER BY COUNT(variableId) DESC
            LIMIT ??
        `,
        [VARIABLES_TO_PREFETCH]
    )) as { variableId: number; useCount: number }[]

    _commonVariablesMap = new Map(
        await pMap(
            commonVariables,
            async ({ variableId, useCount }) => {
                const variableData = await getVariableData(variableId)
                console.log(
                    `Pre-fetched variable ${variableId}: ${variableData.metadata.name} (${useCount} uses)`
                )
                return [variableId, variableData]
            },
            { concurrency: FETCH_CONCURRENCY }
        )
    )
}

const getVariableDataUsingCache = async (
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> => {
    if (_commonVariablesMap?.has(variableId)) {
        _fetchVariablesCounters.cached++
        return _commonVariablesMap.get(variableId)!
    }

    _fetchVariablesCounters.fetched++
    return getVariableData(variableId)
}

const obtainAvailableEntitiesForGrapherConfig = async (
    grapherConfig: GrapherInterface
) => {
    const grapher = new Grapher({ ...grapherConfig, manuallyProvideData: true })

    // Manually fetch data for grapher, so we can employ caching
    const variableIds = uniq(grapher.dimensions.map((d) => d.variableId))
    const variableData: MultipleOwidVariableDataDimensionsMap = new Map(
        await pMap(variableIds, async (variableId) => [
            variableId,
            await getVariableDataUsingCache(variableId),
        ])
    )
    grapher.receiveOwidData(variableData)

    // If the grapher has a chart tab, then the available entities there are the "most interesting" ones to us
    if (grapher.hasChartTab) {
        grapher.tab = GrapherTabOption.chart

        // If the grapher allows for changing or multi-selecting entities, then let's index all entities the
        // user can choose from. Otherwise, we'll just use the default-selected entities.
        const canChangeEntities =
            grapher.canChangeEntity || grapher.canSelectMultipleEntities

        // In these chart types, an unselected entity is still shown
        const chartTypeShowsUnselectedEntities =
            grapher.isScatter || grapher.isSlopeChart || grapher.isMarimekko

        if (canChangeEntities || chartTypeShowsUnselectedEntities)
            return grapher.tableForSelection.availableEntityNames as string[]
        else return grapher.selectedEntityNames ?? []
    } else if (grapher.hasMapTab) {
        grapher.tab = GrapherTabOption.map
        // On a map tab, tableAfterAuthorTimelineAndActiveChartTransform contains all
        // mappable entities for which data is available
        return grapher.tableAfterAuthorTimelineAndActiveChartTransform
            .availableEntityNames as string[]
    } else return []
}

export const obtainAvailableEntitiesForGraphers = async (
    trx: db.KnexReadonlyTransaction,
    // Optional subset of IDs to restrict data fetching to
    chartIds?: number[]
) => {
    const entityNameToIdMap = await mapEntityNamesToEntityIds(trx)

    const allPublishedGraphers = await db.knexRaw<
        Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["full"] }
    >(
        trx,
        `-- sql
            SELECT c.id, cc.full as config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.full ->> "$.isPublished" = 'true'
            ${chartIds && chartIds.length ? `AND c.id IN (${chartIds.join(",")})` : ""}
        `
    )

    const availableEntitiesByChartId = new Map<
        number,
        {
            availableEntities: string[]
            availableEntityIds: number[]
        }
    >()
    await pMap(
        allPublishedGraphers,
        async (grapher) => {
            const config = JSON.parse(grapher.config) as GrapherInterface
            const availableEntities =
                await obtainAvailableEntitiesForGrapherConfig(config)
            const availableEntityIds = availableEntities.flatMap(
                (entityName) => {
                    const entityId = entityNameToIdMap.get(entityName)
                    if (entityId === undefined) {
                        console.error(
                            `Entity not found for chart ${grapher.id}: "${entityName}"`
                        )
                        return []
                    }
                    return [entityId]
                }
            )
            availableEntitiesByChartId.set(grapher.id, {
                availableEntities,
                availableEntityIds,
            })

            console.log(
                grapher.id,
                config.slug,
                `[${availableEntities.length} entities]`
            )
        },
        { concurrency: FETCH_CONCURRENCY }
    )

    return availableEntitiesByChartId
}

// Obtains available entities for ALL published graphers and updates the charts_x_entities table
// (by clearing it out and re-inserting all entries).
const updateAvailableEntitiesForAllGraphers = async (
    trx: db.KnexReadWriteTransaction
) => {
    console.log(
        `--- Pre-fetching ${VARIABLES_TO_PREFETCH} most common variables ---`
    )
    await preFetchCommonVariables(trx)

    console.log(
        "--- Obtaining available entity ids for all published graphers ---"
    )
    const availableEntitiesByChartId =
        await obtainAvailableEntitiesForGraphers(trx)

    console.log("--- Fetch stats ---")
    console.log(
        `Fetched ${_fetchVariablesCounters.fetched} variables; cached ${_fetchVariablesCounters.cached} variable loads using ${VARIABLES_TO_PREFETCH} pre-fetched variables`
    )

    console.log("--- Updating charts_x_entities ---")

    await trx.delete().from(ChartsXEntitiesTableName) // clears out the WHOLE table
    for (const [
        chartId,
        { availableEntityIds },
    ] of availableEntitiesByChartId) {
        const rows = availableEntityIds.map((entityId) => ({
            chartId,
            entityId,
        }))
        if (rows.length) await trx(ChartsXEntitiesTableName).insert(rows)
    }

    console.log("--- ✅ Done ---")
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

if (require.main === module) {
    void yargs(hideBin(process.argv))
        .command(
            "$0",
            "Update charts_x_entities table",
            (yargs) => {
                yargs
                    .option("all", {
                        boolean: true,
                        default: false,
                        description:
                            "Update available entities for all published charts",
                    })
                    .check(({ all }) => {
                        if (!all) {
                            console.error(
                                "Please use --all. Currently, no other mode is supported."
                            )
                            return false
                        }
                        return true
                    })
            },
            async ({ all }) => {
                if (all)
                    await db.knexReadWriteTransaction(
                        updateAvailableEntitiesForAllGraphers,
                        db.TransactionCloseMode.Close
                    )
            }
        )
        .help()
        .strict().argv
}
