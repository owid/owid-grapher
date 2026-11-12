import * as R from "remeda"
import * as _ from "lodash-es"
import {
    GrapherState,
    prepareEntitiesForPeerSelection,
} from "@ourworldindata/grapher"
import { EntityName, Time } from "@ourworldindata/types"
import { checkIsCountryName } from "@ourworldindata/utils"

/**
 * The dataRange peer picker as it was before f396dff46c (equal-count buckets
 * over each country's value in one exact year), kept for the data range test
 * page only
 */
export async function selectLegacyDataRangePeers({
    grapherState,
    targetCountry,
    targetCount,
}: {
    grapherState: GrapherState
    targetCountry?: EntityName
    targetCount: number
}): Promise<EntityName[]> {
    const dataColumn = grapherState.table.get(grapherState.yColumnSlug)
    if (!dataColumn || dataColumn.isMissing || dataColumn.isEmpty) return []

    const additionalDataLoaderFn = grapherState.additionalDataLoaderFn
    if (!additionalDataLoaderFn) return []

    const entities =
        prepareEntitiesForPeerSelection(grapherState).filter(checkIsCountryName)
    const valuesByEntityAndTime = dataColumn.owidRowByEntityNameAndTime

    const extractValuesAtTime = (time: Time): Map<EntityName, number> => {
        const values = new Map<EntityName, number>()
        for (const entityName of entities) {
            const value = valuesByEntityAndTime
                .get(entityName)
                ?.get(time)?.value
            if (typeof value === "number") values.set(entityName, value)
        }
        return values
    }

    // Search passed the chart's end time with a target; the editor passed none
    const time = targetCountry ? grapherState.endTime : undefined
    const values = extractCandidateValues({
        targetTimes: targetCountry
            ? [...(valuesByEntityAndTime.get(targetCountry)?.keys() ?? [])]
            : undefined,
        time,
        maxTime: dataColumn.maxTime,
        extractValuesAtTime,
    })

    const populationRows = await additionalDataLoaderFn("population")
    const population = new Map(
        populationRows.map((row) => [row.entity, row.value])
    )

    return findDataRangePeers({
        values,
        population,
        targetCount,
        targetCountry,
    })
}

function extractCandidateValues({
    targetTimes,
    time,
    maxTime,
    extractValuesAtTime,
}: {
    /** Times the target country has data for, or undefined without a target */
    targetTimes?: Time[]
    time?: Time
    maxTime: Time
    extractValuesAtTime: (time: Time) => Map<EntityName, number>
}): Map<EntityName, number> {
    if (targetTimes) {
        if (targetTimes.length === 0)
            return extractValuesAtTime(time ?? maxTime)
        if (time === undefined)
            return extractValuesAtTime(_.max(targetTimes) ?? maxTime)
        const resolvedTime = _.max(targetTimes.filter((t) => t <= time)) ?? time
        const values = extractValuesAtTime(resolvedTime)
        if (values.size === 0 && resolvedTime !== maxTime)
            return extractValuesAtTime(maxTime)
        return values
    }

    const targetTime = time ?? maxTime
    const values = extractValuesAtTime(targetTime)
    if (values.size === 0 && targetTime !== maxTime)
        return extractValuesAtTime(maxTime)
    return values
}

function findDataRangePeers({
    values,
    population,
    targetCount,
    targetCountry,
}: {
    values: Map<EntityName, number>
    population: Map<EntityName, number>
    targetCount: number
    targetCountry?: EntityName
}): EntityName[] {
    const sortedData = R.pipe(
        Array.from(values.entries()),
        R.map(([entityName, value]) => ({ entityName, value })),
        R.sortBy((item) => item.value)
    )
    if (sortedData.length === 0) return []

    const buckets = R.chunk(
        sortedData,
        Math.ceil(sortedData.length / targetCount)
    )

    const targetBucketIndex =
        targetCountry !== undefined && values.has(targetCountry)
            ? buckets.findIndex((bucket) =>
                  bucket.some((item) => item.entityName === targetCountry)
              )
            : -1

    const selected = buckets
        .filter((_bucket, bucketIndex) => bucketIndex !== targetBucketIndex)
        .map(
            (bucket) =>
                _.maxBy(bucket, (item) => population.get(item.entityName) ?? 0)
                    ?.entityName
        )
        .filter(R.isDefined)

    return R.unique(selected)
}
