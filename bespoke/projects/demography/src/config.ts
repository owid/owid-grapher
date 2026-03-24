import { isValidParameterKey, type ParameterKey } from "./helpers/types.js"
import { CONTROL_YEARS } from "./helpers/constants.js"

const VARIANT_NAMES = [
    "simulation",
    "population",
    "populationPyramid",
    "parameters",
] as const

export type VariantName = (typeof VARIANT_NAMES)[number]

export interface SimulationVariantConfig {
    hideControls: boolean
    region?: string
    title?: string
    subtitle?: string
    focusParameter?: ParameterKey
    stabilizingParameter?: ParameterKey
    hidePopulationPyramid?: boolean
}

export interface PopulationVariantConfig {
    hideControls: boolean
    region?: string
    title?: string
    subtitle?: string
}

export interface PopulationPyramidVariantConfig {
    hideControls: boolean
    hideTimeline?: boolean
    time?: number
    region?: string
    title?: string
    subtitle?: string
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
}

export interface ParametersVariantConfig {
    hideControls: boolean
    region?: string
    title?: string
    subtitle?: string
}

export type DemographyVariantConfig =
    | SimulationVariantConfig
    | PopulationVariantConfig
    | PopulationPyramidVariantConfig
    | ParametersVariantConfig

export function parseConfig(
    variantName: VariantName,
    raw: Record<string, string>
): DemographyVariantConfig {
    switch (variantName) {
        case "simulation":
            return {
                hideControls: parseBoolean(raw.hideControls),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
                focusParameter: parseParameterKey(raw.focusParameter),
                stabilizingParameter: parseParameterKey(
                    raw.stabilizingParameter
                ),
                hidePopulationPyramid: parseBoolean(raw.hidePopulationPyramid),
            }
        case "population":
            return {
                hideControls: parseBoolean(raw.hideControls),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
            }
        case "populationPyramid":
            return {
                hideControls: parseBoolean(raw.hideControls),
                hideTimeline: parseBoolean(raw.hideTimeline),
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
            }
        case "parameters":
            return {
                hideControls: parseBoolean(raw.hideControls),
                region: raw.region,
                title: raw.title,
                subtitle: raw.subtitle,
            }

        default:
            throw new Error(`Unknown variant: ${variantName}`)
    }
}

function parseParameterKey(value: unknown): ParameterKey | undefined {
    return isValidParameterKey(value) ? value : undefined
}

function parseInteger(value: unknown): number | undefined {
    if (typeof value === "number") return Math.round(value)
    if (typeof value === "string") {
        const n = parseInt(value, 10)
        return isNaN(n) ? undefined : n
    }
    return undefined
}

/** Parse a comma-separated string of numbers into a Record keyed by CONTROL_YEARS */
function parseControlPoints(
    csv: string | undefined
): Record<number, number> | undefined {
    if (!csv) return undefined
    const values = csv.split(",").map(Number)
    const result: Record<number, number> = {}
    for (let i = 0; i < CONTROL_YEARS.length; i++) {
        const v = values[i]
        if (v !== undefined && !isNaN(v)) {
            result[CONTROL_YEARS[i]] = v
        }
    }
    return Object.keys(result).length > 0 ? result : undefined
}

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}
