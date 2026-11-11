import { expect, it, describe } from "vitest"
import * as R from "remeda"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { ColumnTypeNames, TimeInterval } from "@ourworldindata/types"
import {
    findClosestByValue,
    findDataRangePeers,
    findLatestValuesInWindow,
    findLatestValueWindow,
    selectParentRegionsAsPeers,
} from "./PeerCountrySelection.js"

describe(findClosestByValue, () => {
    it("finds entities with values closest to target using logarithmic distance", () => {
        // GDP per capita-like values
        const values = new Map([
            ["Germany", 48_000],
            ["United Kingdom", 46_000],
            ["France", 42_000],
            ["Italy", 35_000],
            ["Spain", 30_000],
            ["Poland", 18_000],
        ])

        const result = findClosestByValue({ target: "United Kingdom", values })

        expect(result).toEqual(["Germany", "France", "Italy"])
    })

    it("returns no peers when target is isolated beyond maxPeerRatio", () => {
        const values = new Map([
            ["Vatican", 500],
            ["Poland", 38_000_000],
            ["Germany", 84_000_000],
        ])

        const result = findClosestByValue({ target: "Vatican", values })

        expect(result).toEqual([])
    })

    it("prefers proportionally closer peers over absolutely closer ones", () => {
        const values = new Map([
            ["Large", 200_000_000], // 2x larger, 100M absolute diff, log diff = 0.3
            ["Target", 100_000_000],
            ["Small", 30_000_000], // 3.3x smaller, 70M absolute diff, log diff = 0.52
        ])

        const result = findClosestByValue({
            target: "Target",
            values,
            targetCount: 1,
            maxPeerRatio: 5,
        })

        // Log distance: Large (2x) is closer than Small (3.3x)
        expect(result).toEqual(["Large"])
    })

    it("falls back to global search when no same-continent peers exist", () => {
        // Australia has high GDP in Oceania, other Oceania countries are too far
        const values = new Map([
            ["Australia", 50_000],
            ["New Zealand", 35_000], // 1.43x smaller - outside 1.25x threshold
            ["Papua New Guinea", 3_000], // 16.7x smaller - way outside threshold
            ["Germany", 48_000],
            ["France", 42_000],
        ])

        const result = findClosestByValue({
            target: "Australia",
            values,
            maxPeerRatio: 1.25,
        })

        // Australia has no Oceania peers within threshold, falls back to global
        expect(result).toEqual(["Germany", "France"])
    })
})

describe(selectParentRegionsAsPeers, () => {
    it("returns World and parent regions for a country", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Germany",
            availableEntities: [
                "Germany",
                "World",
                "Europe",
                "High-income countries",
                "Asia",
            ],
        })

        // Germany should have World, Europe (continent), and High-income countries (income group)
        expect(result).toContain("World")
        expect(result).toContain("Europe")
        expect(result).toContain("High-income countries")
        expect(result).not.toContain("Asia")
        expect(result).not.toContain("Germany")
    })

    it("only returns entities that are available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "France",
            availableEntities: ["France", "World", "Africa"], // Missing Europe
        })

        // Should only return World since Europe is not available
        expect(result).toEqual(["World"])
    })

    it("returns empty array for non-existent entity", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "NonExistentCountry",
            availableEntities: ["World", "Europe"],
        })

        expect(result).toEqual([])
    })

    it("includes World even when no parent regions are available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Brazil",
            availableEntities: ["Brazil", "World"], // No South America or other parent regions
        })

        expect(result).toEqual(["World"])
    })

    it("returns empty array when World is not available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Germany",
            availableEntities: ["Germany", "Asia"], // No World or relevant parent regions
        })

        // Should return empty since neither World nor parent regions are available
        expect(result).toEqual([])
    })
})

describe(findDataRangePeers, () => {
    it("is deterministic by default", () => {
        const values = new Map([
            ["A", 10],
            ["B", 20],
            ["C", 30],
            ["D", 40],
            ["E", 50],
            ["F", 60],
            ["G", 70],
            ["H", 80],
            ["I", 90],
            ["J", 100],
        ])
        const population = new Map<string, number>()

        const peers1 = findDataRangePeers({ values, population })
        const peers2 = findDataRangePeers({ values, population })

        expect(peers1).toEqual(peers2)
    })

    it("picks most populous country in each bucket when not randomized", () => {
        // 10 countries, 5 buckets of 2 each
        const values = new Map([
            ["SmallCountry1", 10],
            ["Germany", 20], // Bucket 1: Germany is more populous
            ["SmallCountry2", 30],
            ["France", 40], // Bucket 2: France is more populous
            ["SmallCountry3", 50],
            ["Brazil", 60], // Bucket 3: Brazil is more populous
            ["SmallCountry4", 70],
            ["Japan", 80], // Bucket 4: Japan is more populous
            ["SmallCountry5", 90],
            ["USA", 100], // Bucket 5: USA is more populous
        ])
        const population = new Map([
            ["SmallCountry1", 100_000],
            ["Germany", 84_000_000],
            ["SmallCountry2", 200_000],
            ["France", 67_000_000],
            ["SmallCountry3", 300_000],
            ["Brazil", 214_000_000],
            ["SmallCountry4", 400_000],
            ["Japan", 125_000_000],
            ["SmallCountry5", 500_000],
            ["USA", 330_000_000],
        ])

        const peers = findDataRangePeers({ values, population })

        // Should pick the most populous country from each bucket
        expect(peers).toEqual(["Germany", "France", "Brazil", "Japan", "USA"])
    })

    it("respects targetCount parameter", () => {
        const values = new Map([
            ["A", 10],
            ["B", 20],
            ["C", 30],
            ["D", 40],
            ["E", 50],
            ["F", 60],
        ])
        const population = new Map<string, number>()

        const peers = findDataRangePeers({ values, population, targetCount: 3 })

        expect(peers).toHaveLength(3)
    })

    it("handles case where there are fewer entities than buckets", () => {
        const values = new Map([
            ["A", 10],
            ["B", 20],
            ["C", 30],
        ])
        const population = new Map<string, number>()

        // Default is 5 buckets, but only 3 entities
        const result = findDataRangePeers({ values, population })

        // Should return all 3 entities (one per non-empty bucket)
        expect(result).toHaveLength(3)
        expect(result).toContain("A")
        expect(result).toContain("B")
        expect(result).toContain("C")
    })

    it("doesn't include target country or another country in the same bucket", () => {
        // 10 countries split into 5 buckets of 2:
        // Bucket 1: [A=10, B=20], Bucket 2: [C=30, Target=40],
        // Bucket 3: [E=50, F=60], Bucket 4: [G=70, H=80], Bucket 5: [I=90, J=100]
        const values = new Map([
            ["A", 10],
            ["B", 20],
            ["C", 30],
            ["Target", 40],
            ["E", 50],
            ["F", 60],
            ["G", 70],
            ["H", 80],
            ["I", 90],
            ["J", 100],
        ])
        const population = new Map([
            ["A", 1_000_000],
            ["B", 2_000_000],
            ["C", 50_000_000],
            ["Target", 10_000_000],
            ["E", 3_000_000],
            ["F", 4_000_000],
            ["G", 5_000_000],
            ["H", 6_000_000],
            ["I", 7_000_000],
            ["J", 8_000_000],
        ])

        // Without targetCountry: picks most populous from all 5 buckets,
        // including C (most populous in bucket 2)
        const peers = findDataRangePeers({ values, population })
        expect(peers).toEqual(["B", "C", "F", "H", "J"])

        // With targetCountry: skips the bucket containing Target (C)
        const peersForTarget = findDataRangePeers({
            values,
            population,
            targetCountry: "Target",
        })
        expect(peersForTarget).toEqual(["B", "F", "H", "J"])
    })
})

type Row = [entityName: string, year: number, value: number | string]

/** Rows must be in time order, as they are in a loaded grapher table */
const makeColumn = (
    rows: Row[],
    {
        tolerance,
        timeInterval,
        type = ColumnTypeNames.Numeric,
    }: {
        tolerance?: number
        timeInterval?: TimeInterval
        type?: ColumnTypeNames
    } = {}
): CoreColumn =>
    new OwidTable(
        [["entityName", "year", "value"], ...rows],
        [
            { slug: "year", type: ColumnTypeNames.Year },
            {
                slug: "value",
                type,
                tolerance,
                display: timeInterval ? { timeInterval } : undefined,
            },
        ]
    ).get("value")

const COUNTRIES = [
    "France",
    "Germany",
    "Italy",
    "Spain",
    "Poland",
    "Norway",
    "Sweden",
    "Finland",
    "Denmark",
    "Austria",
]

/** Ten countries, each with one value the given number of years before 2020 */
const countriesWithYearsBeforeEnd = (yearsBeforeEnd: number[]): Row[] =>
    R.sortBy(
        COUNTRIES.map((name, index): Row => [
            name,
            2020 - yearsBeforeEnd[index],
            index,
        ]),
        ([, year]) => year
    )

/** Coverage alone would give [2017, 2020] */
const SPREAD_OUT_COUNTRIES = countriesWithYearsBeforeEnd([
    0, 3, 3, 3, 3, 3, 3, 3, 3, 3,
])

describe(findLatestValueWindow, () => {
    it("ends at the data's last year when the chart runs past it", () => {
        const column = makeColumn(
            [
                ["France", 2018, 1],
                ["Germany", 2019, 2],
            ],
            { tolerance: 2 }
        )

        expect(
            findLatestValueWindow({
                column,
                entityNames: ["France", "Germany"],
                endTime: 2030,
            })
        ).toEqual([2017, 2019])
    })

    it("ends at the chart's end when the data runs past it", () => {
        const column = makeColumn(
            [
                ["France", 2018, 1],
                ["Germany", 2020, 2],
            ],
            { tolerance: 2 }
        )

        expect(
            findLatestValueWindow({
                column,
                entityNames: ["France", "Germany"],
                endTime: 2018,
            })
        ).toEqual([2016, 2018])
    })

    it("uses the indicator's tolerance, capped at 10 years", () => {
        const window = (tolerance: number): [number, number] =>
            findLatestValueWindow({
                column: makeColumn(SPREAD_OUT_COUNTRIES, { tolerance }),
                entityNames: COUNTRIES,
                endTime: 2020,
            })

        expect(window(4)).toEqual([2016, 2020])
        expect(window(40)).toEqual([2010, 2020])
    })

    it("treats a tolerance of 0 as set", () => {
        const column = makeColumn(SPREAD_OUT_COUNTRIES, { tolerance: 0 })

        expect(
            findLatestValueWindow({
                column,
                entityNames: COUNTRIES,
                endTime: 2020,
            })
        ).toEqual([2020, 2020])
    })

    it("caps daily data at 3650 days", () => {
        const column = makeColumn([["France", 20_000, 1]], {
            tolerance: 5_000,
            timeInterval: TimeInterval.Day,
        })

        expect(
            findLatestValueWindow({ column, entityNames: ["France"] })
        ).toEqual([16_350, 20_000])
    })

    it("uses only the plotted year for single-time charts without a tolerance", () => {
        const column = makeColumn(SPREAD_OUT_COUNTRIES)

        expect(
            findLatestValueWindow({
                column,
                entityNames: COUNTRIES,
                endTime: 2020,
                isSingleTimeChart: true,
            })
        ).toEqual([2020, 2020])
    })

    it("uses the tolerance for single-time charts, which draw tolerance-filled values", () => {
        const column = makeColumn(SPREAD_OUT_COUNTRIES, { tolerance: 5 })

        expect(
            findLatestValueWindow({
                column,
                entityNames: COUNTRIES,
                endTime: 2020,
                isSingleTimeChart: true,
            })
        ).toEqual([2015, 2020])
    })

    it("covers 80% of countries' latest values, rounded up to a whole year", () => {
        const column = makeColumn(
            countriesWithYearsBeforeEnd([0, 0, 0, 0, 1, 1, 1, 2, 5, 8])
        )

        expect(
            findLatestValueWindow({
                column,
                entityNames: COUNTRIES,
                endTime: 2020,
            })
        ).toEqual([2017, 2020])
    })

    it("caps the covering window at 10 years", () => {
        const column = makeColumn(
            countriesWithYearsBeforeEnd([0, 0, 15, 15, 15, 15, 15, 15, 15, 15])
        )

        expect(
            findLatestValueWindow({
                column,
                entityNames: COUNTRIES,
                endTime: 2020,
            })
        ).toEqual([2010, 2020])
    })

    it("measures coverage over countries only when at least 10 have data", () => {
        const regions = ["World", "Africa", "Asia", "Europe", "Oceania"]
        const column = makeColumn([
            ...countriesWithYearsBeforeEnd([0, 0, 0, 0, 1, 1, 1, 2, 5, 8]),
            ...regions.map((name): Row => [name, 2020, 0]),
        ])

        expect(
            findLatestValueWindow({
                column,
                entityNames: [...COUNTRIES, ...regions],
                endTime: 2020,
            })
        ).toEqual([2017, 2020])
    })

    it("measures coverage over all entities when fewer than 10 countries have data", () => {
        const column = makeColumn([
            ["Oceania", 2012, 1],
            ["World", 2012, 1],
            ["Asia", 2014, 1],
            ["Europe", 2014, 1],
            ["Africa", 2016, 1],
            ["France", 2020, 1],
            ["Germany", 2020, 1],
            ["Italy", 2020, 1],
        ])

        expect(
            findLatestValueWindow({
                column,
                entityNames: [
                    "France",
                    "Germany",
                    "Italy",
                    "Africa",
                    "Asia",
                    "Europe",
                    "Oceania",
                    "World",
                ],
                endTime: 2020,
            })
        ).toEqual([2012, 2020])
    })
})

describe(findLatestValuesInWindow, () => {
    it("returns each entity's latest value inside the window, inclusive at both ends", () => {
        const column = makeColumn([
            ["Germany", 2012, 3],
            ["France", 2014, 1],
            ["France", 2015, 2],
            ["Italy", 2019, 4],
            ["Italy", 2021, 5],
        ])

        expect(
            findLatestValuesInWindow({
                column,
                entityNames: ["France", "Germany", "Italy"],
                window: [2015, 2020],
            })
        ).toEqual([
            { entityName: "France", value: 2, time: 2015 },
            { entityName: "Italy", value: 4, time: 2019 },
        ])
    })

    it("returns only the requested entities", () => {
        const column = makeColumn([
            ["France", 2018, 1],
            ["Spain", 2018, 2],
        ])

        expect(
            findLatestValuesInWindow({
                column,
                entityNames: ["France"],
                window: [2015, 2020],
            })
        ).toEqual([{ entityName: "France", value: 1, time: 2018 }])
    })

    it("skips non-numeric values in mixed columns", () => {
        const column = makeColumn(
            [
                ["France", 2018, 7],
                ["France", 2019, "n/a"],
            ],
            { type: ColumnTypeNames.NumberOrString }
        )

        expect(
            findLatestValuesInWindow({
                column,
                entityNames: ["France"],
                window: [2015, 2020],
            })
        ).toEqual([{ entityName: "France", value: 7, time: 2018 }])
    })

    it("sorts by value, then by entity name", () => {
        const column = makeColumn([
            ["Spain", 2020, 5],
            ["Italy", 2020, 9],
            ["France", 2020, 5],
        ])

        expect(
            findLatestValuesInWindow({
                column,
                entityNames: ["Spain", "Italy", "France"],
                window: [2020, 2020],
            }).map(({ entityName }) => entityName)
        ).toEqual(["France", "Spain", "Italy"])
    })
})
