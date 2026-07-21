import { regions } from "@ourworldindata/utils"

import type {
    CountryInfo,
    CuratedGlobal,
    CuratedMetric,
    RefinementEntry,
    Refinements,
} from "../types.js"
import curatedGlobalJson from "../data/curated-global.json"
import refinementsJson from "../data/curated-refinements.json"
import countriesJson from "../data/countries.json"

export const WORLD_CODE = "OWID_WRL"
export const HIGHLIGHTS_LABEL = "Highlights"
/** Rows shown on the cross-topic Highlights view */
export const HIGHLIGHTS_TARGET = 8
/** Rows shown per topic */
export const TOPIC_TARGET = 6

export const CURATED_GLOBAL = curatedGlobalJson as CuratedGlobal
export const REFINEMENTS = refinementsJson as Refinements
export const COUNTRIES = countriesJson as CountryInfo[]

export const TOPICS: string[] = Object.keys(CURATED_GLOBAL.topics)

export const COUNTRIES_BY_CODE = new Map<string, CountryInfo>(
    COUNTRIES.map((c) => [c.code, c])
)
export const COUNTRIES_SORTED: CountryInfo[] = [...COUNTRIES].sort((a, b) =>
    a.name.localeCompare(b.name)
)

/** Friendly names for the comparison entities (World / continents / income groups) */
export const ENTITY_NAME: Record<string, string> = {
    OWID_WRL: "World",
    OWID_AFR: "Africa",
    OWID_ASI: "Asia",
    OWID_EUR: "Europe",
    OWID_NAM: "North America",
    OWID_SAM: "South America",
    OWID_OCE: "Oceania",
    OWID_HIC: "High-income countries",
    OWID_UMC: "Upper-middle-income",
    OWID_LMC: "Lower-middle-income",
    OWID_LIC: "Low-income countries",
}

/** The comparison entities available for a country: World + its continent + its income group */
export function comparisonOptionsFor(code: string): string[] {
    const country = COUNTRIES_BY_CODE.get(code)
    const options = [WORLD_CODE]
    if (country?.continent) options.push(country.continent)
    if (country?.income) options.push(country.income)
    return options
}

/** Per-country edits to the spine for a topic: exclusions to hide, promotions to lead with */
export function refinementsFor(
    code: string,
    topic: string
): { excludeSet: Set<string>; promote: CuratedMetric[] } {
    const ref: RefinementEntry = REFINEMENTS.countries[code]?.[topic] ?? {}
    return {
        excludeSet: new Set((ref.exclude ?? []).map((e) => e.slug)),
        promote: ref.promote ?? [],
    }
}

/**
 * The candidate metrics for a country+topic, in display order: promotions lead,
 * the country's exclusions are dropped, the rest of the spine follows. The
 * Highlights view takes the spine's cross-topic list with exclusions applied
 * per subtopic.
 */
export function metricPoolFor(code: string, topic: string): CuratedMetric[] {
    let pool: CuratedMetric[]
    if (topic === HIGHLIGHTS_LABEL) {
        pool = CURATED_GLOBAL.highlights.filter(
            (m) => !refinementsFor(code, m.subtopic).excludeSet.has(m.slug)
        )
    } else {
        const { excludeSet, promote } = refinementsFor(code, topic)
        pool = [
            ...promote,
            ...(CURATED_GLOBAL.topics[topic] ?? []).filter(
                (m) => !excludeSet.has(m.slug)
            ),
        ]
    }
    const seen = new Set<string>()
    return pool.filter((m) => {
        if (seen.has(m.slug)) return false
        seen.add(m.slug)
        return true
    })
}

const ISO2_BY_CODE = new Map<string, string>(
    regions.flatMap((r) =>
        "shortCode" in r && r.shortCode ? [[r.code, r.shortCode] as const] : []
    )
)

/** Flag emoji for an ISO3 country code, 🌍 when unknown */
export function countryFlag(code3: string): string {
    const iso2 = ISO2_BY_CODE.get(code3)
    if (!iso2 || iso2.length !== 2) return "🌍"
    return String.fromCodePoint(
        ...[...iso2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    )
}

/**
 * Some topic pills line up with an OWID country profile — a curated deep-dive
 * for that topic+country. Environment spans two profiles (energy + emissions).
 */
export const PROFILE_TOPICS: Record<string, [string, string][]> = {
    Health: [["health", "Health"]],
    "Population & Demography": [
        ["population-demography", "Population & Demography"],
    ],
    Environment: [
        ["energy", "Energy"],
        ["co2", "CO₂ & greenhouse gases"],
    ],
}

/** OWID country-profile URLs use the entity slug (lowercase, accent-stripped, hyphenated) */
export function countryProfileSlug(name: string): string {
    return name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}
