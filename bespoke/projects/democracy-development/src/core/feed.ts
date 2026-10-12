import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"

import type { BespokeComponentDataUrls } from "owid-bespoke-types"
import { combineStatuses } from "../../../../helpers/queryStatus.js"

import {
    Datum,
    EntityId,
    FeedData,
    FeedManifest,
    IndexKey,
    IndicatorMeta,
    OUTCOME_KEYS,
    OutcomeKey,
    SeriesKey,
    SeriesRows,
} from "./types.js"
import { SMALL_COUNTRY_POP, TOLERANCE_MIN, Y_VARS } from "./constants.js"

export const queryClient = new QueryClient()

/** How many countries a year needs on a panel before it is offered as the first year shown */
const WELL_COVERED_COUNTRIES = 100

/**
 * The feed, with the reads the chart makes of it.
 *
 * Series rows are `[year, value]` sorted by year. `valueAt` applies grapher's tolerance rule
 * (OwidTable.filterByTargetTimes → findClosestTimeIndex): the nearest year within ±tolerance; on a
 * tie the earlier year wins, so a value is never borrowed from the future when the past has one
 * just as close.
 */
export class Feed {
    readonly title: string
    readonly source: string
    readonly entities: string[]
    /** Continent name per entity id */
    readonly continentOf: string[]
    readonly continents: string[]
    readonly indicators: Record<SeriesKey, IndicatorMeta>
    readonly yearRange: { first: number; last: number }
    private readonly series: FeedData["series"]
    private readonly tolerance: Partial<Record<SeriesKey, number>>
    private readonly yearsCache = new Map<IndexKey, number[]>()

    constructor(manifest: FeedManifest, data: FeedData) {
        if (
            !manifest.entities?.length ||
            !manifest.continents?.length ||
            !data.series
        )
            throw new Error(
                "[democracy-development] The feed is missing its entities, continents or series"
            )
        this.title = manifest.meta.title
        this.source = manifest.meta.source
        this.entities = manifest.entities.map((e) => e.name)
        this.continentOf = manifest.entities.map(
            (e) => manifest.continents[e.continent]
        )
        this.continents = manifest.continents
        this.indicators = manifest.indicators
        this.yearRange = manifest.yearRange
        this.series = data.series
        this.tolerance = Object.fromEntries(
            Object.entries(manifest.indicators).map(([key, meta]) => [
                key,
                Math.max(
                    meta.tolerance ?? 0,
                    TOLERANCE_MIN[key as SeriesKey] ?? 0
                ),
            ])
        )
    }

    rows(key: SeriesKey, eid: EntityId): SeriesRows | undefined {
        return this.series[key]?.[String(eid)]
    }

    valueAt(key: SeriesKey, eid: EntityId, year: number): Datum | null {
        const rows = this.rows(key, eid)
        if (!rows) return null
        const tol = this.tolerance[key] ?? 0
        // Binary search for the first row with year >= target
        let lo = 0
        let hi = rows.length
        while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (rows[mid][0] < year) lo = mid + 1
            else hi = mid
        }
        if (lo < rows.length && rows[lo][0] === year)
            return { value: rows[lo][1], year }
        const before = lo - 1 >= 0 ? rows[lo - 1] : null
        const after = lo < rows.length ? rows[lo] : null
        const dB = before ? year - before[0] : Infinity
        const dA = after ? after[0] - year : Infinity
        let best: [number, number] | null = null
        if (dB <= dA && dB <= tol) best = before
        else if (dA <= tol) best = after
        return best ? { value: best[1], year: best[0] } : null
    }

    /** An outcome's value with its panel transform applied (e.g. survival = 100 - mortality) */
    outcomeAt(key: OutcomeKey, eid: EntityId, year: number): Datum | null {
        const datum = this.valueAt(key, eid, year)
        const transform = Y_VARS[key].transform
        return datum && transform
            ? { value: transform(datum.value), year: datum.year }
            : datum
    }

    popAt(eid: EntityId, year: number): number | null {
        return this.valueAt("population", eid, year)?.value ?? null
    }

    /** The years the slider offers for an index: those with a score, within the feed's range */
    yearsWithData(xKey: IndexKey): number[] {
        const cached = this.yearsCache.get(xKey)
        if (cached) return cached
        const years = new Set<number>()
        for (const rows of Object.values(this.series[xKey] ?? {}))
            for (const [y] of rows)
                if (y >= this.yearRange.first && y <= this.yearRange.last)
                    years.add(y)
        const sorted = [...years].sort((a, b) => a - b)
        this.yearsCache.set(xKey, sorted)
        return sorted
    }

    /** The year a reader lands on: the latest one with a well-filled GDP panel */
    defaultYear(xKey: IndexKey): number {
        const years = this.yearsWithData(xKey)
        for (let i = years.length - 1; i >= 0; i--) {
            let n = 0
            for (let eid = 0; eid < this.entities.length; eid++)
                if (
                    this.valueAt(xKey, eid, years[i]) &&
                    this.valueAt("gdp", eid, years[i])
                )
                    n++
            if (n >= WELL_COVERED_COUNTRIES) return years[i]
        }
        return years[years.length - 1]
    }

    passesPopulationFilter(
        eid: EntityId,
        year: number,
        showSmallCountries: boolean
    ): boolean {
        if (showSmallCountries) return true
        const pop = this.popAt(eid, year)
        return pop !== null && pop >= SMALL_COUNTRY_POP
    }

    /**
     * A country is in the chart this year if it has a democracy score, at least one measure, and
     * (unless small countries are shown) a population of 500,000 or more.
     */
    entityAvailable(
        eid: EntityId,
        xKey: IndexKey,
        year: number,
        showSmallCountries: boolean
    ): boolean {
        if (!this.passesPopulationFilter(eid, year, showSmallCountries))
            return false
        if (!this.valueAt(xKey, eid, year)) return false
        return OUTCOME_KEYS.some((k) => this.valueAt(k, eid, year))
    }

    entityId(name: string): EntityId | undefined {
        const i = this.entities.indexOf(name)
        return i === -1 ? undefined : i
    }
}

// ------------------------------------------------------------------------------------------------
// Fetching: the manifest first, then the one data file it names
// ------------------------------------------------------------------------------------------------
export function useFeed(urls: BespokeComponentDataUrls): {
    data?: Feed
    status: QueryStatus
} {
    const manifest = useQuery({
        queryKey: ["democracy-development", "manifest", urls.metadataUrl],
        queryFn: () => fetchJson<FeedManifest>(urls.metadataUrl),
        staleTime: Infinity, // The data files are immutable within a session
    })
    const dataFile = manifest.data?.dataFile
    const feed = useQuery({
        queryKey: ["democracy-development", "feed", urls.dataUrl, dataFile],
        queryFn: async (): Promise<Feed> => {
            const data = await fetchJson<FeedData>(
                `${urls.dataUrl}/${dataFile}`
            )
            return new Feed(manifest.data!, data)
        },
        enabled: dataFile !== undefined,
        staleTime: Infinity,
    })
    return {
        data: feed.data,
        status: combineStatuses(manifest.status, feed.status),
    }
}
