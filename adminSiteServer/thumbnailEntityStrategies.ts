import * as R from "remeda"
import * as _ from "lodash-es"
import {
    GrapherState,
    loadCatalogData,
    prepareEntitiesForPeerSelection,
    selectPeerCountries,
    selectPeerCountriesForGrapher,
} from "@ourworldindata/grapher"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    OwidTableSlugs,
    PeerCountryStrategy,
} from "@ourworldindata/types"
import {
    checkIsCountry,
    getAggregates,
    getContinents,
    getRegionByName,
} from "@ourworldindata/utils"
import { CATALOG_URL } from "../settings/serverSettings.js"

export type StrategyId =
    | "author"
    | "authorTrimmed"
    | "readerCountry"
    | "continents"
    | "evenClosest"
    | "evenPopulous"
    | "rankPercentiles"
    | "naturalBreaksClosest"
    | "naturalBreaksPopulous"
    | "movers"
    | "dataRange"

export const STRATEGIES: {
    id: StrategyId
    name: string
    description: string
    isSetApart?: boolean
}[] = [
    {
        id: "author",
        name: "As configured",
        description: "The author's default selection",
    },
    {
        id: "readerCountry",
        name: "Reader's country",
        description:
            "The reader's country, then the chart's peer strategy (dataRange if unset)",
    },
    {
        id: "evenPopulous",
        name: "Even values, most populous",
        description: "Evenly spaced values, most populous per bucket",
    },
    {
        id: "dataRange",
        name: "dataRange today",
        description:
            "Production's dataRange: countries with a value in exactly the chart's end year, in equal-count buckets by rank, most populous per bucket",
    },
    {
        id: "naturalBreaksPopulous",
        name: "Natural breaks, most populous",
        description:
            "Groups split where the gaps between values are largest (Jenks), the most populous country in each, from countries with at least 1 million people",
        isSetApart: true,
    },
    {
        id: "evenClosest",
        name: "Even values, closest",
        description: "Evenly spaced values, the country closest to each",
        isSetApart: true,
    },
    {
        id: "naturalBreaksClosest",
        name: "Natural breaks, closest",
        description:
            "Groups split where the gaps between values are largest (Jenks), the country closest to each group's mean, from countries with at least 1 million people",
        isSetApart: true,
    },
    {
        id: "authorTrimmed",
        name: "As configured, trimmed",
        description: "The author's selection cut to the budget by rank",
        isSetApart: true,
    },
    {
        id: "continents",
        name: "Continents",
        description:
            "OWID continents, else another set of regions, cut to the budget by rank. Hidden if the chart has neither",
        isSetApart: true,
    },
    {
        id: "rankPercentiles",
        name: "Rank percentiles",
        description:
            "Lowest, highest and evenly spaced ranks between, from countries with at least 1 million people",
        isSetApart: true,
    },
    {
        id: "movers",
        name: "Biggest movers",
        description:
            "Largest and smallest change since the year by which half the countries have data, from countries with at least 1 million people",
        isSetApart: true,
    },
]

/** Longest window, in years, that an entity's latest value may come from */
const MAX_LATEST_VALUE_WINDOW_YEARS = 10

/** Fewest countries with data for coverage to be measured over countries alone */
const MIN_COUNTRIES_FOR_COVERAGE = 10

/** Share of countries whose latest value the coverage-based window must include */
const LATEST_VALUE_COVERAGE = 0.8

export interface LatestValueWindow {
    /** How far before the chart's end time a latest value may come from, in the chart's time unit */
    window: number
    unit: "years" | "days"
    source: "indicator tolerance" | "coverage" | "cap" | "plotted time"
    /** Share of countries with data in the chart that have a value within the window */
    coverage: number
}

const latestValueWindows = new WeakMap<GrapherState, LatestValueWindow>()

/**
 * None for discrete bars and dumbbells, which only consider the plotted
 * time. Otherwise the indicator's own tolerance if it sets one, or else the
 * shortest window that includes LATEST_VALUE_COVERAGE of the countries with
 * data in the chart; at most MAX_LATEST_VALUE_WINDOW_YEARS either way
 */
export function findLatestValueWindow(
    grapherState: GrapherState
): LatestValueWindow {
    const cached = latestValueWindows.get(grapherState)
    if (cached) return cached

    const isDaily = grapherState.table.timeColumn.slug === OwidTableSlugs.Day
    const unit = isDaily ? "days" : "years"
    const maxWindow = MAX_LATEST_VALUE_WINDOW_YEARS * (isDaily ? 365 : 1)
    const startTime = grapherState.startTime ?? -Infinity
    const endTime = findLatestValueEndTime(grapherState)

    // How long before the end time each country's latest value is, or each
    // entity's if the chart has few countries
    const latestTimes = [
        ...findTimesNear(grapherState, (rows) =>
            rows
                .filter(
                    (row) =>
                        row.originalTime >= startTime &&
                        row.originalTime <= endTime
                )
                .at(-1)
        ),
    ]
    const countryTimes = latestTimes.filter(([entityName]) => {
        const region = getRegionByName(entityName)
        return region !== undefined && checkIsCountry(region)
    })
    const ages = (
        countryTimes.length >= MIN_COUNTRIES_FOR_COVERAGE
            ? countryTimes
            : latestTimes
    ).map(([, time]) => endTime - time)
    const coverageOf = (window: number): number =>
        ages.length > 0
            ? ages.filter((age) => age <= window).length / ages.length
            : 0

    const slug = grapherState.yColumnSlug
    const column = slug ? grapherState.table.get(slug) : undefined
    const indicatorTolerance =
        column?.display?.tolerance ?? column?.def.tolerance
    let result: LatestValueWindow
    if (
        grapherState.activeTab === GRAPHER_TAB_NAMES.DiscreteBar ||
        grapherState.activeTab === GRAPHER_TAB_NAMES.Dumbbell
    ) {
        result = {
            window: 0,
            unit,
            source: "plotted time",
            coverage: coverageOf(0),
        }
    } else if (indicatorTolerance !== undefined) {
        const window = Math.min(indicatorTolerance, maxWindow)
        result = {
            window,
            unit,
            source: "indicator tolerance",
            coverage: coverageOf(window),
        }
    } else {
        const sortedAges = R.sortBy(ages, (age) => age)
        const coveringWindow =
            sortedAges[Math.ceil(LATEST_VALUE_COVERAGE * sortedAges.length) - 1]
        const window = Math.min(coveringWindow ?? maxWindow, maxWindow)
        result = {
            window,
            unit,
            source:
                coveringWindow !== undefined && coveringWindow <= maxWindow
                    ? "coverage"
                    : "cap",
            coverage: coverageOf(window),
        }
    }
    latestValueWindows.set(grapherState, result)
    return result
}

const MIN_POPULATION = 1_000_000

/**
 * The entities a strategy picks, none to keep the chart's own selection, or
 * undefined if the strategy doesn't apply to the chart
 */
export async function pickEntities({
    grapherState,
    strategy,
    budget,
    readerCountry,
}: {
    grapherState: GrapherState
    strategy: Exclude<StrategyId, "author">
    budget: number
    readerCountry?: EntityName
}): Promise<EntityName[] | undefined> {
    const picks = await pickWithStrategy({
        grapherState,
        strategy,
        budget,
        readerCountry,
    })
    if (
        !picks ||
        grapherState.activeTab !== GRAPHER_TAB_NAMES.LineChart ||
        STRATEGIES_WITHOUT_AXIS_SWAP.has(strategy)
    )
        return picks
    return swapAxisStretchers({
        grapherState,
        picks,
        candidates: findCandidateValues(findValuesAtEnd(grapherState), budget),
        population: await loadPopulation(),
        keep: readerCountry,
    })
}

/** Strategies whose picks are kept as they are, even if they stretch the y-axis */
const STRATEGIES_WITHOUT_AXIS_SWAP = new Set<StrategyId>([
    "authorTrimmed",
    "continents",
    "dataRange",
])

/** How much taller a pick's history may make the y-axis than its latest value would */
const MAX_AXIS_STRETCH = 2

/** How many of the closest candidates by latest value a swap chooses from */
const SWAP_CANDIDATE_COUNT = 5

/**
 * Swaps any pick whose past values, such as a one-year spike, would make
 * the y-axis more than MAX_AXIS_STRETCH times as tall as its latest value
 * would, for the most populous of the closest candidates by latest value
 * that doesn't
 */
function swapAxisStretchers({
    grapherState,
    picks,
    candidates,
    population,
    keep,
}: {
    grapherState: GrapherState
    picks: EntityName[]
    candidates: Map<EntityName, number>
    population: Map<EntityName, number>
    keep?: EntityName
}): EntityName[] {
    const ranges = findValueRangesInView(grapherState)
    const spanOf = (extents: { min: number; max: number }[]): number =>
        Math.max(0, ...extents.map((extent) => extent.max)) -
        Math.min(0, ...extents.map((extent) => extent.min))
    // How much wider the entity's history makes the drawn value range than
    // its latest value alone would, next to the other picks' histories
    const stretchOf = (
        entityName: EntityName,
        others: EntityName[]
    ): number => {
        const history = ranges.get(entityName)
        const latestValue = candidates.get(entityName)
        if (!history || latestValue === undefined) return 1
        const otherHistories = others
            .map((other) => ranges.get(other))
            .filter((extent) => extent !== undefined)
        const spanWithLatestOnly = spanOf([
            ...otherHistories,
            { min: latestValue, max: latestValue },
        ])
        return spanWithLatestOnly > 0
            ? spanOf([...otherHistories, history]) / spanWithLatestOnly
            : 1
    }

    const result = [...picks]
    const unswappable = new Set<EntityName>(keep ? [keep] : [])
    let passesLeft = picks.length
    while (passesLeft-- > 0) {
        const worst = R.pipe(
            result,
            R.filter((entityName) => !unswappable.has(entityName)),
            R.map((entityName) => ({
                entityName,
                stretch: stretchOf(
                    entityName,
                    result.filter((other) => other !== entityName)
                ),
            })),
            R.sortBy((d) => -d.stretch),
            R.first()
        )
        if (!worst || worst.stretch <= MAX_AXIS_STRETCH) break
        const others = result.filter((other) => other !== worst.entityName)
        const latestValue = candidates.get(worst.entityName)
        const replacement =
            latestValue === undefined
                ? undefined
                : R.pipe(
                      Array.from(candidates),
                      R.filter(
                          ([candidate]) =>
                              !result.includes(candidate) &&
                              stretchOf(candidate, others) <= MAX_AXIS_STRETCH
                      ),
                      R.sortBy(([, value]) => Math.abs(value - latestValue)),
                      R.take(SWAP_CANDIDATE_COUNT),
                      R.sortBy(
                          ([candidate]) => -(population.get(candidate) ?? 0)
                      ),
                      R.first()
                  )
        if (replacement) {
            result[result.indexOf(worst.entityName)] = replacement[0]
            unswappable.add(replacement[0])
        } else unswappable.add(worst.entityName)
    }
    return result
}

/** Each entity's lowest and highest value within the chart's time range */
function findValueRangesInView(
    grapherState: GrapherState
): Map<EntityName, { min: number; max: number }> {
    const ranges = new Map<EntityName, { min: number; max: number }>()
    const slug = grapherState.yColumnSlug
    if (!slug) return ranges
    const startTime = grapherState.startTime ?? -Infinity
    const endTime = grapherState.endTime ?? Infinity
    const column = grapherState.table.get(slug)
    for (const [entityName, rows] of column.owidRowsByEntityName) {
        const values = rows
            .filter(
                (row) =>
                    row.originalTime >= startTime &&
                    row.originalTime <= endTime &&
                    typeof row.value === "number"
            )
            .map((row) => row.value as number)
        if (values.length > 0)
            ranges.set(entityName, {
                min: Math.min(...values),
                max: Math.max(...values),
            })
    }
    return ranges
}

async function pickWithStrategy({
    grapherState,
    strategy,
    budget,
    readerCountry,
}: {
    grapherState: GrapherState
    strategy: Exclude<StrategyId, "author">
    budget: number
    readerCountry?: EntityName
}): Promise<EntityName[] | undefined> {
    const population = await loadPopulation()
    const endValues = findValuesAtEnd(grapherState)

    switch (strategy) {
        case "authorTrimmed": {
            const authorsSelection =
                grapherState.authorsVersion.selection.selectedEntityNames
            if (authorsSelection.length <= budget) return []
            return findRankPercentilePeers({
                values: pickFromMap(endValues, authorsSelection),
                targetCount: budget,
            })
        }
        case "readerCountry":
            return pickReaderCountryAndPeers({
                grapherState,
                budget,
                readerCountry,
            })
        case "continents": {
            const regions = findRegionGroup(grapherState.availableEntityNames)
            if (regions.length < 2) return undefined
            return regions.length <= budget
                ? regions
                : findRankPercentilePeers({
                      values: pickFromMap(endValues, regions),
                      targetCount: budget,
                  })
        }
        case "evenClosest":
        case "evenPopulous":
            return findEvenValuePeers({
                values: findCandidateValues(endValues, budget),
                population,
                targetCount: budget,
                pick:
                    strategy === "evenClosest"
                        ? "closestToCenter"
                        : "mostPopulous",
            })
        case "rankPercentiles":
            return findRankPercentilePeers({
                values: dropSmallCountries(
                    findCandidateValues(endValues, budget),
                    population
                ),
                targetCount: budget,
            })
        case "naturalBreaksClosest":
        case "naturalBreaksPopulous":
            return findNaturalBreakPeers({
                values: dropSmallCountries(
                    findCandidateValues(endValues, budget),
                    population
                ),
                population,
                targetCount: budget,
                pick:
                    strategy === "naturalBreaksClosest"
                        ? "closestToMean"
                        : "mostPopulous",
            })
        case "movers":
            return findBiggestMovers({
                changes: dropSmallCountries(
                    findCandidateValues(findChanges(grapherState), budget),
                    population
                ),
                budget,
            })
        case "dataRange":
            return pickWithProductionDataRange(grapherState, budget)
    }
}

/** Production's dataRange peer selection, without a target country */
async function pickWithProductionDataRange(
    grapherState: GrapherState,
    budget: number
): Promise<EntityName[]> {
    const slug = grapherState.yColumnSlug
    if (!slug) return []
    return selectPeerCountries({
        peerCountryStrategy: PeerCountryStrategy.DataRange,
        availableEntities: prepareEntitiesForPeerSelection(grapherState),
        dataColumn: grapherState.table.get(slug),
        additionalDataLoaderFn: grapherState.additionalDataLoaderFn,
        time: grapherState.endTime,
        targetCount: budget,
    })
}

async function pickReaderCountryAndPeers({
    grapherState,
    budget,
    readerCountry,
}: {
    grapherState: GrapherState
    budget: number
    readerCountry?: EntityName
}): Promise<EntityName[]> {
    if (
        !readerCountry ||
        !grapherState.availableEntityNames.includes(readerCountry)
    )
        return []
    const peers = await selectPeerCountriesForGrapher(grapherState, {
        targetCountry: readerCountry,
        peerCountryStrategy:
            grapherState.peerCountryStrategy ?? PeerCountryStrategy.DataRange,
    })
    return R.unique([readerCountry, ...peers]).slice(0, budget)
}

/**
 * The available OWID continents, or else the largest other set of regions
 * with at least two available
 */
function findRegionGroup(availableEntityNames: EntityName[]): EntityName[] {
    const available = new Set(availableEntityNames)
    const otherRegionSets = R.pipe(
        getAggregates(),
        R.groupBy((region) => region.definedBy ?? ""),
        R.values(),
        R.sortBy((regions) => -regions.length)
    )
    for (const regions of [getContinents(), ...otherRegionSets]) {
        const names = regions
            .map((region) => region.name)
            .filter((name) => available.has(name))
        if (names.length >= 2) return names
    }
    return []
}

/**
 * Countries, or every entity if fewer countries than the budget have a
 * value
 */
export function findCandidateValues(
    values: Map<EntityName, number>,
    budget: number
): Map<EntityName, number> {
    const countryValues = new Map(
        [...values].filter(([entityName]) => {
            const region = getRegionByName(entityName)
            return region !== undefined && checkIsCountry(region)
        })
    )
    return countryValues.size >= budget ? countryValues : values
}

/** Drops countries below the population floor; entities without population data stay */
function dropSmallCountries(
    values: Map<EntityName, number>,
    population: Map<EntityName, number>
): Map<EntityName, number> {
    return new Map(
        [...values].filter(
            ([entityName]) =>
                (population.get(entityName) ?? Infinity) >= MIN_POPULATION
        )
    )
}

function pickFromMap(
    values: Map<EntityName, number>,
    entityNames: EntityName[]
): Map<EntityName, number> {
    return new Map(
        entityNames
            .filter((entityName) => values.has(entityName))
            .map((entityName) => [entityName, values.get(entityName)!])
    )
}

/** Share of countries whose data must have started by a slope thumbnail's start time */
const SLOPE_START_COVERAGE = 0.8

/**
 * The earliest time by which SLOPE_START_COVERAGE of the countries with data
 * up to the chart's end time have their first value
 */
export function findSlopeStartTime(
    grapherState: GrapherState
): number | undefined {
    const slug = grapherState.yColumnSlug
    if (!slug) return undefined
    const column = grapherState.table.get(slug)
    const endTime = findLatestValueEndTime(grapherState)
    const firstTimes = grapherState.availableEntityNames.flatMap(
        (entityName) => {
            const region = getRegionByName(entityName)
            if (!region || !checkIsCountry(region)) return []
            const firstRow = column.owidRowsByEntityName
                .get(entityName)
                ?.find(
                    (row) =>
                        typeof row.value === "number" &&
                        row.originalTime <= endTime
                )
            return firstRow ? [firstRow.originalTime] : []
        }
    )
    const sortedTimes = R.sortBy(firstTimes, (time) => time)
    return sortedTimes[Math.ceil(SLOPE_START_COVERAGE * sortedTimes.length) - 1]
}

/**
 * The chart's end time, or the indicator's last time if the chart ends
 * later, as it can with projections
 */
function findLatestValueEndTime(grapherState: GrapherState): number {
    const endTime = grapherState.endTime ?? Infinity
    const slug = grapherState.yColumnSlug
    const maxTime = slug ? grapherState.table.get(slug).maxTime : undefined
    return maxTime !== undefined ? Math.min(endTime, maxTime) : endTime
}

/**
 * Each entity's latest value within the window up to the chart's end time,
 * or for dumbbells the difference between its two dots
 */
export function findValuesAtEnd(
    grapherState: GrapherState
): Map<EntityName, number> {
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.Dumbbell)
        return findDumbbellDifferences(grapherState)
    const endTime = findLatestValueEndTime(grapherState)
    const { window } = findLatestValueWindow(grapherState)
    return findValuesNear(grapherState, (rows) =>
        rows
            .filter(
                (row) =>
                    row.originalTime <= endTime &&
                    row.originalTime >= endTime - window
            )
            .at(-1)
    )
}

/**
 * Each entity's end dot minus its start dot, from values at exactly the
 * plotted times: the second indicator minus the first at the end time, or
 * with one indicator, the end time minus the start time
 */
function findDumbbellDifferences(
    grapherState: GrapherState
): Map<EntityName, number> {
    const differences = new Map<EntityName, number>()
    const [firstSlug, secondSlug] = grapherState.yColumnSlugs
    if (!firstSlug) return differences
    const endTime = findLatestValueEndTime(grapherState)
    const findValue = (
        slug: string,
        entityName: EntityName,
        time: number
    ): number | undefined => {
        const value = grapherState.table
            .get(slug)
            .owidRowsByEntityName.get(entityName)
            ?.find((row) => row.originalTime === time)?.value
        return typeof value === "number" ? value : undefined
    }
    for (const entityName of prepareEntitiesForPeerSelection(grapherState)) {
        const start = secondSlug
            ? findValue(firstSlug, entityName, endTime)
            : grapherState.startTime !== undefined
              ? findValue(firstSlug, entityName, grapherState.startTime)
              : undefined
        const end = findValue(secondSlug ?? firstSlug, entityName, endTime)
        if (start !== undefined && end !== undefined)
            differences.set(entityName, end - start)
    }
    return differences
}

/**
 * Each entity's change from the year by which half the countries have data
 * to its latest value before the chart's end time
 */
function findChanges(grapherState: GrapherState): Map<EntityName, number> {
    const { startTime, endTime } = grapherState
    if (startTime === undefined || endTime === undefined) return new Map()
    const firstTimes = [
        ...findTimesNear(grapherState, (rows) =>
            rows.find((row) => row.originalTime >= startTime)
        ),
    ]
        .filter(([entityName]) => {
            const region = getRegionByName(entityName)
            return region !== undefined && checkIsCountry(region)
        })
        .map(([, time]) => time)
    if (firstTimes.length === 0) return new Map()
    const windowStart = R.sortBy(firstTimes, (time) => time)[
        Math.floor(firstTimes.length / 2)
    ]
    if (windowStart >= endTime) return new Map()

    const { window } = findLatestValueWindow(grapherState)
    const startValues = findValuesNear(grapherState, (rows) =>
        rows.find(
            (row) =>
                row.originalTime >= windowStart &&
                row.originalTime <= windowStart + window
        )
    )
    const endValues = findValuesAtEnd(grapherState)
    const changes = new Map<EntityName, number>()
    for (const [entityName, endValue] of endValues) {
        const startValue = startValues.get(entityName)
        if (startValue !== undefined)
            changes.set(entityName, endValue - startValue)
    }
    return changes
}

type ValueRow = { originalTime: number; value: number }

function findValuesNear(
    grapherState: GrapherState,
    findRow: (rows: ValueRow[]) => ValueRow | undefined
): Map<EntityName, number> {
    return new Map(
        [...findRowsNear(grapherState, findRow)].map(([entityName, row]) => [
            entityName,
            row.value,
        ])
    )
}

function findTimesNear(
    grapherState: GrapherState,
    findRow: (rows: ValueRow[]) => ValueRow | undefined
): Map<EntityName, number> {
    return new Map(
        [...findRowsNear(grapherState, findRow)].map(([entityName, row]) => [
            entityName,
            row.originalTime,
        ])
    )
}

function findRowsNear(
    grapherState: GrapherState,
    findRow: (rows: ValueRow[]) => ValueRow | undefined
): Map<EntityName, ValueRow> {
    const rowsByEntity = new Map<EntityName, ValueRow>()
    const slug = grapherState.yColumnSlug
    if (!slug) return rowsByEntity
    const column = grapherState.table.get(slug)
    for (const entityName of prepareEntitiesForPeerSelection(grapherState)) {
        const rows = (column.owidRowsByEntityName.get(entityName) ?? []).filter(
            (row): row is typeof row & { value: number } =>
                typeof row.value === "number"
        )
        const row = findRow(rows)
        if (row) rowsByEntity.set(entityName, row)
    }
    return rowsByEntity
}

/** One entity from each group of values that natural breaks find */
function findNaturalBreakPeers({
    values,
    population,
    targetCount,
    pick,
}: {
    values: Map<EntityName, number>
    population: Map<EntityName, number>
    targetCount: number
    pick: "mostPopulous" | "closestToMean"
}): EntityName[] {
    const entries = Array.from(values, ([entityName, value]) => ({
        entityName,
        value,
    }))
    return groupByNaturalBreaks(entries, targetCount).map((group) => {
        const mean = _.meanBy(group, (d) => d.value)
        const best =
            pick === "mostPopulous"
                ? _.maxBy(group, (d) => population.get(d.entityName) ?? 0)
                : _.minBy(group, (d) => Math.abs(d.value - mean))
        return best!.entityName
    })
}

/**
 * Splits values into groups that minimize the sum of squared deviations
 * from each group's mean, the optimal form of Jenks natural breaks
 * (https://journal.r-project.org/archive/2011-2/RJournal_2011-2_Wang+Song.pdf)
 */
function groupByNaturalBreaks<T extends { value: number }>(
    items: T[],
    numGroups: number
): T[][] {
    const sorted = R.sortBy(items, (item) => item.value)
    const n = sorted.length
    const k = Math.min(numGroups, n)
    if (k <= 0) return []

    const sums = [0]
    const squareSums = [0]
    for (const { value } of sorted) {
        sums.push(sums.at(-1)! + value)
        squareSums.push(squareSums.at(-1)! + value * value)
    }
    const costOf = (start: number, end: number): number => {
        const count = end - start + 1
        const sum = sums[end + 1] - sums[start]
        return squareSums[end + 1] - squareSums[start] - (sum * sum) / count
    }

    // costs[g][j]: least cost of splitting items 0..j into g + 1 groups,
    // starts[g][j]: where the last of those groups starts
    const costs = R.range(0, k).map(() => new Array<number>(n).fill(Infinity))
    const starts = R.range(0, k).map(() => new Array<number>(n).fill(0))
    for (let j = 0; j < n; j++) costs[0][j] = costOf(0, j)
    for (let g = 1; g < k; g++)
        for (let j = g; j < n; j++)
            for (let start = g; start <= j; start++) {
                const cost = costs[g - 1][start - 1] + costOf(start, j)
                if (cost < costs[g][j]) {
                    costs[g][j] = cost
                    starts[g][j] = start
                }
            }

    const groups: T[][] = []
    let end = n - 1
    for (let g = k - 1; g >= 0; g--) {
        const start = starts[g][end]
        groups.unshift(sorted.slice(start, end + 1))
        end = start - 1
    }
    return groups
}

/** The lowest, the highest and evenly spaced ranks between them */
function findRankPercentilePeers({
    values,
    targetCount,
}: {
    values: Map<EntityName, number>
    targetCount: number
}): EntityName[] {
    const sorted = R.sortBy(Array.from(values), ([, value]) => value).map(
        ([entityName]) => entityName
    )
    if (sorted.length <= targetCount) return sorted
    return R.unique(
        R.range(0, targetCount).map(
            (i) =>
                sorted[
                    Math.round((i * (sorted.length - 1)) / (targetCount - 1))
                ]
        )
    )
}

/** Half the budget for the largest changes, half for the smallest */
function findBiggestMovers({
    changes,
    budget,
}: {
    changes: Map<EntityName, number>
    budget: number
}): EntityName[] {
    const sorted = R.sortBy(Array.from(changes), ([, change]) => -change).map(
        ([entityName]) => entityName
    )
    const numLargest = Math.ceil(budget / 2)
    return R.unique([
        ...sorted.slice(0, numLargest),
        ...sorted.slice(-(budget - numLargest)),
    ]).slice(0, budget)
}

/**
 * One slot per evenly spaced value from lowest to highest. An empty slot
 * takes the nearest entity not yet picked.
 */
function findEvenValuePeers({
    values,
    population,
    targetCount,
    pick,
}: {
    values: Map<EntityName, number>
    population: Map<EntityName, number>
    targetCount: number
    pick: "mostPopulous" | "closestToCenter"
}): EntityName[] {
    const entries = Array.from(values, ([entityName, value]) => ({
        entityName,
        value,
    }))
    if (entries.length === 0 || targetCount <= 0) return []
    const min = Math.min(...entries.map((d) => d.value))
    const max = Math.max(...entries.map((d) => d.value))
    const centers = R.range(0, targetCount).map((i) =>
        targetCount === 1 || max === min
            ? (min + max) / 2
            : min + (i * (max - min)) / (targetCount - 1)
    )
    const findNearestSlot = (value: number): number =>
        _.minBy(R.range(0, targetCount), (i) => Math.abs(centers[i] - value))!

    const buckets = R.range(0, targetCount).map(() => [] as typeof entries)
    for (const d of entries) buckets[findNearestSlot(d.value)].push(d)

    const picked = new Set<EntityName>()
    const choose = (
        candidates: typeof entries,
        center: number
    ): EntityName | undefined => {
        const open = candidates.filter((d) => !picked.has(d.entityName))
        const best =
            pick === "mostPopulous"
                ? _.maxBy(open, (d) => population.get(d.entityName) ?? 0)
                : _.minBy(open, (d) => Math.abs(d.value - center))
        return best?.entityName
    }

    const picks: EntityName[] = []
    const emptySlots: number[] = []
    for (const i of R.range(0, targetCount)) {
        const entityName = choose(buckets[i], centers[i])
        if (entityName) {
            picked.add(entityName)
            picks.push(entityName)
        } else emptySlots.push(i)
    }
    for (const i of emptySlots) {
        const entityName = choose(entries, centers[i])
        if (!entityName) break
        picked.add(entityName)
        picks.push(entityName)
    }
    return picks
}

let populationPromise: Promise<Map<EntityName, number>> | undefined
export function loadPopulation(): Promise<Map<EntityName, number>> {
    populationPromise ??= loadCatalogData("population", {
        baseUrl: CATALOG_URL,
    }).then((rows) => new Map(rows.map((row) => [row.entity, row.value])))
    return populationPromise
}
