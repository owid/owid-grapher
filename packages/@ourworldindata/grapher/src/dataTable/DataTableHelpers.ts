import { EntityName } from "@ourworldindata/types"
import { match } from "ts-pattern"
import {
    EntitiesByRegionGroup,
    isEntityRegionGroupKey,
} from "../core/RegionGroups"
import { DataTableFilter, DataTableFilterOption } from "./DataTableConstants"

export interface DataTableEntities {
    availableEntityNames: EntityName[]
    entitiesByRegionGroup: EntitiesByRegionGroup
    selectedEntityNames: EntityName[]
}

export function getEntityNamesForDataTableFilter(
    filter: DataTableFilter,
    {
        availableEntityNames,
        entitiesByRegionGroup,
        selectedEntityNames,
    }: DataTableEntities
): EntityName[] {
    const candidateNames = match(filter)
        .with("all", () => availableEntityNames)
        .with("selection", () =>
            selectedEntityNames.length > 0
                ? selectedEntityNames
                : availableEntityNames
        )
        .when(
            isEntityRegionGroupKey,
            (filter) =>
                entitiesByRegionGroup.get(filter) ?? availableEntityNames
        )
        .exhaustive()

    const availableEntityNameSet = new Set(availableEntityNames)
    return candidateNames.filter((name) => availableEntityNameSet.has(name))
}

export function buildDataTableFilterOptions(
    entities: DataTableEntities,
    { canFilterBySelection }: { canFilterBySelection: boolean }
): DataTableFilterOption[] {
    const toOption = (filter: DataTableFilter): DataTableFilterOption => ({
        value: filter,
        count: getEntityNamesForDataTableFilter(filter, entities).length,
    })

    const regionGroupOptions = [...entities.entitiesByRegionGroup.keys()]
        .map(toOption)
        .filter(({ count }) => count > 0)

    return [
        toOption("all"),
        ...(canFilterBySelection ? [toOption("selection")] : []),
        ...regionGroupOptions,
    ]
}

export function hasDataTableFilterChoice(
    options: DataTableFilterOption[]
): boolean {
    const [allOption, ...otherOptions] = options
    return otherOptions.some(({ count }) => count < allOption.count)
}

export function pickDefaultDataTableFilter(
    options: DataTableFilterOption[]
): DataTableFilter {
    const [allOption, ...otherOptions] = options
    const countriesOption = otherOptions.find(
        ({ value }) => value === "countries"
    )
    const isCountriesMajority =
        !!countriesOption && countriesOption.count * 2 > allOption.count
    return isCountriesMajority && countriesOption.count < allOption.count
        ? "countries"
        : "all"
}
