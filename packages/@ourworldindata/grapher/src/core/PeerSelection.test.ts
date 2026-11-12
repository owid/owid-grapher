import { expect, it, describe, onTestFinished, vi } from "vitest"
import * as R from "remeda"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    AdditionalGrapherDataFetchFn,
    ColumnTypeNames,
    EntitySelectionMode,
    FacetStrategy,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    PeerCountryStrategy,
    TimeInterval,
    type EntityName,
} from "@ourworldindata/types"
import {
    findClosestByValue,
    findSpreadByValue,
    findLatestValuesInWindow,
    type LatestValue,
    findLatestValueWindow,
    selectParentRegionsAsPeers,
    selectPeers,
    selectPeersForGrapher,
    selectPeersForGrapherWithGuards,
} from "./PeerSelection.js"
import { parseGrapherQueryParams } from "./GrapherQueryParamParser.js"
import { GrapherState } from "./GrapherState.js"
import type { GrapherProgrammaticInterface } from "./Grapher.js"

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
            targetEntity: "Germany",
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
            targetEntity: "France",
            availableEntities: ["France", "World", "Africa"], // Missing Europe
        })

        // Should only return World since Europe is not available
        expect(result).toEqual(["World"])
    })

    it("returns empty array for non-existent entity", () => {
        const result = selectParentRegionsAsPeers({
            targetEntity: "NonExistentCountry",
            availableEntities: ["World", "Europe"],
        })

        expect(result).toEqual([])
    })

    it("includes World even when no parent regions are available", () => {
        const result = selectParentRegionsAsPeers({
            targetEntity: "Brazil",
            availableEntities: ["Brazil", "World"], // No South America or other parent regions
        })

        expect(result).toEqual(["World"])
    })

    it("returns empty array when World is not available", () => {
        const result = selectParentRegionsAsPeers({
            targetEntity: "Germany",
            availableEntities: ["Germany", "Asia"], // No World or relevant parent regions
        })

        // Should return empty since neither World nor parent regions are available
        expect(result).toEqual([])
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

// Within each pair of neighbors (one bin of five), the odd-indexed country is more populous
const loadAlternatingPopulation = (async () =>
    COUNTRIES.map((entity, index) => ({
        entity,
        value: index % 2 === 1 ? 2_000_000 : 1_000_000,
    }))) as unknown as AdditionalGrapherDataFetchFn

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

describe(findSpreadByValue, () => {
    const latest = (entries: [string, number][]): LatestValue[] =>
        entries.map(([entityName, value]) => ({
            entityName,
            value,
            time: 2020,
        }))

    const POPULATION = new Map([
        ["Iceland", 0.4],
        ["Chad", 18],
        ["Germany", 84],
        ["Nigeria", 220],
        ["India", 1400],
        ["China", 1410],
        ["World", 8000],
        ["Asia", 4700],
    ])

    it("puts each value in the bin of its nearest center", () => {
        // Centers are 0, 50 and 100. India (30) is nearer 50 than 0, so it shares Germany's bin, not Chad's.
        const candidates = latest([
            ["Chad", 0],
            ["India", 30],
            ["Germany", 45],
            ["China", 100],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 3,
            })
        ).toEqual(["Chad", "India", "China"])
    })

    it("fills bins that no value falls into with the remaining country nearest each bin's center", () => {
        // Bin centers are 1, 34, 67 and 100, so only the first and last bins have members.
        // Iceland is nearest 34 and, once it is picked, Germany is nearest 67, though Nigeria is more populous.
        const candidates = latest([
            ["Chad", 1],
            ["Nigeria", 3],
            ["Germany", 4],
            ["India", 5],
            ["Iceland", 15],
            ["China", 100],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 4,
            })
        ).toEqual(["Germany", "India", "Iceland", "China"])
    })

    it("breaks population ties by name, whatever the input order", () => {
        // Nigeria and Iceland share the upper bin; Nigeria comes first by value, Iceland by name
        const candidates = latest([
            ["Chad", 0],
            ["Nigeria", 8],
            ["Iceland", 10],
        ])
        const permutations = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0],
        ]

        for (const permutation of permutations) {
            expect(
                findSpreadByValue({
                    candidates: permutation.map((index) => candidates[index]),
                    population: new Map(),
                    targetCount: 2,
                })
            ).toEqual(["Chad", "Iceland"])
        }
    })

    it("puts a value halfway between two centers in the upper bin", () => {
        // Iceland is equidistant from both centers (0 and 10), joins Nigeria's bin and beats it by name
        const candidates = latest([
            ["Chad", 0],
            ["Iceland", 5],
            ["Nigeria", 10],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: new Map(),
                targetCount: 2,
            })
        ).toEqual(["Chad", "Iceland"])
    })

    it("spreads equal values over the most populous candidates", () => {
        const candidates = latest([
            ["Chad", 50],
            ["Germany", 50],
            ["Iceland", 50],
            ["India", 50],
            ["Nigeria", 50],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 3,
            })
        ).toEqual(["Germany", "India", "Nigeria"])
    })

    it("keeps a less populous target in the bin it falls into", () => {
        const candidates = latest([
            ["Chad", 0],
            ["Germany", 1],
            ["India", 9],
            ["Iceland", 10],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 2,
                targetCountry: "Chad",
            })
        ).toEqual(["Chad", "India"])
        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 2,
            })
        ).toEqual(["Germany", "India"])
    })

    it("ignores a target that is not among the candidates", () => {
        const candidates = latest([
            ["Chad", 0],
            ["Germany", 1],
            ["India", 9],
            ["Iceland", 10],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 2,
                targetCountry: "China",
            })
        ).toEqual(["Germany", "India"])
    })

    it("returns all candidates in value order when there are fewer than requested", () => {
        const candidates = latest([
            ["India", 9],
            ["Chad", 0],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 5,
            })
        ).toEqual(["Chad", "India"])
    })

    it("returns nothing for a target count of zero", () => {
        expect(
            findSpreadByValue({
                candidates: latest([["Chad", 0]]),
                population: POPULATION,
                targetCount: 0,
            })
        ).toEqual([])
    })

    it("draws each bin's pick weighted by population when randomized", () => {
        // Each bin weighs its members 1, 2 and 3, so the draws 0.1, 0.4 and 0.3 land on
        // the 1st, 2nd and 2nd member. The most populous would be Nigeria, Italy and Japan.
        const candidates = latest([
            ["Chad", 0],
            ["Iceland", 1],
            ["Nigeria", 2],
            ["Germany", 50],
            ["France", 51],
            ["Italy", 52],
            ["India", 100],
            ["China", 101],
            ["Japan", 102],
        ])
        const population = new Map(
            candidates.map(({ entityName }, index) => [
                entityName,
                (index % 3) + 1,
            ])
        )
        const randomSpy = vi
            .spyOn(Math, "random")
            .mockReturnValueOnce(0.1)
            .mockReturnValueOnce(0.4)
            .mockReturnValueOnce(0.3)
        onTestFinished(() => randomSpy.mockRestore())

        expect(
            findSpreadByValue({
                candidates,
                population,
                targetCount: 3,
                randomize: true,
            })
        ).toEqual(["Chad", "France", "China"])
    })

    it("falls back to all entities when no candidate is a country", () => {
        const candidates = latest([
            ["Africa", 1],
            ["Asia", 1.5],
            ["Europe", 3],
            ["World", 4.5],
            ["High-income countries", 5],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 3,
            })
        ).toEqual(["Asia", "Europe", "World"])
    })

    it("never picks an aggregate when enough countries are available", () => {
        const candidates = latest([
            ["Chad", 1],
            ["Germany", 2],
            ["World", 5],
            ["India", 10],
        ])

        expect(
            findSpreadByValue({
                candidates,
                population: POPULATION,
                targetCount: 3,
            })
        ).toEqual(["Chad", "Germany", "India"])
    })
})

describe(selectPeers, () => {
    describe("with the dataRange strategy", () => {
        const dataColumn = makeColumn(
            COUNTRIES.map((name, index): Row => [name, 2020, (index + 1) * 10])
        )
        const additionalDataLoaderFn = loadAlternatingPopulation

        const selectByDataRange = (
            params: {
                targetEntity?: string
                randomize?: boolean
                targetCount?: number
            } = {}
        ): Promise<string[]> =>
            selectPeers({
                peerCountryStrategy: PeerCountryStrategy.DataRange,
                availableEntities: COUNTRIES,
                dataColumn,
                endTime: 2020,
                isSingleTimeChart: false,
                additionalDataLoaderFn,
                ...params,
            })

        it("picks the most populous country in each value bin", async () => {
            expect(await selectByDataRange({ targetCount: 5 })).toEqual([
                "Germany",
                "Spain",
                "Norway",
                "Finland",
                "Austria",
            ])
        })

        it("skips the target's bin and leaves the target out of the result", async () => {
            // Italy (value 30) shares a bin with Spain
            const peers = await selectByDataRange({ targetEntity: "Italy" })

            expect(peers).toEqual(["Germany", "Norway", "Finland", "Austria"])
        })

        it("draws a random pick per bin when randomized", async () => {
            // A draw of 0 lands on each bin's less populous member
            const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0)
            onTestFinished(() => randomSpy.mockRestore())

            expect(
                await selectByDataRange({ randomize: true, targetCount: 5 })
            ).toEqual(["France", "Italy", "Poland", "Sweden", "Denmark"])
        })

        it("ranks countries whose latest value is a few years before the end year", async () => {
            const peers = await selectPeers({
                peerCountryStrategy: PeerCountryStrategy.DataRange,
                availableEntities: COUNTRIES,
                dataColumn: makeColumn([
                    ...COUNTRIES.slice(0, 9).map((name, index): Row => [
                        name,
                        2016,
                        (index + 1) * 10,
                    ]),
                    [COUNTRIES[9], 2020, 100],
                ]),
                endTime: 2020,
                isSingleTimeChart: false,
                additionalDataLoaderFn,
                targetCount: 5,
            })

            expect(peers).toEqual([
                "Germany",
                "Spain",
                "Norway",
                "Finland",
                "Austria",
            ])
        })
    })
})

describe("peer selection for non-country targets", () => {
    const REGIONS = [
        "Europe",
        "Asia",
        "Africa",
        "Oceania",
        "North America",
        "South America",
    ]
    const regionColumn = makeColumn(
        REGIONS.map((name, index): Row => [name, 2020, (index + 1) * 10])
    )
    const additionalDataLoaderFn = (async () =>
        REGIONS.map((entity, index) => ({
            entity,
            value: 1_000_000 + index,
        }))) as unknown as AdditionalGrapherDataFetchFn
    const loadPeersOfEurope = (async (key: string) =>
        key === "neighbors"
            ? [{ entity: "Europe", value: COUNTRIES }]
            : ["Europe", ...COUNTRIES].map((entity) => ({
                  entity,
                  value: 1_000_000,
              }))) as unknown as AdditionalGrapherDataFetchFn

    it.each([
        PeerCountryStrategy.Neighbors,
        PeerCountryStrategy.Population,
        PeerCountryStrategy.GdpPerCapita,
        PeerCountryStrategy.ParentRegions,
    ] as const)(
        "rejects a region target with the %s strategy",
        async (strategy) => {
            const peers = await selectPeers({
                peerCountryStrategy: strategy,
                targetEntity: "Europe",
                availableEntities: [...REGIONS, "World", ...COUNTRIES],
                additionalDataLoaderFn: loadPeersOfEurope,
            })
            expect(peers).toEqual([])
        }
    )

    it("picks a region target's peers by value with the dataRange strategy", async () => {
        const peers = await selectPeers({
            peerCountryStrategy: PeerCountryStrategy.DataRange,
            targetEntity: "Europe",
            availableEntities: REGIONS,
            dataColumn: regionColumn,
            endTime: 2020,
            isSingleTimeChart: false,
            additionalDataLoaderFn,
            targetCount: 3,
        })
        expect(peers).toHaveLength(3)
        expect(peers).not.toContain("Europe")
        expect(REGIONS).toEqual(expect.arrayContaining(peers))
    })
})

describe("peerCount query param", () => {
    it("parses a positive integer", () => {
        expect(parseGrapherQueryParams({ peerCount: "3" }).peerCount).toEqual({
            status: "valid",
            value: 3,
        })
    })

    it("is missing when absent and invalid for anything else", () => {
        expect(parseGrapherQueryParams({}).peerCount.status).toBe("missing")
        for (const value of ["0", "-2", "abc", ""])
            expect(
                parseGrapherQueryParams({ peerCount: value }).peerCount.status
            ).toBe("invalid")
    })
})

const DATA_RANGE_SPREAD = ["Germany", "Spain", "Norway", "Finland", "Austria"]
const DATA_RANGE_PEERS_OF_ITALY = ["Germany", "Norway", "Finland", "Austria"]

describe(selectPeersForGrapherWithGuards, () => {
    it("adds nothing for the none strategy", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA",
            peerCountryStrategy: PeerCountryStrategy.None,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual([])
    })

    it("adds nothing when the selection is disabled", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA",
            addCountryMode: EntitySelectionMode.Disabled,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual([])
    })

    it("adds peers of the first available selected entity", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=Atlantis~ITA",
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual(
            DATA_RANGE_PEERS_OF_ITALY
        )
    })

    it("takes the first peerCount entities of the default selection, selected ones included", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=FRA~DEU",
            peerCountryStrategy: PeerCountryStrategy.DefaultSelection,
            selectedEntityNames: ["Germany", "Norway", "Italy", "Spain"],
            peerCount: 2,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual([
            "Germany",
            "Norway",
        ])
    })

    it("spreads over a selection with no available entity", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~Atlantis",
            selectedEntityNames: ["Norway"],
            peerCount: 5,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual(
            DATA_RANGE_SPREAD
        )
    })

    it("spreads over an empty selection", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=",
            selectedEntityNames: ["Norway"],
            peerCount: 5,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual(
            DATA_RANGE_SPREAD
        )
    })

    it("restores the author's selection when an empty selection gets no spread", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=",
            selectedEntityNames: ["Norway"],
            additionalDataLoaderFn: undefined,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual([
            "Norway",
        ])
    })

    it.each<{ name: string; config: GrapherProgrammaticInterface }>([
        {
            name: "single-entity mode",
            config: { addCountryMode: EntitySelectionMode.SingleEntity },
        },
        {
            name: "a faceted chart",
            config: {
                queryStr: "?country=ITA~FRA",
                selectedFacetStrategy: FacetStrategy.entity,
            },
        },
        {
            name: "a chart that plots one series per column",
            config: { ySlugs: "value other" },
        },
        {
            name: "a stacked area chart",
            config: { chartTypes: [GRAPHER_CHART_TYPES.StackedArea] },
        },
        {
            name: "a stacked bar chart",
            config: { chartTypes: [GRAPHER_CHART_TYPES.StackedBar] },
        },
        {
            name: "the map tab",
            config: { hasMapTab: true, tab: GRAPHER_TAB_CONFIG_OPTIONS.map },
        },
    ])("adds nothing to a selection in $name", async ({ config }) => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA",
            selectedEntityNames: ["Norway"],
            ...config,
        })
        expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual([])
    })

    it.each<{ name: string; config: GrapherProgrammaticInterface }>([
        {
            name: "a stacked area chart",
            config: { chartTypes: [GRAPHER_CHART_TYPES.StackedArea] },
        },
        {
            name: "the map tab",
            config: { hasMapTab: true, tab: GRAPHER_TAB_CONFIG_OPTIONS.map },
        },
    ])(
        "restores the author's selection for an empty selection in $name",
        async ({ config }) => {
            const grapherState = makeGrapherState({
                queryStr: "?country=",
                selectedEntityNames: ["Norway"],
                ...config,
            })
            expect(await selectPeersForGrapherWithGuards(grapherState)).toEqual(
                ["Norway"]
            )
        }
    )
})

describe(selectPeersForGrapher, () => {
    it("targets the single selected entity with the chart's strategy", async () => {
        const grapherState = makeGrapherState({ queryStr: "?country=~ITA" })
        expect(await selectPeersForGrapher(grapherState)).toEqual(
            DATA_RANGE_PEERS_OF_ITALY
        )
    })

    it("needs a target when several entities are selected", async () => {
        const grapherState = makeGrapherState({ queryStr: "?country=ITA~FRA" })
        expect(await selectPeersForGrapher(grapherState)).toEqual([])
        expect(
            await selectPeersForGrapher(grapherState, {
                targetEntity: "Italy",
            })
        ).toEqual(DATA_RANGE_PEERS_OF_ITALY)
    })

    it("spreads without a target", async () => {
        const grapherState = makeGrapherState({ queryStr: "?country=" })
        expect(
            await selectPeersForGrapher(grapherState, { targetCount: 5 })
        ).toEqual(DATA_RANGE_SPREAD)
    })
})

describe("peer params in the URL", () => {
    it("adds peers of the selected entity before a static render", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA&peerCountries=dataRange",
        })
        expect(await renderSelection(grapherState)).toEqual([
            "Italy",
            ...DATA_RANGE_PEERS_OF_ITALY,
        ])
    })

    it("spreads over an empty country param", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=&peerCountries=dataRange&peerCount=5",
            selectedEntityNames: ["Norway"],
        })
        expect(await renderSelection(grapherState)).toEqual(DATA_RANGE_SPREAD)
    })

    it("adds peerCount entities and leaves both params out of the URL it writes", async () => {
        const grapherState = makeGrapherState({
            queryStr:
                "?country=~FRA&peerCountries=defaultSelection&peerCount=2",
            selectedEntityNames: ["Germany", "Norway", "Italy"],
        })
        expect(await renderSelection(grapherState)).toEqual([
            "France",
            "Germany",
            "Norway",
        ])
        expect(grapherState.changedParams).not.toHaveProperty("peerCountries")
        expect(grapherState.changedParams).not.toHaveProperty("peerCount")
    })

    it("falls back to dataRange for auto when the chart has no strategy", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA&peerCountries=auto",
            peerCountryStrategy: undefined,
        })
        expect(await renderSelection(grapherState)).toEqual([
            "Italy",
            ...DATA_RANGE_PEERS_OF_ITALY,
        ])
    })

    it("keeps the chart's strategy for auto", async () => {
        const grapherState = makeGrapherState({
            queryStr: "?country=~ITA&peerCountries=auto",
            peerCountryStrategy: PeerCountryStrategy.DefaultSelection,
            selectedEntityNames: ["Germany"],
        })
        expect(await renderSelection(grapherState)).toEqual([
            "Italy",
            "Germany",
        ])
    })
})

function makeGrapherState({
    peerCount,
    ...config
}: GrapherProgrammaticInterface & { peerCount?: number }): GrapherState {
    const table = new OwidTable(
        [
            ["entityName", "year", "value", "other"],
            ...COUNTRIES.map((name, index) => [
                name,
                2020,
                (index + 1) * 10,
                index,
            ]),
        ],
        [
            { slug: "year", type: ColumnTypeNames.Year },
            { slug: "value", type: ColumnTypeNames.Numeric },
            { slug: "other", type: ColumnTypeNames.Numeric },
        ]
    )
    const grapherState = new GrapherState({
        table,
        chartTypes: [GRAPHER_CHART_TYPES.LineChart],
        ySlugs: "value",
        peerCountryStrategy: PeerCountryStrategy.DataRange,
        additionalDataLoaderFn: loadAlternatingPopulation,
        ...config,
    })
    if (peerCount !== undefined) grapherState.peerCount = peerCount
    return grapherState
}

async function renderSelection(
    grapherState: GrapherState
): Promise<EntityName[]> {
    let renderedSelection: EntityName[] = []
    await grapherState.generateStaticSvg(() => {
        renderedSelection = [...grapherState.selection.selectedEntityNames]
        return ""
    })
    return renderedSelection
}
