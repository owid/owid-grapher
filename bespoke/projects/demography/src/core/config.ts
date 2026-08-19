import {
    parseBoolean,
    parseEnum,
    parseInteger,
} from "../../../../helpers/config.js"
import { isValidParameterKey, type ParameterKey } from "./types.js"
import { CONTROL_YEARS } from "./constants.js"

const VARIANT_NAMES = [
    "simulation",
    "dependencyRatio",
    "population",
    "populationPyramid",
    "parameters",
] as const

export type VariantName = (typeof VARIANT_NAMES)[number]

export const POPULATION_PYRAMID_UNITS = ["percent", "absolute"] as const

export type PopulationPyramidUnit = (typeof POPULATION_PYRAMID_UNITS)[number]

export interface SimulationVariantConfig {
    hideEntitySelector: boolean
    region?: string
    title?: string
    subtitle?: string
    focusParameter?: ParameterKey
    hidePopulationPyramid?: boolean
    populationPyramidUnit?: PopulationPyramidUnit
    urlSync?: boolean
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}

export interface DependencyRatioVariantConfig extends SimulationVariantConfig {
    retirementAgeAssumptions?: Record<number, number>
}

export interface PopulationVariantConfig {
    hideEntitySelector: boolean
    region?: string
    title?: string
    subtitle?: string
    showAssumptionCharts?: boolean
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}

export interface PopulationPyramidVariantConfig {
    hideEntitySelector: boolean
    hideTimeline?: boolean
    showAssumptionCharts?: boolean
    time?: number
    region?: string
    title?: string
    subtitle?: string
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    populationPyramidUnit?: PopulationPyramidUnit
}

export interface ParametersVariantConfig {
    hideEntitySelector: boolean
    region?: string
    title?: string
    subtitle?: string
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}

export type DemographyVariantConfig =
    | SimulationVariantConfig
    | DependencyRatioVariantConfig
    | PopulationVariantConfig
    | PopulationPyramidVariantConfig
    | ParametersVariantConfig

export function parseConfig(
    variantName: VariantName,
    raw: Record<string, string>
): DemographyVariantConfig {
    switch (variantName) {
        case "simulation":
            return parseSimulationConfig(raw)
        case "dependencyRatio":
            return {
                ...parseSimulationConfig(raw),
                retirementAgeAssumptions: parseControlPoints(
                    raw.retirementAgeAssumptions
                ),
            }
        case "population":
            return {
                hideEntitySelector: parseBoolean(raw.hideEntitySelector),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
                showAssumptionCharts: parseBoolean(raw.showAssumptionCharts),
                fertilityRateAssumptions: parseControlPoints(
                    raw.fertilityRateAssumptions
                ),
                lifeExpectancyAssumptions: parseControlPoints(
                    raw.lifeExpectancyAssumptions
                ),
                netMigrationRateAssumptions: parseControlPoints(
                    raw.netMigrationRateAssumptions
                ),
            }
        case "populationPyramid":
            return {
                hideEntitySelector: parseBoolean(raw.hideEntitySelector),
                hideTimeline: parseBoolean(raw.hideTimeline),
                showAssumptionCharts: parseBoolean(raw.showAssumptionCharts),
                time: parseInteger(raw.time),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
                fertilityRateAssumptions: parseControlPoints(
                    raw.fertilityRateAssumptions
                ),
                lifeExpectancyAssumptions: parseControlPoints(
                    raw.lifeExpectancyAssumptions
                ),
                netMigrationRateAssumptions: parseControlPoints(
                    raw.netMigrationRateAssumptions
                ),
                populationPyramidUnit: parseEnum(
                    raw.populationPyramidUnit,
                    POPULATION_PYRAMID_UNITS
                ),
            }
        case "parameters":
            return {
                hideEntitySelector: parseBoolean(raw.hideEntitySelector),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
                fertilityRateAssumptions: parseControlPoints(
                    raw.fertilityRateAssumptions
                ),
                lifeExpectancyAssumptions: parseControlPoints(
                    raw.lifeExpectancyAssumptions
                ),
                netMigrationRateAssumptions: parseControlPoints(
                    raw.netMigrationRateAssumptions
                ),
            }

        default:
            throw new Error(`Unknown variant: ${variantName}`)
    }
}

function parseSimulationConfig(
    raw: Record<string, string>
): SimulationVariantConfig {
    return {
        hideEntitySelector: parseBoolean(raw.hideEntitySelector),
        region: raw.region,
        title: raw.title,
        subtitle: raw.subtitle,
        focusParameter: parseParameterKey(raw.focusParameter),
        hidePopulationPyramid: parseBoolean(raw.hidePopulationPyramid),
        populationPyramidUnit: parseEnum(
            raw.populationPyramidUnit,
            POPULATION_PYRAMID_UNITS
        ),
        urlSync: parseBoolean(raw.urlSync),
        fertilityRateAssumptions: parseControlPoints(
            raw.fertilityRateAssumptions
        ),
        lifeExpectancyAssumptions: parseControlPoints(
            raw.lifeExpectancyAssumptions
        ),
        netMigrationRateAssumptions: parseControlPoints(
            raw.netMigrationRateAssumptions
        ),
    }
}

function parseParameterKey(value: unknown): ParameterKey | undefined {
    const trimmed = typeof value === "string" ? value.trim() : value
    return isValidParameterKey(trimmed) ? trimmed : undefined
}

/** Parse a comma-separated string of numbers into a Record keyed by CONTROL_YEARS.
 *  Empty entries (e.g. ",,1.5") are skipped so they fall back to UN WPP defaults. */
function parseControlPoints(
    csv: string | undefined
): Record<number, number> | undefined {
    if (!csv) return undefined
    const parts = csv.split(",")
    const result: Record<number, number> = {}
    for (let i = 0; i < CONTROL_YEARS.length; i++) {
        const raw = parts[i]?.trim()
        if (raw !== undefined && raw !== "") {
            const v = Number(raw)
            if (!isNaN(v)) {
                result[CONTROL_YEARS[i]] = v
            }
        }
    }
    return Object.keys(result).length > 0 ? result : undefined
}
