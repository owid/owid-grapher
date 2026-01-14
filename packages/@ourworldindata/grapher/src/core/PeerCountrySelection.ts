import {
    EntityName,
    PeerCountryStrategy,
    PeerCountryStrategyQueryParam,
} from "@ourworldindata/types"
import {
    checkIsCountry,
    getAggregates,
    getContinents,
    getIncomeGroups,
    getParentRegions,
    getRegionByName,
    getSiblingRegions,
} from "@ourworldindata/utils"
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
export function selectPeerCountriesForGrapher(
    grapherState: GrapherState
): EntityName[] {
    if (grapherState.selection.numSelectedEntities !== 1) return []

    const targetCountry = grapherState.selection.selectedEntityNames[0]
    const defaultSelection = grapherState.authorsVersion.selectedEntityNames

    const availableEntities = grapherState.availableEntityNames
    if (availableEntities.length === 0) return []

    const peerCountryStrategy = grapherState.peerCountryStrategy
    if (!peerCountryStrategy) return []

    // Peer country selection only makes sense for countries
    const regionInfo = getRegionByName(targetCountry)
    if (!regionInfo || !checkIsCountry(regionInfo)) return []

    return selectPeerCountries({
        peerCountryStrategy,
        targetCountry,
        defaultSelection,
        availableEntities,
    })
}

/** Selects peer countries based on the specified strategy and target entity */
export function selectPeerCountries({
    peerCountryStrategy,
    targetCountry,
    defaultSelection,
    availableEntities,
}: {
    peerCountryStrategy: PeerCountryStrategy
    targetCountry: EntityName
    defaultSelection: EntityName[]
    availableEntities: EntityName[]
}): EntityName[] {
    return match(peerCountryStrategy)
        .with(PeerCountryStrategy.DefaultSelection, () => defaultSelection)
        .with(PeerCountryStrategy.ParentRegions, () =>
            selectParentRegionsAsPeers({ targetCountry, availableEntities })
        )
        .exhaustive()
}

/**
 * Selects parent aggregate regions (continents, income groups) that the target
 * country belongs to, plus World.
 */
function selectParentRegionsAsPeers({
    targetCountry,
    availableEntities,
}: {
    targetCountry: EntityName
    availableEntities: EntityName[]
}): EntityName[] {
    const availableEntitySet = new Set(availableEntities)

    const comparisonEntities = new Set<EntityName>()

    // Can't determine comparison entities for non-geographical entities
    const region = getRegionByName(targetCountry)
    if (!region) return []

    // Compare World to any aggregate entities (e.g. continents or income groups)
    if (targetCountry === WORLD_ENTITY_NAME)
        return selectRegionGroupByPriority(availableEntities)

    // Always include World as a comparison if available
    if (availableEntitySet.has(WORLD_ENTITY_NAME))
        comparisonEntities.add(WORLD_ENTITY_NAME)

    if (checkIsCountry(region)) {
        // For countries: add their parent regions (continent, income group, etc.)
        // Example: Germany -> Europe, Europe (WHO), High income countries
        const regions = getParentRegions(region.name)
        for (const region of regions)
            if (availableEntitySet.has(region.name))
                comparisonEntities.add(region.name)
    } else {
        // For aggregate regions: add sibling regions at the same hierarchical level
        // Example: Europe -> Asia, Africa, North America (other continents)
        const siblings = getSiblingRegions(region.name)
        for (const sibling of siblings) {
            if (availableEntitySet.has(sibling.name))
                comparisonEntities.add(sibling.name)
        }
    }

    return Array.from(comparisonEntities)
}

/**
 * Finds the best available regions from a set of available entities,
 * prioritizing continents, then  income groups, then other aggregates.
 */
export function selectRegionGroupByPriority(
    availableEntities: EntityName[],
    { includeWorld }: { includeWorld: boolean } = { includeWorld: false }
): EntityName[] {
    const availableEntitySet = new Set(availableEntities)

    const regionGroups = [getContinents(), getIncomeGroups(), getAggregates()]
    for (const regions of regionGroups) {
        const availableRegions: EntityName[] = regions
            .filter((region) => availableEntitySet.has(region.name))
            .map((region) => region.name)

        if (availableRegions.length > 0) {
            // Also add the World entity if it's available
            if (includeWorld && availableEntitySet.has(WORLD_ENTITY_NAME)) {
                availableRegions.push(WORLD_ENTITY_NAME)
            }

            return availableRegions
        }
    }
    return []
}
