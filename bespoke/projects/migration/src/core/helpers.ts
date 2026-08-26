import { match } from "ts-pattern"

import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { GenderOption, MigrationMetadata, Sex } from "./types.js"

/** Map a raw metadata gender name onto the semantic `Sex` enum. */
export function sexFromName(name: string): Sex {
    return match(name.toLowerCase())
        .with("female", () => "female" as const)
        .with("male", () => "male" as const)
        .otherwise(() => "both" as const)
}

/** Resolve a raw metadata gender id to a `Sex` via the metadata's own
 *  id → name mapping (dimensions.genders), rather than hard-coded ids. */
export function sexFromId(id: number, genders: GenderOption[]): Sex {
    const name = genders.find((g) => g.id === id)?.name
    return name ? sexFromName(name) : "both"
}

export function getSexAdjective(sex: Sex): string | undefined {
    return sex === "both" ? undefined : sex
}

export function getSexNoun(sexAdjective: string | undefined): string {
    return match(sexAdjective)
        .with("male", () => "men")
        .with("female", () => "women")
        .otherwise(() => "people")
}

export const formatPeople = (v: number, opts?: { unit?: boolean }): string => {
    const numSignificantFigures = v < 10 ? 1 : 2

    return formatValue(v, {
        unit: opts?.unit === false ? undefined : "people",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures,
    })
}

export function formatShare(share: number): string {
    const pct = share * 100
    if (!isFinite(pct) || pct <= 0) return ""
    return formatValue(pct, {
        unit: "%",
        numberAbbreviation: false,
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })
}

/** Resolve a country's total population at a given year from the metadata.
 *  The per-entity `population` array is aligned with `metadata.times`. */
export function getPopulation(
    metadata: MigrationMetadata,
    countryName: string,
    year: number
): number | undefined {
    const entity = metadata.entities.find((e) => e.name === countryName)
    if (!entity) return undefined
    const index = metadata.times.indexOf(year)
    if (index < 0) return undefined
    const population = entity.population[index]
    return Number.isFinite(population) ? population : undefined
}

/** Cap a list to 8 visible items, returning the remainder count */
export function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= 10
    const visible = showAll ? items : items.slice(0, 8)
    return { visible, hiddenCount: items.length - visible.length }
}

export const OTHERS_ENTITY_NAME = "Other countries"
