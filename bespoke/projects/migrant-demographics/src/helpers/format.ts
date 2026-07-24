import { EntityName } from "@ourworldindata/types"

/**
 * Some entity names read awkwardly in a sentence ("... living in United States
 * of America"). Map the most common ones to a natural phrase; everything else
 * falls back to the raw name.
 */
const ENTITY_SENTENCE_OVERRIDES: Record<string, string> = {
    "United States of America": "the United States",
    "United Kingdom": "the United Kingdom",
    "United Arab Emirates": "the United Arab Emirates",
    Netherlands: "the Netherlands",
    Philippines: "the Philippines",
    "Czech Republic": "the Czech Republic",
    "Democratic Republic of Congo": "the Democratic Republic of Congo",
    "Russian Federation": "the Russian Federation",
    WORLD: "the world",
    AFRICA: "Africa",
    ASIA: "Asia",
    EUROPE: "Europe",
    OCEANIA: "Oceania",
    "NORTHERN AMERICA": "Northern America",
    "LATIN AMERICA AND THE CARIBBEAN": "Latin America and the Caribbean",
}

export function formatEntityForSentence(entityName: EntityName): string {
    return ENTITY_SENTENCE_OVERRIDES[entityName] ?? entityName
}

/** Title-cased display name, since some source names are all-caps. */
export function formatEntityForTitle(entityName: EntityName): string {
    return formatEntityForSentence(entityName)
}

/**
 * Human-readable count for the subtitle, e.g. 50_632_836 → "51 million".
 */
export function formatCountWords(value: number): string {
    if (value >= 1_000_000) {
        const millions = value / 1_000_000
        const rounded =
            millions >= 10 ? Math.round(millions) : roundTo(millions, 1)
        return `${formatNumber(rounded)} million`
    }
    if (value >= 1_000) {
        return `${formatNumber(Math.round(value / 1_000))} thousand`
    }
    return formatNumber(Math.round(value))
}

/**
 * Abbreviated axis-tick label, e.g. 500_000 → "500k", 2_500_000 → "2.5M".
 */
export function formatCountShort(value: number): string {
    if (value === 0) return "0"
    const abs = Math.abs(value)
    if (abs >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`
    }
    if (abs >= 1_000) {
        return `${Math.round(value / 1_000)}k`
    }
    return formatNumber(Math.round(value))
}

export function formatShareShort(value: number): string {
    return `${roundTo(value, 0)}%`
}

export function formatPercent(fraction: number): string {
    return `${Math.round(fraction * 100)}%`
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals)
    return Math.round(value * factor) / factor
}

function formatNumber(value: number): string {
    return value.toLocaleString("en-US")
}
