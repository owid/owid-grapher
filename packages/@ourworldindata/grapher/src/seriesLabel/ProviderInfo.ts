export interface ProviderDefinition {
    name: string
    description: string
}

/**
 * Providers that show info icons with tooltips.
 * Key is the provider code as it appears in entity names (e.g., "WHO" in "Africa (WHO)")
 */
export const PROVIDER_INFO: Record<string, ProviderDefinition> = {
    WHO: {
        name: "World Health Organization",
        description:
            "WHO member states are grouped into 6 regions based on health and epidemiological criteria.",
    },
    UN: {
        name: "United Nations",
        description:
            "The UN geoscheme divides countries into geographic regions and subregions.",
    },
    // Extend as needed...
}
