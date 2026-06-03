import { match } from "ts-pattern"

import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { GENDER_FEMALE, GENDER_MALE, Sex } from "./types.js"

/** Translate a raw metadata gender id into the semantic `Sex` enum. */
export function sexFromId(id: number): Sex {
    return match(id)
        .with(GENDER_FEMALE, () => "female" as const)
        .with(GENDER_MALE, () => "male" as const)
        .otherwise(() => "both" as const)
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

export const formatPeople = (v: number, opts?: { unit?: boolean }): string =>
    formatValue(v, {
        unit: opts?.unit === false ? undefined : "people",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

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

/** Cap a list to 8 visible items, returning the remainder count */
export function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= 10
    const visible = showAll ? items : items.slice(0, 8)
    return { visible, hiddenCount: items.length - visible.length }
}
