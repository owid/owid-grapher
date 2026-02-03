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

export interface ParsedProvider {
    mainName: string
    providerCode: string
}

/**
 * Parse entity name to extract provider suffix.
 * Returns undefined if no recognized provider suffix found.
 *
 * Example: "Africa (WHO)" -> { mainName: "Africa", providerCode: "WHO" }
 */
export function parseProviderFromEntityName(
    entityName: string
): ParsedProvider | undefined {
    const match = entityName.match(/^(.+)\s+\(([A-Z]+)\)$/)
    if (!match) return undefined

    const [, mainName, providerCode] = match
    // Only return if provider is in whitelist
    if (!(providerCode in PROVIDER_INFO)) return undefined

    return { mainName, providerCode }
}
