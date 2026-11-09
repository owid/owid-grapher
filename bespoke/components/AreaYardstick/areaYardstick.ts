/**
 * Turns an area in hectares into comparisons a reader has an intuition for:
 * the side of a square with that area, a count of football pitches for small
 * areas, and a familiar place of about the same size ("a bit larger than
 * Berlin").
 *
 * Visitors from the US get miles, feet, acres and American references;
 * everyone else gets metric units and European references.
 */

export type UnitSystem = "metric" | "imperial"
export type ReferenceSet = "europe" | "us"

export interface AreaAudience {
    units: UnitSystem
    references: ReferenceSet
}

export const DEFAULT_AREA_AUDIENCE: AreaAudience = {
    units: "metric",
    references: "europe",
}

/** ISO 3166-1 alpha-2 codes of the US and its territories */
const US_SHORT_CODES = new Set(["US", "PR", "GU", "VI", "AS", "MP"])

/** The audience for a visitor from the given country (ISO 3166-1 alpha-2
 *  code). Unknown visitors get the default, metric and European. */
export function audienceForCountry(shortCode?: string): AreaAudience {
    if (shortCode && US_SHORT_CODES.has(shortCode.toUpperCase()))
        return { units: "imperial", references: "us" }
    return DEFAULT_AREA_AUDIENCE
}

export interface ReferenceArea {
    /** As it reads after "the size of", e.g. "Belgium", "the city of Paris" */
    name: string
    hectares: number
    /** Places most readers know get picked over equally good fits */
    isWellKnown?: boolean
}

/** A unit small areas are counted in, e.g. "about 40 football pitches" */
interface CountableArea {
    singular: string
    plural: string
    hectares: number
}

// Areas checked against Wikipedia infoboxes and the statistics offices they
// cite (November 2026), rounded to three significant figures. Countries and
// US states are total areas, inland and coastal water included (US Census
// totals for the states); UK areas are ONS Standard Area Measurements; cities
// are their administrative area, land only for Manhattan and New York City,
// as those are usually quoted. France is metropolitan France (INSEE).
const EUROPEAN_REFERENCES: ReferenceArea[] = [
    { name: "Hyde Park in London", hectares: 142 }, // 350 acres
    { name: "Monaco", hectares: 208, isWellKnown: true }, // 2.084 km²
    { name: "the city of Paris", hectares: 10_500, isWellKnown: true }, // 105.4 km²
    { name: "Amsterdam", hectares: 21_900 }, // 219.3 km²
    { name: "Berlin", hectares: 89_100, isWellKnown: true }, // 891.3 km²
    { name: "Greater London", hectares: 157_000, isWellKnown: true }, // 1,572 km²
    { name: "Luxembourg", hectares: 259_000, isWellKnown: true }, // 2,586 km²
    { name: "Cyprus", hectares: 925_000 }, // 9,251 km²
    { name: "Wales", hectares: 2_070_000 }, // 20,737 km²
    { name: "Belgium", hectares: 3_070_000, isWellKnown: true }, // 30,689 km²
    { name: "Switzerland", hectares: 4_130_000, isWellKnown: true }, // 41,291 km²
    { name: "Austria", hectares: 8_390_000, isWellKnown: true }, // 83,879 km²
    { name: "Portugal", hectares: 9_220_000, isWellKnown: true }, // 92,225 km²
    { name: "England", hectares: 13_000_000 }, // 130,310 km²
    { name: "Greece", hectares: 13_200_000 }, // 131,957 km²
    { name: "the United Kingdom", hectares: 24_200_000, isWellKnown: true }, // 242,494 km²
    { name: "Germany", hectares: 35_700_000, isWellKnown: true }, // 357,022–357,588 km²
    { name: "Spain", hectares: 50_600_000, isWellKnown: true }, // 506,030 km²
    { name: "France", hectares: 54_400_000, isWellKnown: true }, // 543,908 km²
    { name: "Egypt", hectares: 101_000_000 }, // 1,010,408 km²
    { name: "India", hectares: 329_000_000, isWellKnown: true }, // 3,287,263 km²
    { name: "the European Union", hectares: 423_000_000, isWellKnown: true }, // 4,225,104 km²
    { name: "Brazil", hectares: 851_000_000, isWellKnown: true }, // 8,510,346 km²
]

const US_REFERENCES: ReferenceArea[] = [
    { name: "Central Park", hectares: 341, isWellKnown: true }, // 843 acres
    { name: "Manhattan", hectares: 5_870, isWellKnown: true }, // 22.66 sq mi land
    { name: "Washington, D.C.", hectares: 17_700, isWellKnown: true }, // 68.35 sq mi
    { name: "New York City", hectares: 77_800, isWellKnown: true }, // 300.5 sq mi land
    { name: "Rhode Island", hectares: 400_000, isWellKnown: true }, // 1,545 sq mi
    { name: "Delaware", hectares: 645_000 }, // 2,489 sq mi
    { name: "Connecticut", hectares: 1_440_000, isWellKnown: true }, // 14,356 km²
    { name: "New Jersey", hectares: 2_260_000, isWellKnown: true }, // 22,591 km²
    { name: "Maryland", hectares: 3_210_000 }, // 32,133 km²
    { name: "West Virginia", hectares: 6_280_000 }, // 62,756 km²
    { name: "Maine", hectares: 9_160_000 }, // 91,633 km²
    { name: "Virginia", hectares: 11_100_000 }, // 110,786 km²
    { name: "Pennsylvania", hectares: 11_900_000, isWellKnown: true }, // 119,283 km²
    { name: "New York State", hectares: 14_100_000, isWellKnown: true }, // 141,298 km²
    { name: "Florida", hectares: 17_000_000, isWellKnown: true }, // 170,312 km²
    { name: "Michigan", hectares: 25_000_000 }, // 250,493 km²
    { name: "California", hectares: 42_400_000, isWellKnown: true }, // 423,970 km²
    { name: "Texas", hectares: 69_600_000, isWellKnown: true }, // 695,662 km²
    { name: "Alaska", hectares: 172_000_000, isWellKnown: true }, // 665,384 sq mi
    { name: "India", hectares: 329_000_000 }, // 3,287,263 km²
    { name: "the contiguous United States", hectares: 808_000_000 }, // 8,081,869 km²
]

/** FIFA's recommended pitch, 105 × 68 m */
const FOOTBALL_PITCH: CountableArea = {
    singular: "football pitch",
    plural: "football pitches",
    hectares: 0.714,
}

/** 360 × 160 ft, end zones included */
const AMERICAN_FOOTBALL_FIELD: CountableArea = {
    singular: "football field",
    plural: "football fields",
    hectares: 0.535,
}

const REFERENCES: Record<ReferenceSet, ReferenceArea[]> = {
    europe: EUROPEAN_REFERENCES,
    us: US_REFERENCES,
}

const COUNTABLES: Record<ReferenceSet, CountableArea> = {
    europe: FOOTBALL_PITCH,
    us: AMERICAN_FOOTBALL_FIELD,
}

const SQUARE_METERS_PER_HECTARE = 10_000
const METERS_PER_MILE = 1_609.344
const METERS_PER_FOOT = 0.3048
const ACRES_PER_HECTARE = 2.471_05

/** Areas are counted in pitches only while the count is still graspable */
const MAX_COUNTABLE_HECTARES = 300

/** Ratios to a reference and how they read. Ordered by ratio. */
const RATIO_PHRASES: { max: number; phrase: (ratio: number) => string }[] = [
    { max: 0.22, phrase: () => "about a fifth the size of" },
    { max: 0.29, phrase: () => "about a quarter the size of" },
    { max: 0.4, phrase: () => "about a third the size of" },
    { max: 0.62, phrase: () => "about half the size of" },
    { max: 0.85, phrase: () => "a bit smaller than" },
    { max: 1.2, phrase: () => "about the size of" },
    { max: 1.6, phrase: () => "a bit larger than" },
    { max: 2.5, phrase: () => "about twice the size of" },
    { max: 3.5, phrase: () => "about three times the size of" },
    {
        max: Infinity,
        phrase: (ratio) =>
            `about ${formatCount(roundToNiceNumber(ratio))} times the size of`,
    },
]

const MIN_RATIO = 0.18
/** A lesser-known place has to fit this much better (in log space) to win */
const WELL_KNOWN_BONUS = Math.log(1.3)

export interface AreaComparison {
    /** e.g. "about the size of", "a bit larger than" */
    phrase: string
    reference: ReferenceArea
    /** The area divided by the reference's */
    ratio: number
}

export interface AreaYardstickDescription {
    /** Side of a square with the same area, e.g. "35 km" or "20 miles" */
    squareSide: string
    /** e.g. "about 40 football pitches", for small areas only */
    count?: string
    /** A familiar place of about the same size */
    comparison?: AreaComparison
    /** e.g. "about 290,000 acres", for imperial audiences only */
    acres?: string
}

export function describeArea(
    hectares: number,
    audience: AreaAudience = DEFAULT_AREA_AUDIENCE
): AreaYardstickDescription | undefined {
    if (!Number.isFinite(hectares) || hectares <= 0) return undefined

    return {
        squareSide: formatSquareSide(hectares, audience.units),
        count: describeCount(hectares, COUNTABLES[audience.references]),
        comparison: findComparison(hectares, REFERENCES[audience.references]),
        acres:
            audience.units === "imperial"
                ? `about ${formatCount(roundToNiceNumber(hectares * ACRES_PER_HECTARE))} acres`
                : undefined,
    }
}

/** A one-line version for small spaces, e.g. "About the size of Belgium" */
export function describeAreaBriefly(
    hectares: number,
    audience: AreaAudience = DEFAULT_AREA_AUDIENCE
): string | undefined {
    const description = describeArea(hectares, audience)
    if (!description) return undefined
    const { comparison, count } = description
    const text = comparison
        ? `${comparison.phrase} ${comparison.reference.name}`
        : count
    return text ? capitalize(text) : undefined
}

export function findComparison(
    hectares: number,
    references: ReferenceArea[]
): AreaComparison | undefined {
    let best: { score: number; comparison: AreaComparison } | undefined
    for (const reference of references) {
        const ratio = hectares / reference.hectares
        if (ratio < MIN_RATIO) continue
        const score =
            Math.abs(Math.log(ratio)) -
            (reference.isWellKnown ? WELL_KNOWN_BONUS : 0)
        if (!best || score < best.score) {
            const phrase = RATIO_PHRASES.find((p) => ratio <= p.max)!
            best = {
                score,
                comparison: { phrase: phrase.phrase(ratio), reference, ratio },
            }
        }
    }
    return best?.comparison
}

function describeCount(
    hectares: number,
    countable: CountableArea
): string | undefined {
    if (hectares > MAX_COUNTABLE_HECTARES) return undefined
    const count = hectares / countable.hectares
    if (count < 0.75) {
        if (count < 0.15) return undefined
        if (count < 0.4) return `about a quarter of a ${countable.singular}`
        return `about half a ${countable.singular}`
    }
    const rounded = roundToNiceNumber(count)
    if (rounded === 1) return `about one ${countable.singular}`
    return `about ${formatCount(rounded)} ${countable.plural}`
}

function formatSquareSide(hectares: number, units: UnitSystem): string {
    const sideInMeters = Math.sqrt(hectares * SQUARE_METERS_PER_HECTARE)
    if (units === "imperial") {
        const miles = sideInMeters / METERS_PER_MILE
        if (miles >= 0.25) return formatLength(miles, "mile", "miles")
        return formatLength(sideInMeters / METERS_PER_FOOT, "foot", "feet")
    }
    if (sideInMeters >= 1_000)
        return formatLength(sideInMeters / 1_000, "km", "km")
    return formatLength(sideInMeters, "m", "m")
}

function formatLength(value: number, singular: string, plural: string): string {
    const rounded = roundToNiceNumber(value)
    return `${formatCount(rounded)} ${rounded === 1 ? singular : plural}`
}

const NICE_MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10]

/** Rounds to a coarse, round-looking number: 34.5 → 35, 1,190 → 1,200 */
export function roundToNiceNumber(value: number): number {
    if (value <= 0) return 0
    const magnitude = 10 ** Math.floor(Math.log10(value))
    const mantissa = value / magnitude
    const nice = NICE_MANTISSAS.reduce((a, b) =>
        Math.abs(b - mantissa) < Math.abs(a - mantissa) ? b : a
    )
    // toPrecision drops floating point noise like 0.30000000000000004
    return Number((nice * magnitude).toPrecision(3))
}

/** e.g. "35", "1,200", "70 million" */
function formatCount(value: number): string {
    if (value >= 1e9) return `${formatCount(value / 1e9)} billion`
    if (value >= 1e6) return `${formatCount(value / 1e6)} million`
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}
