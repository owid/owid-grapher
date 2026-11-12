import * as R from "remeda"
import {
    AdditionalGrapherDataFetchFn,
    EntityName,
    NumericCatalogKey,
    PeerCountryStrategy,
    Time,
    TimeRange,
} from "@ourworldindata/types"
import {
    checkIsAggregate,
    checkIsCountry,
    checkIsCountryName,
    checkIsIncomeGroup,
    checkIsOwidContinent,
    excludeUndefined,
    getContinentForCountry,
    getParentRegions,
    getRegionByName,
    getTimeInterval,
    isSubYearly,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { bisectRight, cumsum, quantile } from "d3-array"
import { scaleQuantize } from "d3-scale"
import { WORLD_ENTITY_NAME } from "./GrapherConstants.js"
import { match } from "ts-pattern"
import type { GrapherState } from "./GrapherState.js"

const LATEST_VALUE_WINDOW_MAX_YEARS = 10
const LATEST_VALUE_WINDOW_MIN_COUNTRIES = 10
const LATEST_VALUE_WINDOW_COVERAGE = 0.8

interface SelectDefaultEntitiesAsPeersParams {
    defaultSelection: EntityName[]
}

interface SelectParentRegionsAsPeersParams {
    targetCountry: EntityName
    availableEntities: EntityName[]
}

interface SelectByClosestValueParams {
    targetCountry: EntityName
    availableEntities: EntityName[]
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    targetCount?: number
}

interface SelectByDataRangeParams {
    targetCountry?: EntityName
    availableEntities: EntityName[]
    dataColumn: CoreColumn
    endTime?: Time
    isSingleTimeChart: boolean
    randomize?: boolean
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    targetCount?: number
}

interface SelectNeighborsAsPeersParams {
    targetCountry: EntityName
    availableEntities: EntityName[]
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    targetCount?: number
}

type WithStrategy<T, S extends PeerCountryStrategy> = T & {
    peerCountryStrategy: S
}

type SelectPeerCountriesParams =
    | WithStrategy<
          SelectDefaultEntitiesAsPeersParams,
          PeerCountryStrategy.DefaultSelection
      >
    | WithStrategy<
          SelectParentRegionsAsPeersParams,
          PeerCountryStrategy.ParentRegions
      >
    | WithStrategy<
          SelectByClosestValueParams,
          PeerCountryStrategy.GdpPerCapita | PeerCountryStrategy.Population
      >
    | WithStrategy<SelectByDataRangeParams, PeerCountryStrategy.DataRange>
    | WithStrategy<SelectNeighborsAsPeersParams, PeerCountryStrategy.Neighbors>
    | { peerCountryStrategy: PeerCountryStrategy.None }

export interface LatestValue {
    entityName: EntityName
    value: number
    time: Time
}

interface ValueBin {
    center: number
    members: LatestValue[]
}

/**
 * Selects peer countries for a grapher based on the configured strategy.
 *
 * If targetCountry is provided in options, it will be used directly.
 * Otherwise, the target country is inferred from the grapher's selection,
 * which requires exactly one entity to be selected.
 */
export async function selectPeerCountriesForGrapher(
    grapherState: GrapherState,
    options?: {
        peerCountryStrategy?: PeerCountryStrategy
        targetCountry?: EntityName
    }
): Promise<EntityName[]> {
    // If targetCountry is not explicitly provided, require exactly one entity selected
    if (!options?.targetCountry) {
        if (grapherState.selection.numSelectedEntities !== 1) {
            return []
        }
    }

    const targetCountry =
        options?.targetCountry ?? grapherState.selection.selectedEntityNames[0]
    const defaultSelection = grapherState.authorsVersion.selectedEntityNames

    const availableEntities = prepareEntitiesForPeerSelection(grapherState)
    if (availableEntities.length === 0) return []

    const peerCountryStrategy =
        options?.peerCountryStrategy ?? grapherState.peerCountryStrategy
    if (!peerCountryStrategy) return []

    // Peer country selection only makes sense for countries
    if (!checkIsCountryName(targetCountry)) return []

    const additionalDataLoaderFn = grapherState.additionalDataLoaderFn
    const dataColumn = grapherState.table.get(grapherState.yColumnSlug)

    return selectPeerCountries({
        peerCountryStrategy,
        targetCountry,
        defaultSelection,
        availableEntities,
        additionalDataLoaderFn,
        dataColumn,
        endTime: grapherState.endTime,
        isSingleTimeChart: grapherState.isSingleTimeSelectionActive,
    })
}

/** Selects peer countries based on the specified strategy and target entity */
export async function selectPeerCountries(
    params: SelectPeerCountriesParams
): Promise<EntityName[]> {
    return match(params)
        .with({ peerCountryStrategy: PeerCountryStrategy.None }, () => [])
        .with(
            { peerCountryStrategy: PeerCountryStrategy.DefaultSelection },
            ({ defaultSelection }) => defaultSelection
        )
        .with(
            { peerCountryStrategy: PeerCountryStrategy.ParentRegions },
            (params) => selectParentRegionsAsPeers(params)
        )
        .with(
            { peerCountryStrategy: PeerCountryStrategy.GdpPerCapita },
            async (params) =>
                selectPeerCountriesByClosestValue({
                    catalogKey: "gdp",
                    maxPeerRatio: 1.25,
                    ...params,
                })
        )
        .with(
            { peerCountryStrategy: PeerCountryStrategy.Population },
            async (params) =>
                selectPeerCountriesByClosestValue({
                    catalogKey: "population",
                    maxPeerRatio: 1.5,
                    ...params,
                })
        )
        .with(
            { peerCountryStrategy: PeerCountryStrategy.DataRange },
            async (params) => selectPeerCountriesByDataRange(params)
        )
        .with(
            { peerCountryStrategy: PeerCountryStrategy.Neighbors },
            async (params) => selectNeighborsAsPeers(params)
        )
        .exhaustive()
}

function isDataLoaderAvailable(
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
): additionalDataLoaderFn is AdditionalGrapherDataFetchFn {
    if (!additionalDataLoaderFn) {
        console.warn(
            `additionalDataLoaderFn not available for peer selection. Not selecting any peer countries.`
        )
        return false
    }
    return true
}

function isDataColumnAvailable(
    dataColumn?: CoreColumn
): dataColumn is CoreColumn {
    if (!dataColumn || dataColumn.isMissing || dataColumn.isEmpty) {
        console.warn(
            `dataColumn not available for peer selection. Not selecting any peer countries.`
        )
        return false
    }
    return true
}

/** Filters entities to only those that have data at all required time points */
function filterEntitiesWithDataAtAllTimes({
    entities,
    dataColumn,
    requiredTimes,
}: {
    entities: EntityName[]
    dataColumn: CoreColumn
    requiredTimes: Time[]
}): EntityName[] {
    if (requiredTimes.length === 0) return entities

    return entities.filter((entityName) => {
        const entityData = dataColumn.owidRowByEntityNameAndTime.get(entityName)
        if (!entityData) return false
        return requiredTimes.every(
            (time) => entityData.get(time)?.value !== undefined
        )
    })
}

/**
 * Prepares entities for peer selection by excluding historical geographic
 * entities and filtering to only those with data at required times
 * (e.g. both start and end times for slope charts).
 */
export function prepareEntitiesForPeerSelection(
    grapherState: GrapherState
): EntityName[] {
    const availableEntities = grapherState.availableEntityNames

    // Exclude historical geographic entities
    const relevantEntities = availableEntities.filter((entityName) => {
        const region = getRegionByName(entityName)
        return !(region && checkIsCountry(region) && region.isHistorical)
    })

    const dataColumn = grapherState.table.get(grapherState.yColumnSlug)
    if (!isDataColumnAvailable(dataColumn)) return relevantEntities

    const requiredTimes = grapherState.isOnSlopeChartTab
        ? excludeUndefined([grapherState.startTime, grapherState.endTime])
        : []

    if (requiredTimes.length === 0) return relevantEntities

    return filterEntitiesWithDataAtAllTimes({
        entities: relevantEntities,
        dataColumn,
        requiredTimes,
    })
}

/**
 * Selects parent aggregate regions (continents, income groups) that the target
 * country belongs to, plus World.
 */
export function selectParentRegionsAsPeers({
    targetCountry,
    availableEntities,
}: SelectParentRegionsAsPeersParams): EntityName[] {
    const region = getRegionByName(targetCountry)

    // Can't determine comparison entities for non-geographical entities
    if (!region) return []

    const availableEntitySet = new Set(availableEntities)
    const peers = new Set<EntityName>()

    // Always include World as a comparison if available
    if (availableEntitySet.has(WORLD_ENTITY_NAME)) peers.add(WORLD_ENTITY_NAME)

    // Get the parent regions of a country (continent, income group, etc.)
    // Example: Germany -> Europe, Europe (WHO), High income countries
    const parentRegions = getParentRegions(region.name)

    const isAvailable = (name: string): boolean => availableEntitySet.has(name)

    // If there is an available income group, include it
    const incomeGroup = parentRegions.find(
        (r) => checkIsIncomeGroup(r) && isAvailable(r.name)
    )
    if (incomeGroup) peers.add(incomeGroup.name)

    // If there is an available OWID continent, include it;
    // otherwise include any other available aggregate region
    const owidContinent = parentRegions.find(
        (r) => checkIsOwidContinent(r) && isAvailable(r.name)
    )
    if (owidContinent) {
        peers.add(owidContinent.name)
    } else {
        const aggregate = parentRegions.find(
            (r) => checkIsAggregate(r) && isAvailable(r.name)
        )
        if (aggregate) peers.add(aggregate.name)
    }

    return Array.from(peers)
}

/** Finds countries with similar values to the target country */
async function selectPeerCountriesByClosestValue({
    targetCountry,
    availableEntities,
    additionalDataLoaderFn,
    catalogKey,
    targetCount = 3,
    maxPeerRatio = 1.5,
}: SelectByClosestValueParams & {
    catalogKey: NumericCatalogKey
    /** Maximum ratio difference allowed */
    maxPeerRatio?: number
}): Promise<EntityName[]> {
    try {
        // Load data
        if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
        const data = await additionalDataLoaderFn(catalogKey)

        // Only consider _countries_ as candidates for peer selection
        // (e.g. exclude aggregates like continents or income groups)
        const candidates = availableEntities.filter(
            (entityName) =>
                checkIsCountryName(entityName) && entityName !== targetCountry
        )

        // Create a map of entity names to their values
        const values = new Map(data.map((row) => [row.entity, row.value]))

        return findClosestByValue({
            target: targetCountry,
            candidates,
            values,
            targetCount,
            maxPeerRatio,
        })
    } catch (error) {
        console.error(
            "Failed to select peer countries by closest value:",
            error
        )
        return []
    }
}

/** Selects neighboring countries as peers */
async function selectNeighborsAsPeers({
    targetCountry,
    availableEntities,
    additionalDataLoaderFn,
    targetCount = 3,
}: SelectNeighborsAsPeersParams): Promise<EntityName[]> {
    try {
        // Load data
        if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
        const data = await additionalDataLoaderFn("neighbors")

        // Find the target country's neighbors
        const targetEntry = data.find((entry) => entry.entity === targetCountry)
        if (!targetEntry) {
            console.warn(`No neighbors data found for ${targetCountry}`)
            return []
        }

        // Filter to only neighbors that are available in the chart's data
        const availableEntitiesSet = new Set(availableEntities)
        const availableNeighbors = targetEntry.value.filter((neighbor) =>
            availableEntitiesSet.has(neighbor)
        )

        // Return the first x neighbors
        return availableNeighbors.slice(0, targetCount)
    } catch (error) {
        console.error("Failed to select neighbors as peers:", error)
        return []
    }
}

/** Selects countries representing the full data range */
async function selectPeerCountriesByDataRange({
    targetCountry,
    availableEntities,
    dataColumn,
    endTime,
    isSingleTimeChart,
    additionalDataLoaderFn,
    targetCount = 5,
    randomize = false,
}: SelectByDataRangeParams): Promise<EntityName[]> {
    if (!isDataColumnAvailable(dataColumn)) return []
    const window = findLatestValueWindow({
        column: dataColumn,
        entityNames: availableEntities,
        endTime,
        isSingleTimeChart,
    })
    const candidates = findLatestValuesInWindow({
        column: dataColumn,
        entityNames: availableEntities,
        window,
    })
    if (candidates.length === 0) return []

    if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
    const populationData = await additionalDataLoaderFn("population")
    const population = new Map(
        populationData.map((row) => [row.entity, row.value])
    )

    return findSpreadByValue({
        candidates,
        population,
        targetCount,
        targetCountry,
        randomize,
    }).filter((entityName) => entityName !== targetCountry)
}

/** Finds entities with values closest to a target entity using logarithmic distance */
export function findClosestByValue({
    target,
    candidates,
    values,
    targetCount = 3,
    maxPeerRatio = 1.5,
}: {
    target: EntityName
    candidates?: EntityName[]
    values: Map<EntityName, number>
    /** Number of peer entities to select */
    targetCount?: number
    /** Maximum ratio difference allowed */
    maxPeerRatio?: number
}): EntityName[] {
    // Check that the target entity has a value
    const targetValue = values.get(target)
    if (targetValue === undefined) {
        console.warn(`Target entity ${target} not found in values`)
        return []
    }

    // Settings for finding peers
    const settings = { targetValue, targetCount, maxPeerRatio }

    // Default to all available entities as candidates
    const availableEntities = Array.from(values.keys()).filter(
        (entityName) => entityName !== target
    )
    const candidatesToUse = candidates ?? availableEntities

    // Get the target's continent for filtering
    const targetContinent = getContinentForCountry(target)

    // If the target continent is unknown, search all candidates
    if (!targetContinent) {
        return findClosestByLogDistance({
            values,
            candidates: candidatesToUse,
            ...settings,
        })
    }

    // Find candidates on the same continent vs other continents
    const [sameContinentCandidates, otherContinentsCandidates] = R.partition(
        candidatesToUse,
        (name) => getContinentForCountry(name) === targetContinent
    )

    // First try finding peer countries on the same continent
    const sameContinentPeers = findClosestByLogDistance({
        values,
        candidates: sameContinentCandidates,
        ...settings,
    })

    // If we have enough same-continent peers, return them
    if (sameContinentPeers.length >= targetCount) return sameContinentPeers

    // Otherwise, fill up with peers from other continents
    const remainingCount = targetCount - sameContinentPeers.length
    const otherContinentPeers = findClosestByLogDistance({
        values,
        candidates: otherContinentsCandidates,
        ...settings,
        targetCount: remainingCount,
    })

    const combinedPeers = [...sameContinentPeers, ...otherContinentPeers]

    if (combinedPeers.length === 0) {
        console.warn(
            `No peers found within ${maxPeerRatio}x for ${target} (value: ${targetValue})`
        )
    }

    return combinedPeers
}

const findClosestByLogDistance = ({
    values,
    candidates,
    targetValue,
    targetCount = 3,
    maxPeerRatio = 1.25,
}: {
    values: Map<EntityName, number>
    candidates: EntityName[]
    targetValue: number
    targetCount: number
    maxPeerRatio: number
}): EntityName[] => {
    const targetLogValue = Math.log(targetValue)
    const maxLogDistance = Math.log(maxPeerRatio)

    return R.pipe(
        candidates,
        R.map((entityName) => {
            const value = values.get(entityName)
            if (value === undefined) return undefined
            return {
                entityName,
                // Log distance: |log(value) - log(target)| = |log(value/target)|
                // Log distance so that 2x larger and 2x smaller are equidistant
                difference: Math.abs(Math.log(value) - targetLogValue),
            }
        }),
        R.filter(R.isDefined),
        // Exclude peers that are more than maxPeerRatio times larger/smaller
        R.filter(({ difference }) => difference <= maxLogDistance),
        R.sortBy((item) => item.difference),
        R.take(targetCount),
        R.map((item) => item.entityName)
    )
}

export function findLatestValueWindow({
    column,
    entityNames,
    endTime,
    isSingleTimeChart = false,
}: {
    column: CoreColumn
    entityNames: readonly EntityName[]
    endTime?: Time
    isSingleTimeChart?: boolean
}): TimeRange {
    const windowEndTime = Math.min(endTime ?? column.maxTime, column.maxTime)
    const windowLength = findWindowLength({
        column,
        entityNames,
        windowEndTime,
        isSingleTimeChart,
    })
    return [windowEndTime - windowLength, windowEndTime]
}

export function findLatestValuesInWindow({
    column,
    entityNames,
    window,
}: {
    column: CoreColumn
    entityNames: readonly EntityName[]
    window: TimeRange
}): LatestValue[] {
    return sortByValueThenName(
        findLatestValues({ column, entityNames, timeRange: window })
    )
}

/** Picks `targetCount` entities spread evenly across the range of latest values, in value order */
export function findSpreadByValue({
    candidates,
    population,
    targetCount,
    targetCountry,
    randomize = false,
}: {
    candidates: readonly LatestValue[]
    population: ReadonlyMap<EntityName, number>
    targetCount: number
    targetCountry?: EntityName
    randomize?: boolean
}): EntityName[] {
    if (targetCount <= 0) return []

    const sortedCandidates = sortByValueThenName(candidates)
    const countries = sortedCandidates.filter((candidate) =>
        checkIsCountryName(candidate.entityName)
    )
    const pool = countries.length >= targetCount ? countries : sortedCandidates
    if (pool.length <= targetCount)
        return pool.map(({ entityName }) => entityName)

    const bins = assignToValueBins(pool, targetCount)
    const pickedNames = new Set<EntityName>()

    const targetBinIndex = bins.findIndex((bin) =>
        bin.members.some(({ entityName }) => entityName === targetCountry)
    )
    if (targetBinIndex >= 0 && targetCountry !== undefined)
        pickedNames.add(targetCountry)

    for (const [binIndex, bin] of bins.entries()) {
        if (binIndex === targetBinIndex) continue
        const pick = randomize
            ? pickRandomByPopulation(bin.members, population)
            : pickMostPopulous(bin.members, population)
        if (pick) pickedNames.add(pick.entityName)
    }

    const emptyBins = bins.filter((bin) => bin.members.length === 0)
    for (const emptyBin of emptyBins) {
        const pick = pickNearestTo(
            pool.filter(({ entityName }) => !pickedNames.has(entityName)),
            emptyBin.center,
            population
        )
        if (pick) pickedNames.add(pick.entityName)
    }

    return pool
        .filter(({ entityName }) => pickedNames.has(entityName))
        .map(({ entityName }) => entityName)
}

function findWindowLength({
    column,
    entityNames,
    windowEndTime,
    isSingleTimeChart,
}: {
    column: CoreColumn
    entityNames: readonly EntityName[]
    windowEndTime: Time
    isSingleTimeChart: boolean
}): number {
    const maxWindowLength = isSubYearly(getTimeInterval(column.display))
        ? LATEST_VALUE_WINDOW_MAX_YEARS * 365
        : LATEST_VALUE_WINDOW_MAX_YEARS

    const indicatorTolerance = column.display?.tolerance ?? column.def.tolerance
    if (indicatorTolerance !== undefined)
        return Math.min(indicatorTolerance, maxWindowLength)

    if (isSingleTimeChart) return 0

    const latestValues = findLatestValues({
        column,
        entityNames,
        timeRange: [-Infinity, windowEndTime],
    })
    const latestCountryValues = latestValues.filter(({ entityName }) =>
        checkIsCountryName(entityName)
    )
    const latestValuesForCoverage =
        latestCountryValues.length >= LATEST_VALUE_WINDOW_MIN_COUNTRIES
            ? latestCountryValues
            : latestValues
    const timesBeforeEnd = latestValuesForCoverage.map(
        ({ time }) => windowEndTime - time
    )
    const coveringWindowLength = quantile(
        timesBeforeEnd,
        LATEST_VALUE_WINDOW_COVERAGE
    )
    if (coveringWindowLength === undefined) return maxWindowLength

    return Math.min(Math.ceil(coveringWindowLength), maxWindowLength)
}

function findLatestValues({
    column,
    entityNames,
    timeRange: [startTime, endTime],
}: {
    column: CoreColumn
    entityNames: readonly EntityName[]
    timeRange: TimeRange
}): LatestValue[] {
    const requestedEntityNames = new Set(entityNames)
    const latestValueByEntityNameInRange = new Map<EntityName, LatestValue>()
    const { allEntityNames, values, originalTimes } = column
    for (let i = 0; i < values.length; i++) {
        const entityName = allEntityNames[i]
        const value = values[i]
        const time = originalTimes[i]
        if (!requestedEntityNames.has(entityName)) continue
        if (!R.isNumber(value)) continue
        if (time < startTime || time > endTime) continue
        latestValueByEntityNameInRange.set(entityName, {
            entityName,
            value,
            time,
        })
    }
    return [...latestValueByEntityNameInRange.values()]
}

function sortByValueThenName(
    latestValues: readonly LatestValue[]
): LatestValue[] {
    return R.sortBy(
        latestValues,
        (latestValue) => latestValue.value,
        (latestValue) => latestValue.entityName
    )
}

function assignToValueBins(
    sortedCandidates: readonly LatestValue[],
    binCount: number
): ValueBin[] {
    const minValue = sortedCandidates[0].value
    const maxValue = sortedCandidates[sortedCandidates.length - 1].value
    const step = binCount > 1 ? (maxValue - minValue) / (binCount - 1) : 0
    const findBinIndex = scaleQuantize<number>()
        .domain([minValue - step / 2, maxValue + step / 2])
        .range(R.range(0, binCount))

    const bins: ValueBin[] = R.range(0, binCount).map((binIndex) => ({
        center: minValue + step * binIndex,
        members: [],
    }))
    for (const candidate of sortedCandidates)
        bins[findBinIndex(candidate.value)].members.push(candidate)
    return bins
}

function pickNearestTo(
    candidates: readonly LatestValue[],
    value: number,
    population: ReadonlyMap<EntityName, number>
): LatestValue | undefined {
    return R.firstBy(
        candidates,
        (candidate) => Math.abs(candidate.value - value),
        [(candidate) => population.get(candidate.entityName) ?? 0, "desc"],
        (candidate) => candidate.entityName
    )
}

function pickMostPopulous(
    candidates: readonly LatestValue[],
    population: ReadonlyMap<EntityName, number>
): LatestValue | undefined {
    return R.firstBy(
        candidates,
        [(candidate) => population.get(candidate.entityName) ?? 0, "desc"],
        (candidate) => candidate.entityName
    )
}

/** A random candidate weighted by population, or uniform when none has population */
function pickRandomByPopulation(
    candidates: readonly LatestValue[],
    population: ReadonlyMap<EntityName, number>
): LatestValue | undefined {
    if (candidates.length === 0) return undefined

    const populations = candidates.map(
        ({ entityName }) => population.get(entityName) ?? 0
    )
    const weights =
        R.sum(populations) > 0 ? populations : populations.map(() => 1)

    const cumulativeWeights = cumsum(weights)
    const totalWeight = cumulativeWeights[cumulativeWeights.length - 1]
    return candidates[
        bisectRight(cumulativeWeights, Math.random() * totalWeight)
    ]
}
