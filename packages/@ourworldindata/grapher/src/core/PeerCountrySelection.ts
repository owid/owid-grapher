import * as R from "remeda"
import * as _ from "lodash-es"
import {
    AdditionalGrapherDataFetchFn,
    EntityName,
    NumericCatalogKey,
    PeerCountryStrategy,
    PeerCountryStrategyQueryParam,
    Time,
} from "@ourworldindata/types"
import {
    checkIsAggregate,
    checkIsCountry,
    checkIsIncomeGroup,
    checkIsOwidContinent,
    excludeUndefined,
    getContinentForCountry,
    getParentRegions,
    getRegionByName,
    Region,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { WORLD_ENTITY_NAME } from "./GrapherConstants.js"
import { match } from "ts-pattern"
import { GrapherState } from "./GrapherState.js"

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
    availableEntities: EntityName[]
    dataColumn: CoreColumn
    randomize?: boolean
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    targetCount?: number
    time?: Time
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

/** Check if the given string is a valid PeerCountryStrategy */
function isValidPeerCountryStrategy(
    candidate: string
): candidate is PeerCountryStrategy {
    return Object.values(PeerCountryStrategy).includes(candidate as any)
}

/** Check if the given string is a valid PeerCountryStrategyQueryParam */
export function isValidPeerCountryStrategyQueryParam(
    candidate: string
): candidate is PeerCountryStrategyQueryParam {
    return candidate === "auto" || isValidPeerCountryStrategy(candidate)
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
    const regionInfo = getRegionByName(targetCountry)
    if (!regionInfo || !checkIsCountry(regionInfo)) return []

    const additionalDataLoaderFn = grapherState.additionalDataLoaderFn
    const dataColumn = grapherState.table.get(grapherState.yColumnSlug)
    const time = grapherState.endTime

    return selectPeerCountries({
        peerCountryStrategy,
        targetCountry,
        defaultSelection,
        availableEntities,
        additionalDataLoaderFn,
        dataColumn,
        time,
    })
}

/** Selects peer countries based on the specified strategy and target entity */
export async function selectPeerCountries(
    params: SelectPeerCountriesParams
): Promise<EntityName[]> {
    return match(params)
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

    const isAvailable = (region: Region | undefined): region is Region =>
        region !== undefined && availableEntitySet.has(region.name)

    // If there is an income group, include it
    const incomeGroup = parentRegions.find((r) => checkIsIncomeGroup(r))
    if (isAvailable(incomeGroup)) peers.add(incomeGroup.name)

    // If there is an OWID continent, include it;
    // otherwise include any other aggregate region
    const owidContinent = parentRegions.find((r) => checkIsOwidContinent(r))
    const nonOwidContinent = parentRegions.find((r) => checkIsAggregate(r))
    if (isAvailable(owidContinent)) {
        peers.add(owidContinent.name)
    } else if (isAvailable(nonOwidContinent)) {
        peers.add(nonOwidContinent.name)
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
        const candidates = availableEntities.filter((entityName) => {
            const region = getRegionByName(entityName)
            const isCountry = region && checkIsCountry(region)
            return isCountry && entityName !== targetCountry
        })

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
    availableEntities,
    dataColumn,
    additionalDataLoaderFn,
    targetCount = 5,
    randomize = false,
    time,
}: SelectByDataRangeParams): Promise<EntityName[]> {
    // Only consider countries as candidates for peer selection
    const candidateEntities = availableEntities.filter((entityName) => {
        const region = getRegionByName(entityName)
        return region && checkIsCountry(region)
    })

    // Extract latest values for candidate entities
    if (!isDataColumnAvailable(dataColumn)) return []
    const values = new Map<EntityName, number>()
    const targetTime = time ?? dataColumn.maxTime
    for (const entityName of candidateEntities) {
        const latestValue = dataColumn.owidRowByEntityNameAndTime
            .get(entityName)
            ?.get(targetTime)?.value
        if (latestValue !== undefined) values.set(entityName, latestValue)
    }

    // Load population data for weighted selection (prefer larger countries)
    if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
    const populationData = await additionalDataLoaderFn("population")
    const population = new Map(
        populationData.map((row) => [row.entity, row.value])
    )

    return findDataRangePeers({ values, population, targetCount, randomize })
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

/**
 * Finds entities representing the data distribution using stratified sampling.
 *
 * Divides data into buckets (quintiles by default) and picks one entity from each:
 * - When randomize=false (default): picks the most populous country in each bucket
 * - When randomize=true: random selection weighted by population
 */
export function findDataRangePeers({
    values,
    population,
    randomize = false,
    targetCount = 5,
}: {
    values: Map<EntityName, number>
    /** Population data for weighted selection (prefers larger countries) */
    population: Map<EntityName, number>
    targetCount?: number
    /** If true, use randomized selection; if false, pick most populous */
    randomize?: boolean
}): EntityName[] {
    const sortedData = R.pipe(
        Array.from(values.entries()),
        R.map(([entityName, value]) => ({ entityName, value })),
        R.sortBy((item) => item.value)
    )

    if (sortedData.length === 0) return []

    const bucketSize = Math.ceil(sortedData.length / targetCount)
    const buckets = R.chunk(sortedData, bucketSize)

    const selected = R.pipe(
        buckets,
        R.map((bucket) => {
            if (bucket.length === 0) return undefined

            return randomize
                ? weightedRandomPick(bucket, population)
                : maxPopulationPick(bucket, population)
        }),
        R.filter(R.isDefined)
    )

    return R.unique(selected)
}

/** Pick the entity with the highest population from the bucket */
function maxPopulationPick(
    bucket: { entityName: EntityName; value: number }[],
    population: Map<EntityName, number>
): EntityName | undefined {
    return _.maxBy(bucket, (item) => population.get(item.entityName) ?? 0)
        ?.entityName
}

/** Pick a random entity from the bucket, weighted by population */
function weightedRandomPick(
    bucket: { entityName: EntityName; value: number }[],
    population: Map<EntityName, number>
): EntityName | undefined {
    // Calculate weights using population
    const weights = bucket.map((item) => population.get(item.entityName) ?? 0)

    const totalWeight = R.sum(weights)

    // If no population data is available, just pick a random entity
    if (totalWeight === 0) return R.sample(bucket, 1)[0]?.entityName

    // Weighted random selection: imagine a number line divided into segments,
    // where each country's segment size equals its weight. We pick a random
    // point on the line, then walk through segments until we find which one
    // contains our point. Countries with larger weights have larger segments,
    // so they're more likely to be picked.
    //
    // Example with weights [5, 3, 2]:
    //   |------Germany (5)------|--France (3)--|-Belgium (2)-|
    //   0                        5              8             10
    // A random point at 6.5 lands in France's segment, so France is picked.
    let random = Math.random() * totalWeight
    for (let i = 0; i < bucket.length; i++) {
        random -= weights[i]
        if (random <= 0) return bucket[i].entityName
    }

    return bucket[bucket.length - 1]?.entityName
}
