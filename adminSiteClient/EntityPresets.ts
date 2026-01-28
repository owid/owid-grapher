import { EntityName } from "@ourworldindata/types"
import {
    getContinents,
    getIncomeGroups,
    getAggregatesBySource,
    AggregateSource,
    AGGREGATE_SOURCES,
} from "@ourworldindata/utils"
import {
    CUSTOM_REGION_SOURCE_IDS,
    CustomAggregateSource,
} from "@ourworldindata/grapher"
import { CoreColumn } from "@ourworldindata/core-table"
import * as _ from "lodash-es"

export interface EntityPreset {
    id: string
    label: string
    description: string
    entities: EntityName[]
}

const AGGREGATE_SOURCE_LABELS: Record<AggregateSource, string> = {
    un: "UN regions",
    wb: "WB regions",
    who: "WHO regions",
    un_m49_1: "UN M49 (top)",
    un_m49_2: "UN M49 (mid)",
    un_m49_3: "UN M49 (detailed)",
    pew: "Pew regions",
    unsdg: "UN SDG regions",
}

const CUSTOM_SOURCE_LABELS: Record<CustomAggregateSource, string> = {
    fao: "FAO regions",
    ei: "EI regions",
    pip: "PIP regions",
    ember: "Ember regions",
    gcp: "GCP regions",
    niaid: "NIAID regions",
    unicef: "UNICEF regions",
    unaids: "UNAIDS regions",
    undp: "UNDP regions",
    wid: "WID regions",
    oecd: "OECD regions",
    unsd: "UNSD regions",
    unm49: "UN M49 regions",
}

/** Extracts entities matching a custom source pattern like "Africa (FAO)" */
function getEntitiesForCustomSource(
    availableEntities: EntityName[],
    sourceId: CustomAggregateSource
): EntityName[] {
    const suffix = ` (${sourceId.toLowerCase()})`
    return availableEntities.filter((name) =>
        name.trim().toLowerCase().endsWith(suffix)
    )
}

/**
 * Sorts entities by their last data point value in ascending order
 * (smallest first). Entities without data are placed at the end.
 */
export function sortEntitiesByLastValue(
    entities: EntityName[],
    dataColumn: CoreColumn | undefined
): EntityName[] {
    if (!dataColumn) return entities

    const rowsByEntity = dataColumn.owidRowsByEntityName

    return _.sortBy(entities, (entity) => {
        const rows = rowsByEntity.get(entity)

        // Entities without data go to the end
        if (!rows?.length) return Infinity

        // Sort by latest value
        const lastRow = _.maxBy(rows, (row) => row.time)
        return lastRow ? lastRow.value : Infinity
    })
}

/**
 * Entity presets in priority order.
 *
 * When auto-selecting entities, we try these in order and use the first
 * one that has enough available entities.
 */
export const STATIC_ENTITY_PRESETS: EntityPreset[] = [
    {
        id: "continents",
        label: "Continents",
        description: "OWID continents (Africa, Asia, Europe, etc.)",
        entities: getContinents().map((r) => r.name),
    },
    {
        id: "income_groups",
        label: "Income groups",
        description: "World Bank income groups",
        entities: getIncomeGroups().map((r) => r.name),
    },
    // Add all aggregate sources
    ...AGGREGATE_SOURCES.map(
        (source): EntityPreset => ({
            id: source,
            label: AGGREGATE_SOURCE_LABELS[source],
            description: `Regions defined by ${source.toUpperCase()}`,
            entities: getAggregatesBySource(source).map((r) => r.name),
        })
    ),
]

export interface AvailablePreset {
    preset: EntityPreset
    entities: EntityName[]
}

/**
 * Returns all entity presets that exist for the given available entities.
 * Includes both static presets (continents, income groups, etc.) and
 * dynamic presets for custom region sources detected in the data.
 */
export function getAvailablePresets(
    availableEntityNames: EntityName[]
): AvailablePreset[] {
    const availableSet = new Set(availableEntityNames)

    // Check static presets
    const staticPresets = STATIC_ENTITY_PRESETS.map((preset) => {
        const availableEntities = preset.entities.filter((name) =>
            availableSet.has(name)
        )
        return { preset, entities: availableEntities }
    }).filter(({ entities }) => entities.length >= 3)

    // Check custom region sources (entities like "Africa (FAO)")
    const customPresets = CUSTOM_REGION_SOURCE_IDS.map((sourceId) => {
        const entities = getEntitiesForCustomSource(
            availableEntityNames,
            sourceId
        )
        const preset: EntityPreset = {
            id: `custom_${sourceId}`,
            label: CUSTOM_SOURCE_LABELS[sourceId],
            description: `Regions defined by ${sourceId.toUpperCase()}`,
            entities,
        }
        return { preset, entities }
    }).filter(({ entities }) => entities.length >= 3)

    return [...staticPresets, ...customPresets]
}

/**
 * Tries presets in priority order and returns entities from the first
 * preset that has enough available entities.
 */
export function pickFirstAvailablePreset(
    availableEntityNames: EntityName[]
): EntityName[] | undefined {
    const availableSet = new Set(availableEntityNames)

    const entityPresets = getAvailablePresets(availableEntityNames)

    for (const preset of entityPresets) {
        return preset.entities.filter((name) => availableSet.has(name))
    }

    return undefined
}
