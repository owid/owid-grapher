/**
 * computeRankingFromPreparedTable turns one column of a chart's table into
 * the per-country values that ranking blocks rank. The contract: only
 * eligible entities (countries) are included, the ranking time is the
 * latest time with country data (or the URL's time end bound), stale values
 * are only used within tolerance, and the World value / sparkline are
 * attached separately.
 */
import { describe, expect, it } from "vitest"
import {
    ColumnTypeNames,
    OwidTableSlugs,
    TimeInterval,
    type CoreColumnDef,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import {
    computeRankingFromPreparedTable,
    type RankingComputationOptions,
} from "./GrapherRankings"
import { PreparedCalloutTable } from "./GrapherValuesJson"

type Row = [entity: string, year: number, le: number | string, gdp?: number]

const makePrepared = (
    rows: Row[],
    columnDefs: Partial<Record<"le" | "gdp", Partial<CoreColumnDef>>> = {}
): PreparedCalloutTable => {
    const table = new OwidTable(
        [
            [OwidTableSlugs.EntityName, OwidTableSlugs.Year, "le", "gdp"],
            ...rows.map(([entity, year, le, gdp]) => [entity, year, le, gdp]),
        ],
        [
            { slug: OwidTableSlugs.EntityName, type: ColumnTypeNames.EntityName },
            { slug: OwidTableSlugs.Year, type: ColumnTypeNames.Year },
            {
                slug: "le",
                type: ColumnTypeNames.Numeric,
                name: "Life expectancy",
                unit: "years",
                ...columnDefs.le,
            },
            {
                slug: "gdp",
                type: ColumnTypeNames.Numeric,
                name: "GDP per capita",
                ...columnDefs.gdp,
            },
        ]
    )
    return {
        inputTable: table,
        yColumnSlugs: ["le", "gdp"],
        xColumnSlug: undefined,
        columns: {
            le: { name: "Life expectancy", shortName: "le", unit: "years" },
            gdp: { name: "GDP per capita", shortName: "gdp_pc" },
        },
        sourcesLine: "UN WPP",
        times: table.getTimesUniqSortedAscForColumns(["le", "gdp"]),
        minTime: -Infinity,
        maxTime: Infinity,
    }
}

const countries = new Map([
    ["Germany", "DEU"],
    ["France", "FRA"],
    ["Nigeria", "NGA"],
])

const compute = (
    prepared: PreparedCalloutTable,
    options: Partial<RankingComputationOptions> = {}
): ReturnType<typeof computeRankingFromPreparedTable> =>
    computeRankingFromPreparedTable(prepared, {
        eligibleEntityNames: countries,
        chartKey: "https://ourworldindata.org/grapher/le",
        ...options,
    })

const valuesByCode = (
    ranking: ReturnType<typeof compute>
): Record<string, number> =>
    Object.fromEntries(ranking?.rows.map((r) => [r.code, r.value]) ?? [])

describe(computeRankingFromPreparedTable, () => {
    it("ranks at the latest country time and excludes aggregates", () => {
        const ranking = compute(
            makePrepared([
                ["Germany", 2020, 81],
                ["France", 2020, 82],
                ["Nigeria", 2020, 53],
                ["Germany", 2019, 80],
                // aggregates are not ranked, and their later data doesn't
                // move the ranking time
                ["World", 2020, 72],
                ["Europe", 2021, 79],
            ])
        )
        expect(ranking).toMatchObject({
            columnSlug: "le",
            title: "Life expectancy",
            unit: "years",
            source: "UN WPP",
            time: 2020,
            formattedTime: "2020",
            worldValue: 72,
        })
        expect(valuesByCode(ranking)).toEqual({ DEU: 81, FRA: 82, NGA: 53 })
        expect(ranking?.prevTime).toBeUndefined()
    })

    it("uses stale values only within tolerance", () => {
        const prepared = makePrepared([
            ["Germany", 2020, 81],
            ["France", 2018, 82],
            ["Nigeria", 2015, 53],
        ])
        expect(valuesByCode(compute(prepared))).toEqual({ DEU: 81 })

        const ranking = compute(prepared, { tolerance: 2 })
        expect(valuesByCode(ranking)).toEqual({ DEU: 81, FRA: 82 })
        expect(ranking?.rows.find((r) => r.code === "FRA")?.time).toBe(2018)
    })

    it("falls back to the column's tolerance", () => {
        const prepared = makePrepared(
            [
                ["Germany", 2020, 81],
                ["France", 2018, 82],
            ],
            { le: { tolerance: 5 } }
        )
        expect(valuesByCode(compute(prepared))).toEqual({ DEU: 81, FRA: 82 })
    })

    it("uses the map's time tolerance for the map column", () => {
        // e.g. a chart whose latest year only covers some countries: the
        // map shows the others' previous values, and so should the ranking
        const prepared = {
            ...makePrepared([
                ["Germany", 2023, 81],
                ["France", 2024, 82],
            ]),
            mapColumnSlug: "le",
            mapTimeTolerance: 1,
        }
        expect(valuesByCode(compute(prepared))).toEqual({ DEU: 81, FRA: 82 })
        expect(
            valuesByCode(compute({ ...prepared, mapColumnSlug: "gdp" }))
        ).toEqual({ FRA: 82 })
    })

    it("uses the end bound of the time param as ranking time", () => {
        const prepared = makePrepared([
            ["Germany", 2010, 79],
            ["France", 2010, 80],
            ["Germany", 2020, 81],
        ])
        const ranking = compute(prepared, { timeQueryParam: "2000..2010" })
        expect(ranking?.time).toBe(2010)
        expect(valuesByCode(ranking)).toEqual({ DEU: 79, FRA: 80 })
    })

    it("attaches previous values from changeSinceYears earlier", () => {
        const ranking = compute(
            makePrepared([
                ["Germany", 2010, 79],
                ["France", 2010, 81],
                ["Germany", 2020, 81],
                ["France", 2020, 82],
                ["Nigeria", 2020, 53],
            ]),
            { changeSinceYears: 10 }
        )
        expect(ranking?.prevTime).toBe(2010)
        expect(
            Object.fromEntries(
                ranking?.rows.map((r) => [r.code, r.prevValue]) ?? []
            )
        ).toEqual({ DEU: 79, FRA: 81, NGA: undefined })
    })

    it("picks a column by short name", () => {
        const ranking = compute(
            makePrepared([
                ["Germany", 2020, 81, 50000],
                ["France", 2020, 82, 45000],
            ]),
            { column: "gdp_pc" }
        )
        expect(ranking?.columnSlug).toBe("gdp")
        expect(valuesByCode(ranking)).toEqual({ DEU: 50000, FRA: 45000 })
        expect(
            compute(makePrepared([["Germany", 2020, 81]]), {
                column: "unknown",
            })
        ).toBeUndefined()
    })

    it("ignores non-numeric values and returns undefined without country data", () => {
        expect(
            valuesByCode(
                compute(
                    makePrepared([
                        ["Germany", 2020, 81],
                        ["France", 2020, "n/a"],
                    ])
                )
            )
        ).toEqual({ DEU: 81 })
        expect(compute(makePrepared([["World", 2020, 72]]))).toBeUndefined()
    })

    it("attaches the entity's and World's series up to the ranking time", () => {
        const ranking = compute(
            makePrepared([
                ["Germany", 2010, 79],
                ["Germany", 2020, 81],
                ["World", 2010, 70],
                ["World", 2020, 72],
                // after the ranking time
                ["World", 2021, 73],
            ]),
            { includeSparklineFor: "Germany" }
        )
        expect(ranking?.sparkline).toEqual({
            entity: [
                [2010, 79],
                [2020, 81],
            ],
            world: [
                [2010, 70],
                [2020, 72],
            ],
        })
    })
    it("starts the sparkline at the start bound of a time range", () => {
        const prepared = makePrepared([
            ["Germany", 1700, 30],
            ["Germany", 1800, 35],
            ["Germany", 2020, 81],
            ["France", 2020, 82],
            ["World", 1700, 25],
            ["World", 1800, 28],
            ["World", 2020, 72],
        ])
        const ranking = compute(prepared, {
            timeQueryParam: "1800..latest",
            includeSparklineFor: "Germany",
        })
        // `latest` doesn't cap the ranking time
        expect(ranking?.time).toBe(2020)
        expect(ranking?.sparkline).toEqual({
            entity: [
                [1800, 35],
                [2020, 81],
            ],
            world: [
                [1800, 28],
                [2020, 72],
            ],
        })

        // a single time only sets the ranking time
        expect(
            compute(prepared, {
                timeQueryParam: "2020",
                includeSparklineFor: "Germany",
            })?.sparkline?.entity
        ).toHaveLength(3)
    })

    it("ignores projected values after the current year", () => {
        // Some indicators store projections in the same variable as
        // historical data, e.g. years of schooling projected to 2040
        const ranking = compute(
            makePrepared([
                ["Germany", 2020, 81],
                ["France", 2020, 82],
                ["Germany", 2030, 84],
                ["France", 2030, 85],
                ["World", 2030, 75],
            ]),
            { now: new Date("2026-10-12"), includeSparklineFor: "Germany" }
        )
        expect(ranking?.time).toBe(2020)
        expect(valuesByCode(ranking)).toEqual({ DEU: 81, FRA: 82 })
        expect(ranking?.worldValue).toBeUndefined()
        expect(ranking?.sparkline?.entity).toEqual([[2020, 81]])

        // ...also when the time param asks for a future time
        expect(
            compute(
                makePrepared([
                    ["Germany", 2020, 81],
                    ["Germany", 2030, 84],
                ]),
                { now: new Date("2026-10-12"), timeQueryParam: "2030" }
            )?.time
        ).toBe(2020)
    })

    it("ignores days after today for day-based columns", () => {
        // 2026-10-12 is day 2456 since the epoch (2020-01-21)
        const ranking = compute(
            makePrepared(
                [
                    ["Germany", 2456, 81],
                    ["France", 2456, 82],
                    ["Germany", 2457, 84],
                ],
                { le: { display: { timeInterval: TimeInterval.Day } } }
            ),
            { now: new Date("2026-10-12T15:00:00Z") }
        )
        expect(ranking?.time).toBe(2456)
        expect(valuesByCode(ranking)).toEqual({ DEU: 81, FRA: 82 })
    })

    it("skips columns flagged as projections", () => {
        const prepared = makePrepared(
            [
                ["Germany", 2020, 81, 50000],
                ["France", 2020, 82, 45000],
            ],
            { le: { display: { isProjection: true } } }
        )
        // the first non-projection y column is used by default...
        expect(compute(prepared)?.columnSlug).toBe("gdp")
        // ...and a projection column is never ranked
        expect(compute(prepared, { column: "le" })).toBeUndefined()
    })
})
