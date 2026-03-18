const VARIANT_NAMES = ["simulation", "population", "parameters"] as const

export type VariantName = (typeof VARIANT_NAMES)[number]

export interface SimulationVariantConfig {
    hideControls: boolean
}

export interface PopulationVariantConfig {
    hideControls: boolean
    title?: string
    subtitle?: string
}

export interface ParametersVariantConfig {
    hideControls: boolean
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
                hideControls: raw.hideControls === "true",
            }
        case "population":
            return {
                hideControls: raw.hideControls === "true",
                title: raw.title,
                subtitle: raw.subtitle,
            }
        case "parameters":
            return {
                hideControls: raw.hideControls === "true",
                title: raw.title,
                subtitle: raw.subtitle,
            }

        default:
            throw new Error(`Unknown variant: ${variantName}`)
    }
}
