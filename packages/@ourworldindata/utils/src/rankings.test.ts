/**
 * Rank rules for ranking blocks (ranking-cards, peer-ranking,
 * peer-comparison). A LinkedRanking holds one row per country with data;
 * these helpers derive ranks within peer groups, rank changes, and decide
 * whether a block has anything to show. Expected values are spelled out by
 * hand so a reviewer can check them against the fixture.
 */
import { describe, expect, it } from "vitest"
import {
    EnrichedBlockPeerComparison,
    EnrichedBlockPeerRanking,
    EnrichedBlockRankingCards,
    LinkedRanking,
    LinkedRankingRow,
} from "@ourworldindata/types"
import {
    checkIsPeerGroupName,
    checkShouldRankingBlockRender,
    computeRankSummary,
    defaultPeerGroupsForEntity,
    formatOrdinal,
    getEntityCodeFromChartUrl,
    getRankingSpecsForBlock,
    makeLinkedRankingKey,
    rankRows,
    resolvePeerGroupCodes,
} from "./rankings.js"
import { neighboursData } from "./regions/neighbours.data.js"
import { getRegionByCode } from "./regions/index.js"

const row = (
    code: string,
    value: number,
    prevValue?: number
): LinkedRankingRow => ({
    code,
    value,
    time: 2020,
    formattedValue: String(value),
    prevValue,
})

const makeRanking = (rows: LinkedRankingRow[]): LinkedRanking => ({
    chartKey: "https://ourworldindata.org/grapher/life-expectancy",
    columnSlug: "123",
    title: "Life expectancy",
    source: "UN WPP",
    time: 2020,
    formattedTime: "2020",
    rows,
})

describe(makeLinkedRankingKey, () => {
    it("ignores the origin and entity selection but keeps time and view params", () => {
        expect(
            makeLinkedRankingKey(
                "https://ourworldindata.org/grapher/life-expectancy?country=~DEU&tab=map&time=2020"
            )
        ).toBe("/grapher/life-expectancy?time=2020")
        expect(
            makeLinkedRankingKey("http://localhost:3030/grapher/x?country=FRA")
        ).toBe(makeLinkedRankingKey("https://ourworldindata.org/grapher/x"))
        expect(
            makeLinkedRankingKey(
                "https://ourworldindata.org/grapher/mdim?metric=a&country=~DEU"
            )
        ).toBe("/grapher/mdim?metric=a")
    })

    it("distinguishes options that change the computed values", () => {
        const url = "https://ourworldindata.org/grapher/x?country=~DEU"
        expect(
            makeLinkedRankingKey(url, {
                column: "gdp",
                tolerance: 2,
                changeSinceYears: 10,
            })
        ).toBe("/grapher/x|column=gdp|tolerance=2|changeSince=10")
        expect(makeLinkedRankingKey(url, { tolerance: 0 })).not.toBe(
            makeLinkedRankingKey(url)
        )
    })
})

describe(getEntityCodeFromChartUrl, () => {
    it.each([
        ["https://ourworldindata.org/grapher/x?country=~DEU", "DEU"],
        ["https://ourworldindata.org/grapher/x?country=DEU", "DEU"],
        ["https://ourworldindata.org/grapher/x?country=~Germany", "DEU"],
        ["https://ourworldindata.org/grapher/x?country=DEU~FRA", undefined],
        ["https://ourworldindata.org/grapher/x?country=~Narnia", undefined],
        ["https://ourworldindata.org/grapher/x", undefined],
    ])("%s -> %s", (url, expected) => {
        expect(getEntityCodeFromChartUrl(url)).toBe(expected)
    })
})

describe(rankRows, () => {
    it("uses competition ranking for ties, best first", () => {
        const rows = [row("A", 10), row("B", 30), row("C", 20), row("D", 30)]
        expect(
            rankRows(rows, "highest").map(({ row, rank }) => [row.code, rank])
        ).toEqual([
            ["B", 1],
            ["D", 1],
            ["C", 3],
            ["A", 4],
        ])
        expect(
            rankRows(rows, "lowest").map(({ row, rank }) => [row.code, rank])
        ).toEqual([
            ["A", 1],
            ["C", 2],
            ["B", 3],
            ["D", 3],
        ])
    })
})

describe(computeRankSummary, () => {
    const ranking = makeRanking([
        row("A", 50),
        row("B", 40),
        row("C", 40),
        row("D", 30),
        row("E", 10),
    ])

    it("ranks highest-first by default and reports the group size", () => {
        expect(computeRankSummary(ranking, "D", "highest")).toMatchObject({
            rank: 4,
            total: 5,
            topPercent: 80,
            percentile: 0.25,
        })
    })

    it("shares ranks between ties", () => {
        expect(computeRankSummary(ranking, "B", "highest")?.rank).toBe(2)
        expect(computeRankSummary(ranking, "C", "highest")?.rank).toBe(2)
    })

    it("ranks lowest-first for sort: lowest, but keeps the value-based percentile", () => {
        const summary = computeRankSummary(ranking, "E", "lowest")
        expect(summary).toMatchObject({
            rank: 1,
            total: 5,
            topPercent: 20,
            // E has the lowest value, so it sits at the left of the bar
            percentile: 0,
        })
    })

    it("restricts the ranking to a peer group", () => {
        const summary = computeRankSummary(
            ranking,
            "D",
            "highest",
            new Set(["C", "D", "E"])
        )
        expect(summary).toMatchObject({ rank: 2, total: 3, percentile: 0.5 })
    })

    it("returns undefined when the entity has no row or is outside the group", () => {
        expect(computeRankSummary(ranking, "Z", "highest")).toBeUndefined()
        expect(
            computeRankSummary(ranking, "A", "highest", new Set(["B", "C"]))
        ).toBeUndefined()
    })

    it("puts a single-country group at the top of the bar", () => {
        expect(
            computeRankSummary(ranking, "A", "highest", new Set(["A"]))
        ).toMatchObject({ rank: 1, total: 1, percentile: 1, topPercent: 100 })
    })

    it("computes the rank change among rows that have a previous value", () => {
        const withPrev = makeRanking([
            row("A", 50, 20),
            row("B", 40, 30),
            row("C", 30, 40),
            // no previous value: not part of the previous ranking
            row("D", 20),
        ])
        // C was 1st of 3, is now 3rd of 4 -> moved down 2 places
        expect(computeRankSummary(withPrev, "C", "highest")).toMatchObject({
            rank: 3,
            prevRank: 1,
            prevTotal: 3,
            rankChange: -2,
        })
        // A was 3rd, is now 1st -> moved up 2 places
        expect(computeRankSummary(withPrev, "A", "highest")?.rankChange).toBe(2)
        // lower is better: A went from 1st lowest to 4th lowest
        expect(computeRankSummary(withPrev, "A", "lowest")).toMatchObject({
            rank: 4,
            prevRank: 1,
            rankChange: -3,
        })
        const noPrev = computeRankSummary(withPrev, "D", "highest")
        expect(noPrev?.prevRank).toBeUndefined()
        expect(noPrev?.rankChange).toBeUndefined()
    })
})

describe(resolvePeerGroupCodes, () => {
    const rows = [row("DEU", 1), row("FRA", 2), row("NGA", 3), row("JPN", 4)]

    it("includes all rows for World / All countries", () => {
        expect(resolvePeerGroupCodes("World", rows)).toEqual(
            new Set(["DEU", "FRA", "NGA", "JPN"])
        )
        expect(resolvePeerGroupCodes("all countries", rows)?.size).toBe(4)
    })

    it("intersects region members with the rows", () => {
        expect(resolvePeerGroupCodes("Europe", rows)).toEqual(
            new Set(["DEU", "FRA"])
        )
        expect(resolvePeerGroupCodes("High-income countries", rows)).toEqual(
            new Set(["DEU", "FRA", "JPN"])
        )
    })

    it("resolves Neighbours to the entity and its neighbours with data", () => {
        const withNeighbours = [...rows, row("POL", 5), row("AUT", 6)]
        expect(
            resolvePeerGroupCodes("Neighbours", withNeighbours, "DEU")
        ).toEqual(new Set(["DEU", "FRA", "POL", "AUT"]))
    })

    it("makes Neighbours unavailable without land neighbours or entity", () => {
        // Japan is an island country
        expect(resolvePeerGroupCodes("Neighbours", rows, "JPN")).toBeUndefined()
        expect(resolvePeerGroupCodes("Neighbours", rows)).toBeUndefined()
    })

    it("resolves Neighbours for borders missing from the map", () => {
        // Monaco is too small to share a border on the map, Norway–Russia is
        // lost in the map's simplification; both come from manual overrides
        const europe = [row("MCO", 1), row("FRA", 2), row("NOR", 3)]
        expect(resolvePeerGroupCodes("Neighbours", europe, "MCO")).toEqual(
            new Set(["MCO", "FRA"])
        )
        expect(
            resolvePeerGroupCodes(
                "Neighbours",
                [row("RUS", 1), ...europe],
                "NOR"
            )
        ).toEqual(new Set(["NOR", "RUS"]))
    })

    it("returns undefined for unknown groups and for countries", () => {
        expect(resolvePeerGroupCodes("Narnia", rows)).toBeUndefined()
        expect(resolvePeerGroupCodes("Germany", rows)).toBeUndefined()
    })
})

describe("land neighbours data", () => {
    it("lists Germany's nine land neighbours", () => {
        expect(neighboursData.DEU).toEqual([
            "AUT",
            "BEL",
            "CHE",
            "CZE",
            "DNK",
            "FRA",
            "LUX",
            "NLD",
            "POL",
        ])
    })

    it("omits island countries", () => {
        expect(neighboursData.JPN).toBeUndefined()
        expect(neighboursData.ISL).toBeUndefined()
    })

    it("is symmetric and only contains known codes", () => {
        for (const [code, neighbours] of Object.entries(neighboursData)) {
            expect(getRegionByCode(code)).toBeDefined()
            for (const neighbour of neighbours)
                expect(neighboursData[neighbour]).toContain(code)
        }
    })
})

describe(checkIsPeerGroupName, () => {
    it.each([
        ["World", true],
        ["All countries", true],
        ["Europe", true],
        ["European Union (27)", true],
        ["Lower-middle-income countries", true],
        ["Neighbours", true],
        ["Germany", false],
        ["Narnia", false],
    ])("%s -> %s", (name, expected) => {
        expect(checkIsPeerGroupName(name)).toBe(expected)
    })
})

describe(defaultPeerGroupsForEntity, () => {
    it("offers neighbours (if any), continent, income group, EU (if member) and World", () => {
        expect(defaultPeerGroupsForEntity("DEU")).toEqual([
            "Neighbours",
            "Europe",
            "High-income countries",
            "European Union (27)",
            "World",
        ])
        expect(defaultPeerGroupsForEntity("NGA")).toEqual([
            "Neighbours",
            "Africa",
            "Lower-middle-income countries",
            "World",
        ])
    })

    it("skips Neighbours for countries without land neighbours", () => {
        expect(defaultPeerGroupsForEntity("JPN")).not.toContain("Neighbours")
    })

    it("offers nothing for aggregates and unknown codes", () => {
        expect(defaultPeerGroupsForEntity("OWID_EUR")).toEqual([])
        expect(defaultPeerGroupsForEntity("XXX")).toEqual([])
    })
})

describe(formatOrdinal, () => {
    it.each([
        [1, "1st"],
        [2, "2nd"],
        [3, "3rd"],
        [4, "4th"],
        [11, "11th"],
        [12, "12th"],
        [13, "13th"],
        [21, "21st"],
        [102, "102nd"],
        [111, "111th"],
    ])("%d -> %s", (n, expected) => {
        expect(formatOrdinal(n)).toBe(expected)
    })
})

describe(checkShouldRankingBlockRender, () => {
    const lifeUrl =
        "https://ourworldindata.org/grapher/life-expectancy?country=~DEU"
    const gdpUrl = "https://ourworldindata.org/grapher/gdp?country=~DEU"
    const rankingWith = (codes: string[]): LinkedRanking =>
        makeRanking(codes.map((code, i) => row(code, i)))

    const cards: EnrichedBlockRankingCards = {
        type: "ranking-cards",
        sparklines: false,
        changeSinceYears: 10,
        cards: [
            { url: lifeUrl, sort: "highest" },
            { url: gdpUrl, sort: "lowest", column: "gdp" },
        ],
        parseErrors: [],
    }
    const peerRanking: EnrichedBlockPeerRanking = {
        type: "peer-ranking",
        url: lifeUrl,
        groups: [],
        sort: "highest",
        tolerance: 5,
        parseErrors: [],
    }
    const comparison: EnrichedBlockPeerComparison = {
        type: "peer-comparison",
        groups: [],
        indicators: [{ url: lifeUrl }, { url: gdpUrl }],
        parseErrors: [],
    }

    it("derives one spec per card / indicator, with the block's options in the key", () => {
        expect(getRankingSpecsForBlock(cards).map((s) => s.key)).toEqual([
            "/grapher/life-expectancy|changeSince=10",
            "/grapher/gdp|column=gdp|changeSince=10",
        ])
        expect(getRankingSpecsForBlock(peerRanking).map((s) => s.key)).toEqual([
            "/grapher/life-expectancy|tolerance=5",
        ])
        expect(getRankingSpecsForBlock(comparison).map((s) => s.key)).toEqual([
            "/grapher/life-expectancy",
            "/grapher/gdp",
        ])
    })

    it("renders when at least one ranking has a row for the URL's country", () => {
        const [, gdpSpec] = getRankingSpecsForBlock(cards)
        const onlyGdp = { [gdpSpec.key]: rankingWith(["DEU", "FRA"]) }
        expect(checkShouldRankingBlockRender(cards, onlyGdp)).toBe(true)

        const comparisonKeys = getRankingSpecsForBlock(comparison)
        expect(
            checkShouldRankingBlockRender(comparison, {
                [comparisonKeys[0].key]: rankingWith(["FRA"]),
                [comparisonKeys[1].key]: rankingWith(["DEU"]),
            })
        ).toBe(true)
    })

    it("hides when no ranking has a row for the country", () => {
        const [spec] = getRankingSpecsForBlock(peerRanking)
        expect(checkShouldRankingBlockRender(peerRanking, {})).toBe(false)
        expect(
            checkShouldRankingBlockRender(peerRanking, {
                [spec.key]: rankingWith(["FRA", "NGA"]),
            })
        ).toBe(false)
        // An explicit entity code overrides the URL's country
        expect(
            checkShouldRankingBlockRender(
                peerRanking,
                { [spec.key]: rankingWith(["FRA", "NGA"]) },
                "FRA"
            )
        ).toBe(true)
    })
})
