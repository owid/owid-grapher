/**
 * linkedRankings for profiles: how ranking blocks (ranking-cards,
 * peer-ranking, peer-comparison) get their data when a profile template is
 * instantiated per entity from prepared chart tables (the bake path).
 *
 * Contract:
 * - Rankings are keyed by getRankingSpecsForBlock keys, which the site uses
 *   for lookups, and found in tables prepared for data-callouts too (the
 *   chart key ignores the URL's origin and grapher params).
 * - A ranking contains all listed countries with data, never aggregates, and
 *   is entity-independent: with a shared RankingCache, it's computed once per
 *   template and reused; only the sparkline differs per entity.
 * - checkShouldProfileRender counts ranking blocks as data blocks: a profile
 *   whose only data blocks are rankings renders iff the entity has a row.
 */
import { describe, expect, it } from "vitest"
import {
    ColumnTypeNames,
    OwidGdocType,
    OwidTableSlugs,
    type EnrichedBlockPeerRanking,
    type EnrichedBlockRankingCards,
    type OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import type { PreparedCalloutTable } from "@ourworldindata/grapher"
import { getRankingSpecsForBlock } from "@ourworldindata/utils"
// Import via the factory first, as the gdoc modules have an import cycle
import { gdocFromJSON } from "./GdocFactory.js"
import { GdocProfile, instantiateProfileForEntity } from "./GdocProfile.js"
import {
    checkShouldProfileRender,
    createRankingCache,
    extractRankingSpecs,
} from "./dataCallouts.js"

const LE_URL = "https://ourworldindata.org/grapher/life-expectancy"

const makePrepared = (
    rows: [entity: string, year: number, value: number][]
): PreparedCalloutTable => {
    const table = new OwidTable(
        [[OwidTableSlugs.EntityName, OwidTableSlugs.Year, "le"], ...rows],
        [
            { slug: OwidTableSlugs.EntityName, type: ColumnTypeNames.EntityName },
            { slug: OwidTableSlugs.Year, type: ColumnTypeNames.Year },
            { slug: "le", type: ColumnTypeNames.Numeric, name: "LE" },
        ]
    )
    return {
        inputTable: table,
        yColumnSlugs: ["le"],
        xColumnSlug: undefined,
        columns: { le: { name: "Life expectancy", shortName: "le" } },
        sourcesLine: "UN WPP",
        times: table.getTimesUniqSortedAscForColumns(["le"]),
        minTime: -Infinity,
        maxTime: Infinity,
    }
}

// Keyed like prepareCalloutTablesForProfile keys a data-callout's chart
const preparedTables = new Map([
    [
        "/grapher/life-expectancy",
        makePrepared([
            ["Germany", 2010, 80],
            ["Germany", 2020, 81],
            ["France", 2020, 82],
            ["Japan", 2020, 84],
            ["World", 2010, 70],
            ["World", 2020, 72],
            ["Europe", 2020, 79],
        ]),
    ],
])

const rankingCards = (
    url = `${LE_URL}?country=$entityCode`
): EnrichedBlockRankingCards => ({
    type: "ranking-cards",
    sparklines: true,
    changeSinceYears: 10,
    cards: [{ url, sort: "highest" }],
    parseErrors: [],
})

const makeTemplate = (body: OwidEnrichedGdocBlock[]): GdocProfile => {
    const template = gdocFromJSON({
        id: "profile-rankings-test",
        slug: "country",
        content: {
            type: OwidGdocType.Profile,
            title: "$EntityName",
            authors: [],
            scope: "countries",
            body,
        },
    })
    if (!(template instanceof GdocProfile)) throw new Error("Not a profile")
    return template
}

const GERMANY = { name: "Germany", code: "DEU" }
const FRANCE = { name: "France", code: "FRA" }
const NIGERIA = { name: "Nigeria", code: "NGA" }

describe("linkedRankings of instantiated profiles", () => {
    const template = makeTemplate([rankingCards()])
    const key = getRankingSpecsForBlock(rankingCards())[0].key

    it("ranks all countries with data, excluding aggregates", async () => {
        const profile = await instantiateProfileForEntity(template, GERMANY, {
            preparedTables,
        })
        const ranking = profile.linkedRankings[key]
        expect(
            ranking?.rows.map((row) => [row.code, row.value, row.prevValue])
        ).toEqual([
            ["DEU", 81, 80],
            ["FRA", 82, undefined],
            ["JPN", 84, undefined],
        ])
        expect(ranking?.worldValue).toBe(72)
    })

    it("computes the ranking once per template and the sparkline per entity", async () => {
        const rankingCache = createRankingCache()
        const options = { preparedTables, rankingCache }
        const germany = await instantiateProfileForEntity(
            template,
            GERMANY,
            options
        )
        const france = await instantiateProfileForEntity(
            template,
            FRANCE,
            options
        )

        expect([...rankingCache.keys()]).toEqual([key])
        // Same cached rows, not a recomputation
        expect(france.linkedRankings[key]?.rows).toBe(
            germany.linkedRankings[key]?.rows
        )
        expect(germany.linkedRankings[key]?.sparkline).toEqual({
            entity: [
                [2010, 80],
                [2020, 81],
            ],
            world: [
                [2010, 70],
                [2020, 72],
            ],
        })
        expect(france.linkedRankings[key]?.sparkline?.entity).toEqual([
            [2020, 82],
        ])
        // The cached ranking itself carries no entity's sparkline
        expect(rankingCache.get(key)?.sparkline).toBeUndefined()
    })

    it("renders a profile with only ranking blocks iff the entity has a row", async () => {
        const germany = await instantiateProfileForEntity(template, GERMANY, {
            preparedTables,
        })
        const nigeria = await instantiateProfileForEntity(template, NIGERIA, {
            preparedTables,
        })

        expect(
            checkShouldProfileRender(germany.content, germany.linkedRankings)
        ).toBe(true)
        // The ranking exists (other countries have data), but not for Nigeria
        expect(nigeria.linkedRankings[key]).toBeDefined()
        expect(
            checkShouldProfileRender(nigeria.content, nigeria.linkedRankings)
        ).toBe(false)
    })

    it("skips rankings for charts that couldn't be prepared", async () => {
        const profile = await instantiateProfileForEntity(
            makeTemplate([
                rankingCards(
                    "https://ourworldindata.org/grapher/missing?country=$entityCode"
                ),
            ]),
            GERMANY,
            { preparedTables }
        )
        expect(profile.linkedRankings).toEqual({})
        expect(
            checkShouldProfileRender(profile.content, profile.linkedRankings)
        ).toBe(false)
    })
})

describe(extractRankingSpecs, () => {
    it("returns one spec per key and keeps the sparkline if any block wants it", () => {
        const url = `${LE_URL}?country=DEU`
        const peerRanking: EnrichedBlockPeerRanking = {
            type: "peer-ranking",
            url,
            groups: [],
            sort: "highest",
            parseErrors: [],
        }
        const cards = rankingCards(url)
        const cardsWithOtherWindow = { ...cards, changeSinceYears: 5 }

        const specs = extractRankingSpecs([
            peerRanking,
            { ...cards, sparklines: false },
            cards,
            cardsWithOtherWindow,
        ])

        expect(
            specs.map((spec) => [spec.key, spec.includeSparkline])
        ).toEqual([
            ["/grapher/life-expectancy", false],
            ["/grapher/life-expectancy|changeSince=10", true],
            ["/grapher/life-expectancy|changeSince=5", true],
        ])
    })
})
