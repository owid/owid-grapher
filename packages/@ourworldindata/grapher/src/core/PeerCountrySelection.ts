import * as R from "remeda"
import * as _ from "lodash-es"
import {
    AdditionalGrapherDataFetchFn,
    CatalogKey,
    EntityName,
    PeerCountryStrategy,
    PeerCountryStrategyQueryParam,
} from "@ourworldindata/types"
import {
    checkIsAggregate,
    checkIsCountry,
    checkIsIncomeGroup,
    checkIsOwidContinent,
    getContinentForCountry,
    getParentRegions,
    getRegionByName,
    Region,
} from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { WORLD_ENTITY_NAME } from "./GrapherConstants.js"
import { match } from "ts-pattern"
import { GrapherState } from "./GrapherState.js"

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
 * The target country is the one currently selected in the grapher. This only
 * takes effect when exactly one entity is selected.
 */
export async function selectPeerCountriesForGrapher(
    grapherState: GrapherState,
    options?: {
        peerCountryStrategy?: PeerCountryStrategy
        targetCountry?: EntityName
    }
): Promise<EntityName[]> {
    if (grapherState.selection.numSelectedEntities !== 1) return []

    const targetCountry =
        options?.targetCountry ?? grapherState.selection.selectedEntityNames[0]
    const defaultSelection = grapherState.authorsVersion.selectedEntityNames

    const availableEntities = grapherState.availableEntityNames
    if (availableEntities.length === 0) return []

    const peerCountryStrategy =
        options?.peerCountryStrategy ?? grapherState.peerCountryStrategy
    if (!peerCountryStrategy) return []

    // Peer country selection only makes sense for countries
    const regionInfo = getRegionByName(targetCountry)
    if (!regionInfo || !checkIsCountry(regionInfo)) return []

    const additionalDataLoaderFn = grapherState.additionalDataLoaderFn

    const dataColumn = grapherState.table.get(grapherState.yColumnSlug)

    return selectPeerCountries({
        peerCountryStrategy,
        targetCountry,
        defaultSelection,
        availableEntities,
        additionalDataLoaderFn,
        dataColumn,
    })
}

/** Selects peer countries based on the specified strategy and target entity */
export async function selectPeerCountries({
    peerCountryStrategy,
    targetCountry,
    defaultSelection,
    availableEntities,
    additionalDataLoaderFn,
    dataColumn,
}: {
    peerCountryStrategy: PeerCountryStrategy
    targetCountry: EntityName
    defaultSelection: EntityName[]
    availableEntities: EntityName[]
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
    dataColumn?: CoreColumn
}): Promise<EntityName[]> {
    return match(peerCountryStrategy)
        .with(PeerCountryStrategy.DefaultSelection, () => defaultSelection)
        .with(PeerCountryStrategy.ParentRegions, () =>
            selectParentRegionsAsPeers({ targetCountry, availableEntities })
        )
        .with(PeerCountryStrategy.GdpPerCapita, async () => {
            if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
            return selectPeerCountriesByClosestValue({
                targetCountry,
                availableEntities,
                additionalDataLoaderFn,
                catalogKey: "gdp",
                maxPeerRatio: 1.25,
            })
        })
        .with(PeerCountryStrategy.Population, async () => {
            if (!isDataLoaderAvailable(additionalDataLoaderFn)) return []
            return selectPeerCountriesByClosestValue({
                targetCountry,
                availableEntities,
                additionalDataLoaderFn,
                catalogKey: "population",
                maxPeerRatio: 1.5,
            })
        })
        .with(PeerCountryStrategy.DataRange, async () => {
            if (
                !isDataColumnAvailable(dataColumn) ||
                !isDataLoaderAvailable(additionalDataLoaderFn)
            )
                return []
            return selectPeerCountriesByDataRange({
                availableEntities,
                dataColumn,
                additionalDataLoaderFn,
            })
        })
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

/**
 * Selects parent aggregate regions (continents, income groups) that the target
 * country belongs to, plus World.
 */
export function selectParentRegionsAsPeers({
    targetCountry,
    availableEntities,
}: {
    targetCountry: EntityName
    availableEntities: EntityName[]
}): EntityName[] {
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
}: {
    targetCountry: EntityName
    availableEntities: EntityName[]
    additionalDataLoaderFn: AdditionalGrapherDataFetchFn
    catalogKey: CatalogKey
    /** Number of peer entities to select */
    targetCount?: number
    /** Maximum ratio difference allowed */
    maxPeerRatio?: number
}): Promise<EntityName[]> {
    try {
        // Load data
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

/** Selects countries representing the full data range */
async function selectPeerCountriesByDataRange({
    availableEntities,
    dataColumn,
    additionalDataLoaderFn,
    randomize = false,
}: {
    availableEntities: EntityName[]
    dataColumn: CoreColumn
    additionalDataLoaderFn: AdditionalGrapherDataFetchFn
    /** If true, use randomized selection; if false, pick most populous per bucket */
    randomize?: boolean
}): Promise<EntityName[]> {
    // Only consider countries as candidates for peer selection
    const candidateCountries = availableEntities.filter((entityName) => {
        const region = getRegionByName(entityName)
        return region && checkIsCountry(region)
    })

    // Extract latest values for candidate countries
    const values = new Map<EntityName, number>()
    for (const entityName of candidateCountries) {
        const latestValue = dataColumn.owidRowByEntityNameAndTime
            .get(entityName)
            ?.get(dataColumn.maxTime)?.value
        if (latestValue !== undefined) values.set(entityName, latestValue)
    }

    // Load population data for weighted selection (prefer larger countries)
    const populationData = await additionalDataLoaderFn("population")
    const population = new Map(
        populationData.map((row) => [row.entity, row.value])
    )

    return findDataRangePeers({ values, population, randomize })
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
 * - When randomize=true: random selection weighted by log(population)
 */
export function findDataRangePeers({
    values,
    population,
    randomize = false,
    numBuckets = 5,
}: {
    values: Map<EntityName, number>
    /** Population data for weighted selection (prefers larger countries) */
    population: Map<EntityName, number>
    numBuckets?: number
    /** If true, use randomized selection; if false, pick most populous */
    randomize?: boolean
}): EntityName[] {
    const sortedData = R.pipe(
        Array.from(values.entries()),
        R.map(([entityName, value]) => ({ entityName, value })),
        R.sortBy((item) => item.value)
    )

    if (sortedData.length === 0) return []

    const bucketSize = Math.ceil(sortedData.length / numBuckets)
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

/**
 * Pick a random entity from the bucket, weighted by log(population).
 *
 * We use log(population) rather than raw population to create a soft preference
 * for larger countries without letting extreme outliers (China, India) dominate.
 * Raw population has a wide range between the largest and smallest countries;
 * log compresses this to ~2x, giving larger countries better odds while still
 * allowing variety.
 */
function weightedRandomPick(
    bucket: { entityName: EntityName; value: number }[],
    population: Map<EntityName, number>
): EntityName | undefined {
    // Calculate weights using log(population)
    const weights = bucket.map((item) => {
        const pop = population.get(item.entityName) ?? 1
        return Math.log(pop)
    })

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
