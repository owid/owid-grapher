import { EntityName } from "@ourworldindata/types"
import {
    getContinents,
    getIncomeGroups,
    getAggregatesInRegionSet,
    getRegionSets,
    RegionSet,
} from "@ourworldindata/utils"
import { parseLabel, regionGroupLabels } from "@ourworldindata/grapher"
import * as R from "remeda"
import { CoreColumn } from "@ourworldindata/core-table"
import * as _ from "lodash-es"

export interface EntityPreset {
    id: string
    label: string
    description: string
    entities: EntityName[]
}

/** Short names used in the admin */
export const regionSetLabels: Record<RegionSet, string> = {
    un: "UN regions",
    un_m49_1: "UN M49 (top)",
    un_m49_2: "UN M49 (mid)",
    un_m49_3: "UN M49 (detailed)",
    unsdg: "UN SDG regions",
    wb: "WB regions",
    who: "WHO regions",
    pew: "Pew regions",
    iea: "IEA regions",
    ei: "EI regions",
    ember: "Ember regions",
    maddison: "Maddison regions",
    wid: "WID regions",
    ilo_1: "ILO (broad)",
    ilo_2: "ILO (sub)",
    fao_1: "FAO (continents)",
    fao_2: "FAO (subregions)",
    fao_sdg: "FAO (SDG regions)",
    ihme_gbd_1: "IHME GBD (super-regions)",
    ihme_gbd_2: "IHME GBD (regions)",
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
    // Add each region set as its own preset (UN, WB, WHO, FAO subregions, etc.)
    ...getRegionSets().map((regionSet): EntityPreset => {
        const aggregates = getAggregatesInRegionSet(regionSet)
        return {
            id: regionSet,
            label: regionSetLabels[regionSet],
            description: regionGroupLabels[aggregates[0].publisher],
            entities: aggregates.map((r) => r.name),
        }
    }),
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

    // Check custom region sources (entities like "Africa (PIP)")
    const entitiesByPublisher = R.groupBy(
        availableEntityNames,
        (name) => parseLabel(name).publisherKey
    )
    const entitiesInStaticPresets = new Set(
        staticPresets.flatMap(({ entities }) => entities)
    )
    const additionalPresets = R.entries(entitiesByPublisher)
        .map(([publisher, entities]) => {
            const preset: EntityPreset = {
                id: `custom_${publisher}`,
                label: regionGroupLabels[publisher],
                description: `Regions defined by ${publisher.toUpperCase()}`,
                entities,
            }

            return { preset, entities }
        })
        .filter(
            ({ entities }) =>
                entities.length >= 3 &&
                entities.some((name) => !entitiesInStaticPresets.has(name))
        )

    return [...staticPresets, ...additionalPresets]
}

/** Returns the entities of the highest-priority preset that has enough of them available */
export function pickFirstAvailablePreset(
    availableEntityNames: EntityName[]
): EntityName[] | undefined {
    return getAvailablePresets(availableEntityNames)[0]?.entities
}
