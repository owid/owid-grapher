import { match } from "ts-pattern"
import {
    EnrichedBlockPeerComparison,
    EnrichedBlockPeerRanking,
    EnrichedBlockRankingCards,
    EntityCode,
    GRAPHER_QUERY_PARAM_KEYS,
    LinkedRanking,
    LinkedRankingRow,
    LinkedRankings,
    OwidEnrichedGdocBlock,
    RankingSortOrder,
} from "@ourworldindata/types"
import {
    checkHasMembers,
    checkIsCountry,
    checkIsIncomeGroup,
    checkIsOwidContinent,
    getCountryNamesForRegion,
    getParentRegions,
    getRegionByCode,
    getRegionByName,
    getRegionByNameOrVariantName,
} from "./regions/index.js"
import { neighboursData } from "./regions/neighbours.data.js"
import { Url } from "./urls/Url.js"

/**
 * Ranking utils, shared by the server (computing `linkedRankings`
 * attachments), the gdoc pipeline (validation, markdown) and the site
 * (rendering ranking-cards, peer-ranking and peer-comparison blocks).
 *
 * The heavy lifting (reading values of all countries from a chart's table)
 * happens in `computeRankingFromPreparedTable` in @ourworldindata/grapher;
 * everything here operates on the resulting {@link LinkedRanking}.
 */

/** Gdoc blocks that are backed by `linkedRankings` */
export type EnrichedBlockWithRankings =
    | EnrichedBlockRankingCards
    | EnrichedBlockPeerRanking
    | EnrichedBlockPeerComparison

/** Peer group names that mean "all countries in the ranking" */
export const ALL_COUNTRIES_PEER_GROUP_NAMES = ["World", "All countries"]

/** The peer group name used for the default "all countries" group */
export const WORLD_PEER_GROUP_NAME = "World"

const EU_27_NAME = "European Union (27)"

/**
 * Peer group of a country and its land neighbours (see `neighbours.data.ts`,
 * generated from the world map's borders)
 */
export const NEIGHBOURS_PEER_GROUP_NAME = "Neighbours"

function checkIsNeighboursPeerGroup(groupName: string): boolean {
    return (
        groupName.trim().toLowerCase() ===
        NEIGHBOURS_PEER_GROUP_NAME.toLowerCase()
    )
}

/** Codes of the entity's land neighbours, or undefined if it has none (e.g. islands) */
function getNeighbourCodes(entityCode: EntityCode): EntityCode[] | undefined {
    return neighboursData[entityCode]
}

/**
 * Everything needed to compute (server) and look up (client) one
 * {@link LinkedRanking}. Two specs with the same `key` describe the same
 * ranking; they can only differ in `includeSparkline`, which should be
 * merged with OR.
 */
export interface RankingSpec {
    /** Key into `linkedRankings`, see {@link makeLinkedRankingKey} */
    key: string
    /** The chart URL as written in the block (after profile instantiation) */
    url: string
    /** Short name of the y column to rank by; first y column if undefined */
    column?: string
    /** Tolerance in years; falls back to the column's tolerance if undefined */
    tolerance?: number
    /** If set, rows get a `prevValue` from `time - changeSinceYears` */
    changeSinceYears?: number
    /** Whether the entity-vs-World sparkline should be attached */
    includeSparkline: boolean
}

export interface LinkedRankingKeyOptions {
    column?: string
    tolerance?: number
    changeSinceYears?: number
}

/**
 * Key for {@link LinkedRankings}. Rankings don't depend on the selected
 * entity, so all grapher query params except `time` (which determines the
 * ranking time) are dropped, as is the origin. Non-grapher params (e.g.
 * multi-dim or explorer choices) are kept, so that different views get
 * different keys. Options that change the computed values are appended.
 *
 * e.g. ("https://ourworldindata.org/grapher/life-expectancy?country=~DEU&time=2020", { column: "le" })
 *   -> "/grapher/life-expectancy?time=2020|column=le"
 */
export function makeLinkedRankingKey(
    url: string,
    options: LinkedRankingKeyOptions = {}
): string {
    const params = Object.fromEntries(
        GRAPHER_QUERY_PARAM_KEYS.filter((key) => key !== "time").map((key) => [
            key,
            undefined,
        ])
    )
    const stripped = Url.fromURL(url).updateQueryParams(params)
    const suffixes = [
        options.column !== undefined ? `column=${options.column}` : undefined,
        options.tolerance !== undefined
            ? `tolerance=${options.tolerance}`
            : undefined,
        options.changeSinceYears !== undefined
            ? `changeSince=${options.changeSinceYears}`
            : undefined,
    ].filter((suffix): suffix is string => suffix !== undefined)
    return [(stripped.pathname ?? "") + stripped.queryStr, ...suffixes].join(
        "|"
    )
}

/**
 * The code of the single country in a chart URL's `country` param, e.g.
 * "DEU" for `?country=~DEU` or `?country=DEU`. Entity names are mapped to
 * codes. Returns undefined if there is no param, more than one entity, or
 * the entity is unknown.
 */
export function getEntityCodeFromChartUrl(url: string): EntityCode | undefined {
    const param = Url.fromURL(url).queryParams.country
    if (!param) return undefined
    const entities = param.split("~").filter((entity) => entity)
    if (entities.length !== 1) return undefined
    const region = getRegionByCode(entities[0]) ?? getRegionByName(entities[0])
    return region?.code
}

/**
 * Whether `groupName` can be used as a peer group: "World", "All countries",
 * "Neighbours", or any region (by name or variant name) that has members,
 * e.g. "Europe", "High-income countries", "European Union (27)".
 * Note that "Neighbours" is only available for entities with land
 * neighbours, see
 * {@link resolvePeerGroupCodes}.
 */
export function checkIsPeerGroupName(groupName: string): boolean {
    if (checkIsAllCountriesPeerGroup(groupName)) return true
    if (checkIsNeighboursPeerGroup(groupName)) return true
    return checkHasMembers(getRegionByNameOrVariantName(groupName))
}

function checkIsAllCountriesPeerGroup(groupName: string): boolean {
    return ALL_COUNTRIES_PEER_GROUP_NAMES.some(
        (name) => name.toLowerCase() === groupName.trim().toLowerCase()
    )
}

/**
 * The codes of all rows that belong to the peer group `groupName`.
 * "World"/"All countries" includes all rows; "Neighbours" includes the
 * entity itself and its neighbours; other groups include rows whose country
 * is a (possibly nested) member of the region.
 * Returns undefined if the group is unknown, or if it is "Neighbours" and
 * `entityCode` has no land neighbours (callers should skip the
 * group for this entity).
 */
export function resolvePeerGroupCodes(
    groupName: string,
    rows: LinkedRankingRow[],
    entityCode?: EntityCode
): Set<EntityCode> | undefined {
    if (checkIsAllCountriesPeerGroup(groupName))
        return new Set(rows.map((row) => row.code))

    if (checkIsNeighboursPeerGroup(groupName)) {
        const neighbours =
            entityCode !== undefined ? getNeighbourCodes(entityCode) : undefined
        if (!neighbours || entityCode === undefined) return undefined
        const groupCodes = new Set([entityCode, ...neighbours])
        return new Set(
            rows.map((row) => row.code).filter((code) => groupCodes.has(code))
        )
    }

    const region = getRegionByNameOrVariantName(groupName.trim())
    if (!checkHasMembers(region)) return undefined

    const memberCodes = new Set(
        getCountryNamesForRegion(region)
            .map((name) => getRegionByName(name)?.code)
            .filter((code): code is string => code !== undefined)
    )
    return new Set(
        rows.map((row) => row.code).filter((code) => memberCodes.has(code))
    )
}

/**
 * The peer groups to offer when a block doesn't specify any: the country's
 * neighbours (if it has any), its continent, its income group,
 * the EU if it's a member, and the World.
 * Returns an empty list if `code` is not a country.
 */
export function defaultPeerGroupsForEntity(code: EntityCode): string[] {
    const region = getRegionByCode(code)
    if (!region || !checkIsCountry(region)) return []

    const parents = getParentRegions(region.name)
    const continent = parents.find(checkIsOwidContinent)
    const incomeGroup = parents.find(checkIsIncomeGroup)
    const isEuMember = parents.some((parent) => parent.name === EU_27_NAME)

    return [
        getNeighbourCodes(code) ? NEIGHBOURS_PEER_GROUP_NAME : undefined,
        continent?.name,
        incomeGroup?.name,
        isEuMember ? EU_27_NAME : undefined,
        WORLD_PEER_GROUP_NAME,
    ].filter((name): name is string => name !== undefined)
}

export interface RankedRow {
    row: LinkedRankingRow
    /** Competition rank (1, 2, 2, 4), 1 = best according to the sort order */
    rank: number
}

/**
 * Sorts rows best-first according to `sort` and assigns competition ranks
 * (ties share a rank, the next rank is skipped). Ties are ordered by code
 * so the result is deterministic.
 */
export function rankRows(
    rows: LinkedRankingRow[],
    sort: RankingSortOrder
): RankedRow[] {
    const direction = sort === "highest" ? -1 : 1
    const sorted = [...rows].sort(
        (a, b) =>
            direction * (a.value - b.value) || a.code.localeCompare(b.code)
    )
    const ranked: RankedRow[] = []
    sorted.forEach((row, index) => {
        const previous = ranked[index - 1]
        const rank =
            previous && previous.row.value === row.value
                ? previous.rank
                : index + 1
        ranked.push({ row, rank })
    })
    return ranked
}

export interface RankSummary {
    /** Competition rank within the group, 1 = best according to the sort order */
    rank: number
    /** Number of countries in the group that have data */
    total: number
    /**
     * Value-based position in [0, 1], independent of the sort order:
     * 0 = lowest value in the group, 1 = highest. 1 if the group has a single row.
     */
    percentile: number
    /** "Top X%": ceil(rank / total * 100) */
    topPercent: number
    /** Rank at the ranking's `prevTime` among group rows with a `prevValue` */
    prevRank?: number
    /** Number of group rows with a `prevValue` */
    prevTotal?: number
    /** prevRank - rank; positive means the entity moved up (improved) */
    rankChange?: number
    /** The entity's row */
    row: LinkedRankingRow
}

const competitionRank = (
    values: number[],
    value: number,
    sort: RankingSortOrder
): number =>
    1 +
    values.filter((other) =>
        sort === "highest" ? other > value : other < value
    ).length

/**
 * Rank of `entityCode` in `ranking`, optionally restricted to the rows in
 * `groupCodes` (see {@link resolvePeerGroupCodes}). Returns undefined if
 * the entity has no row, or isn't part of the group.
 */
export function computeRankSummary(
    ranking: LinkedRanking,
    entityCode: EntityCode,
    sort: RankingSortOrder,
    groupCodes?: Set<EntityCode>
): RankSummary | undefined {
    const rows = groupCodes
        ? ranking.rows.filter((row) => groupCodes.has(row.code))
        : ranking.rows
    const row = rows.find((row) => row.code === entityCode)
    if (!row) return undefined

    const values = rows.map((row) => row.value)
    const total = rows.length
    const rank = competitionRank(values, row.value, sort)
    const rankFromHighest = competitionRank(values, row.value, "highest")
    const percentile = total > 1 ? (total - rankFromHighest) / (total - 1) : 1
    const topPercent = Math.ceil((rank / total) * 100)

    const summary: RankSummary = { rank, total, percentile, topPercent, row }

    if (row.prevValue !== undefined) {
        const prevValues = rows
            .map((row) => row.prevValue)
            .filter((value): value is number => value !== undefined)
        summary.prevRank = competitionRank(prevValues, row.prevValue, sort)
        summary.prevTotal = prevValues.length
        summary.rankChange = summary.prevRank - rank
    }

    return summary
}

/** English ordinal, e.g. 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd" */
export function formatOrdinal(n: number): string {
    const mod100 = Math.abs(n) % 100
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`
    const suffix = match(Math.abs(n) % 10)
        .with(1, () => "st")
        .with(2, () => "nd")
        .with(3, () => "rd")
        .otherwise(() => "th")
    return `${n}${suffix}`
}

/** Type guard for the blocks backed by `linkedRankings` */
export function checkIsBlockWithRankings(
    block: OwidEnrichedGdocBlock
): block is EnrichedBlockWithRankings {
    return (
        block.type === "ranking-cards" ||
        block.type === "peer-ranking" ||
        block.type === "peer-comparison"
    )
}

/**
 * The rankings a block needs, in display order (one per card / indicator).
 * This is the single source of truth for which keys the server computes
 * and the site looks up.
 */
export function getRankingSpecsForBlock(
    block: EnrichedBlockWithRankings
): RankingSpec[] {
    const makeSpec = (
        url: string,
        options: LinkedRankingKeyOptions,
        includeSparkline = false
    ): RankingSpec => ({
        key: makeLinkedRankingKey(url, options),
        url,
        ...options,
        includeSparkline,
    })

    return match(block)
        .with({ type: "ranking-cards" }, (block) =>
            block.cards.map((card) =>
                makeSpec(
                    card.url,
                    {
                        column: card.column,
                        changeSinceYears: block.changeSinceYears,
                    },
                    block.sparklines
                )
            )
        )
        .with({ type: "peer-ranking" }, (block) => [
            makeSpec(block.url, {
                column: block.column,
                tolerance: block.tolerance,
            }),
        ])
        .with({ type: "peer-comparison" }, (block) =>
            block.indicators.map((indicator) =>
                makeSpec(indicator.url, { column: indicator.column })
            )
        )
        .exhaustive()
}

/** Look up the ranking for a spec; undefined if it wasn't computed */
export function getLinkedRanking(
    linkedRankings: LinkedRankings,
    spec: Pick<RankingSpec, "key">
): LinkedRanking | undefined {
    return linkedRankings[spec.key]
}

/** Whether the ranking exists and contains a row for the entity */
export function checkHasEntityRanking(
    ranking: LinkedRanking | undefined,
    entityCode: EntityCode | undefined
): boolean {
    if (!ranking || !entityCode) return false
    return ranking.rows.some((row) => row.code === entityCode)
}

/**
 * Whether a ranking block has anything to show for the entity: at least one
 * card / indicator (or the single peer-ranking chart) has a ranking with a
 * row for the entity. Cards/indicators without data are expected to be
 * hidden individually. `entityCode` defaults to the country in each URL.
 */
export function checkShouldRankingBlockRender(
    block: EnrichedBlockWithRankings,
    linkedRankings: LinkedRankings,
    entityCode?: EntityCode
): boolean {
    return getRankingSpecsForBlock(block).some((spec) =>
        checkHasEntityRanking(
            getLinkedRanking(linkedRankings, spec),
            entityCode ?? getEntityCodeFromChartUrl(spec.url)
        )
    )
}
