import { isValidParameterKey, type ParameterKey } from "./helpers/types.js"

const VARIANT_NAMES = ["simulation", "population", "parameters"] as const

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

export interface ParametersVariantConfig {
    hideControls: boolean
    region?: string
    title?: string
    subtitle?: string
}

export type DemographyVariantConfig =
    | SimulationVariantConfig
    | PopulationVariantConfig
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

function parseBoolean(value: unknown): boolean {
    return value === true || value === "true"
}
