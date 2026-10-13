import {
    EntityCode,
    LinkedRanking,
    OwidVariableRoundingMode,
    RankingSortOrder,
} from "@ourworldindata/types"
import {
    ALL_COUNTRIES_PEER_GROUP_NAMES,
    articulateEntity,
    checkIsVeryShortUnit,
    checkIsIncomeGroup,
    checkIsOwidContinent,
    computeRankSummary,
    formatValue,
    getRegionByCode,
    getRegionByNameOrVariantName,
    NEIGHBOURS_PEER_GROUP_NAME,
    RankSummary,
    resolvePeerGroupCodes,
} from "@ourworldindata/utils"

/** Display name of an entity code, e.g. "DEU" -> "Germany" */
export function getEntityName(code: EntityCode): string {
    return getRegionByCode(code)?.name ?? code
}

/** Entity name for use mid-sentence, e.g. "the United States" */
export function getArticulatedEntityName(code: EntityCode): string {
    return articulateEntity(getEntityName(code))
}

/** The indicator's short unit, falling back to its (long) unit */
export function getRankingUnit(
    ranking: Pick<LinkedRanking, "unit" | "shortUnit">
): string | undefined {
    // An empty short unit means "no short unit", e.g. for "deaths per
    // 100,000 live births", so fall back to the long unit then too
    const unit = (ranking.shortUnit?.trim() || ranking.unit?.trim()) ?? ""
    return unit || undefined
}

/** Units up to this length are shown next to each value in narrow columns */
const MAX_INLINE_UNIT_LENGTH = 6

/**
 * The part of a unit that fits next to a value in a narrow column (e.g. a
 * peer-ranking row), or undefined if it's too long and should be shown
 * elsewhere (e.g. as an axis label). Percent units keep their "%", e.g.
 * "% of adults" -> "%".
 */
export function getInlineUnit(unit: string | undefined): string | undefined {
    if (!unit) return undefined
    if (unit.length <= MAX_INLINE_UNIT_LENGTH || checkIsVeryShortUnit(unit))
        return unit
    if (unit.startsWith("%")) return "%"
    return undefined
}

/**
 * Formats a ranking value for display: rounded to 3 significant figures,
 * with the unit placed the way grapher does it ("$62,800", "52%", "81.4
 * years"). Values of a million or more are abbreviated ("84.1M" or "84.1
 * million").
 */
export function formatRankingValue(
    value: number,
    {
        unit,
        numberAbbreviation = "short",
    }: { unit?: string; numberAbbreviation?: "short" | "long" } = {}
): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 3,
        // Don't cap the precision of small values, e.g. 0.432 rather than
        // 0.43; we don't know the indicator's configured decimal places
        numDecimalPlaces: 12,
        numberAbbreviation,
        abbreviationThreshold: 1e6,
        unit: unit ?? "",
    })
}

const ABBREVIATION_WORD = /^(.*\d)\s+(million|billion|trillion)$/

/**
 * A ranking value split into its number and a unit to be typeset smaller,
 * e.g. "81.4" + "years", "84.5" + "million people", "$62,800", "22%" + "of
 * adults".
 */
export function formatRankingValueParts(
    value: number,
    unit: string | undefined
): { number: string; unit?: string } {
    // Currency symbols and "%" are part of the number
    const attachedUnit =
        unit && checkIsVeryShortUnit(unit)
            ? unit
            : unit?.startsWith("%")
              ? "%"
              : undefined
    const restUnit = (attachedUnit ? unit?.slice(1) : unit)?.trim()
    const formatted = formatRankingValue(value, {
        unit: attachedUnit,
        numberAbbreviation: "long",
    })
    const match = formatted.match(ABBREVIATION_WORD)
    const number = match ? match[1] : formatted
    const unitParts = [match?.[2], restUnit].filter(Boolean)
    return unitParts.length > 0
        ? { number, unit: unitParts.join(" ") }
        : { number }
}

/**
 * Maps a free-text topic (e.g. "Health", "Economic growth") to one of the
 * site's category colours, used as a BEM modifier suffix. Undefined for
 * unknown topics (rendered in the default muted blue).
 */
const TOPIC_COLOR_KEYWORDS: [RegExp, string][] = [
    [/population|demograph|migration/, "population"],
    [/health|disease|mortality|life expectancy/, "health"],
    [/food|agricultur|nutrition|hunger/, "food"],
    [/energy|electricity/, "energy"],
    [/environment|climate|co2|emission|pollution|biodiversity/, "environment"],
    [/technolog|internet|innovation/, "technology"],
    [/growth|econom|poverty|inequality|income|gdp/, "growth-inequality"],
    [/work|labou?r|life satisfaction|happiness/, "work-life"],
    [/public sector|government|tax/, "public-sector"],
    [/global connection|trade|tourism/, "global-connections"],
    [/war|peace|conflict/, "war-peace"],
    [/politic|democra/, "politics"],
    [/violence|rights|gender/, "violence-rights"],
    [/education|school|literacy/, "education"],
    [/media/, "media"],
    [/culture/, "culture"],
]

export function getTopicColorKey(
    topic: string | undefined
): string | undefined {
    if (!topic) return undefined
    const normalized = topic.trim().toLowerCase()
    return TOPIC_COLOR_KEYWORDS.find(([pattern]) =>
        pattern.test(normalized)
    )?.[1]
}

/** Removes markdown links (e.g. details-on-demand) from a chart subtitle */
export function stripMarkdownLinks(text: string): string {
    return text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
}

export interface PeerGroupOption {
    /** The group name as written in the block, e.g. "High-income countries" */
    name: string
    /** Mid-sentence description, e.g. "high-income countries" */
    description: string
    /** Whether the group contains all countries in the ranking */
    isAllCountries: boolean
}

function checkIsAllCountriesGroupName(name: string): boolean {
    return ALL_COUNTRIES_PEER_GROUP_NAMES.some(
        (candidate) => candidate.toLowerCase() === name.trim().toLowerCase()
    )
}

/** "Among <description>": how to refer to a peer group mid-sentence */
export function describePeerGroup(
    name: string,
    entityCode: EntityCode
): string {
    if (checkIsAllCountriesGroupName(name)) return "all countries"
    if (name.trim().toLowerCase() === NEIGHBOURS_PEER_GROUP_NAME.toLowerCase())
        return `${getArticulatedEntityName(entityCode)} and its neighbours`
    if (/^european union/i.test(name)) return "EU member states"
    const region = getRegionByNameOrVariantName(name.trim())
    if (region && checkIsOwidContinent(region)) return `countries in ${name}`
    if ((region && checkIsIncomeGroup(region)) || /countries$/i.test(name))
        return name.charAt(0).toLowerCase() + name.slice(1)
    return `members of ${articulateEntity(name)}`
}

export function makePeerGroupOption(
    name: string,
    entityCode: EntityCode
): PeerGroupOption {
    return {
        name,
        description: describePeerGroup(name, entityCode),
        isAllCountries: checkIsAllCountriesGroupName(name),
    }
}

/**
 * The entity's rank summary within a peer group, or undefined if the group
 * doesn't apply to the entity (e.g. "Neighbours" without neighbour data) or
 * the entity has no data.
 */
export function computePeerGroupSummary(
    ranking: LinkedRanking,
    entityCode: EntityCode,
    sort: RankingSortOrder,
    groupName: string
): { summary: RankSummary; groupCodes: Set<EntityCode> } | undefined {
    const groupCodes = resolvePeerGroupCodes(
        groupName,
        ranking.rows,
        entityCode
    )
    if (!groupCodes) return undefined
    const summary = computeRankSummary(ranking, entityCode, sort, groupCodes)
    if (!summary) return undefined
    return { summary, groupCodes }
}

/** e.g. "Up 4 places since 2013", "No change since 2013" */
export function formatRankChange(
    rankChange: number,
    sinceTime: number
): string {
    if (rankChange === 0) return `No change since ${sinceTime}`
    const places = Math.abs(rankChange) === 1 ? "place" : "places"
    return `${rankChange > 0 ? "Up" : "Down"} ${Math.abs(rankChange)} ${places} since ${sinceTime}`
}

/** e.g. "30th highest of 229" or "12th lowest of 229" */
export function formatRankOf(
    rankOrdinal: string,
    total: number,
    sort: RankingSortOrder
): string {
    return `${rankOrdinal} ${sort} of ${total}`
}

/** Position of `value` in `domain`, clamped to [0, 1] */
export function scaleToUnit(
    value: number,
    [min, max]: [number, number]
): number {
    if (max === min) return 0.5
    return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/** Like d3's tickStep: a round step size for ~`count` ticks */
function tickStep(min: number, max: number, count: number): number {
    const rawStep = Math.abs(max - min) / Math.max(1, count)
    let step = Math.pow(10, Math.floor(Math.log10(rawStep)))
    const error = rawStep / step
    if (error >= Math.sqrt(50)) step *= 10
    else if (error >= Math.sqrt(10)) step *= 5
    else if (error >= Math.sqrt(2)) step *= 2
    return step
}

export interface NiceAxis {
    domain: [number, number]
    ticks: { value: number; label: string }[]
}

/**
 * A "nice" linear axis covering [min, max] with about `count` round ticks,
 * similar to d3's `scaleLinear().domain(...).nice().ticks(count)`. A
 * `unit` is added to the tick labels; only pass very short units like "$".
 */
export function makeNiceAxis(
    min: number,
    max: number,
    count = 5,
    unit?: string
): NiceAxis {
    if (min === max) {
        const padding = Math.abs(min) * 0.1 || 1
        min -= padding
        max += padding
    }
    const step = tickStep(min, max, count)
    const start = Math.floor(min / step)
    const end = Math.ceil(max / step)
    const decimals = Math.max(0, -Math.floor(Math.log10(step)))
    const ticks: NiceAxis["ticks"] = []
    for (let i = start; i <= end; i++) {
        const value = parseFloat((i * step).toPrecision(12))
        ticks.push({
            value,
            label: formatValue(value, {
                numberAbbreviation: "short",
                numDecimalPlaces: decimals,
                unit,
            }),
        })
    }
    return {
        domain: [ticks[0].value, ticks[ticks.length - 1].value],
        ticks,
    }
}

export function median(values: number[]): number | undefined {
    if (values.length === 0) return undefined
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function mean(values: number[]): number | undefined {
    if (values.length === 0) return undefined
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

type SparklineSeries = [number, number][]
type Sparkline = NonNullable<LinkedRanking["sparkline"]>

/** How far apart (as a ratio) the World and entity ranges may be */
const MAX_WORLD_TO_ENTITY_RATIO = 5

/**
 * Whether the World series can share a y-scale with the entity's without
 * squashing it, e.g. not for absolute indicators like population (84M for
 * Germany vs 8B for the World). Only checked for positive values, where a
 * ratio is meaningful.
 */
export function checkIsWorldComparable(
    entity: SparklineSeries,
    world: SparklineSeries
): boolean {
    if (entity.length === 0 || world.length === 0) return false
    const entityValues = entity.map(([, value]) => value)
    const entityMin = Math.min(...entityValues)
    const entityMax = Math.max(...entityValues)
    const worldMax = Math.max(...world.map(([, value]) => value))
    if (entityMax > 0 && worldMax > entityMax * MAX_WORLD_TO_ENTITY_RATIO)
        return false
    if (entityMin > 0 && worldMax < entityMin / MAX_WORLD_TO_ENTITY_RATIO)
        return false
    return true
}

/**
 * The World series to overlay on the sparkline, if it's comparable. Clipped
 * to the entity's time range, which is the sparkline's x-domain, so that the
 * start and end labels match the ends of the entity's line.
 */
export function getComparableWorldSeries(
    sparkline: Sparkline
): SparklineSeries | undefined {
    const { entity, world } = sparkline
    if (!world || entity.length === 0) return undefined
    const startTime = entity[0][0]
    const endTime = entity[entity.length - 1][0]
    const clippedWorld = world.filter(
        ([time]) => time >= startTime && time <= endTime
    )
    return clippedWorld.length > 1 &&
        checkIsWorldComparable(entity, clippedWorld)
        ? clippedWorld
        : undefined
}

/**
 * Columns on wide screens: as many as fit (up to `maxColumns`), but without
 * leaving the last row mostly empty, e.g. 3 + 2 rather than 4 + 1 tiles
 */
export function getGridColumns(cardCount: number, maxColumns: number): number {
    if (cardCount <= maxColumns) return Math.max(2, cardCount)
    let best = maxColumns
    let bestFill = 0
    for (let columns = maxColumns; columns >= 2; columns--) {
        const remainder = cardCount % columns
        const fill = remainder === 0 ? 1 : remainder / columns
        if (fill > bestFill) {
            best = columns
            bestFill = fill
        }
    }
    return best
}
