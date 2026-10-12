/**
 * The ranking blocks ({.ranking-cards}, {.peer-ranking}, {.peer-comparison})
 * are authored in country profile templates with a single-country chart URL
 * per card / indicator (usually `?country=$entityCode`). These tests pin:
 *
 * - parsing: the documented ArchieML shape, defaults, and peer group names
 *   (including region names that contain commas);
 * - validation: every invalid input drops the block's content and reports
 *   one targeted error, so a broken template can't be published;
 * - serialisation: enriched → raw → ArchieML → enriched is lossless;
 * - text exports: markdown / indexable text read values from
 *   `linkedRankings` and are dropped without them.
 */
import { describe, expect, it } from "vitest"
import { load } from "archieml"
import {
    EnrichedBlockPeerComparison,
    EnrichedBlockPeerRanking,
    EnrichedBlockRankingCards,
    LinkedRanking,
    LinkedRankings,
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "@ourworldindata/types"
import { getRankingSpecsForBlock } from "@ourworldindata/utils"
import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"
import { enrichedBlockToRawBlock } from "./enrichedToRaw.js"
import { OwidRawGdocBlockToArchieMLString } from "./rawToArchie.js"
import { enrichedBlockToMarkdown } from "./enrichedToMarkdown.js"
import { enrichedBlockToIndexableText } from "./enrichedToIndexableText.js"

function parseBody(archie: string): OwidEnrichedGdocBlock {
    const body: OwidRawGdocBlock[] = load(`[+body]\n${archie}\n[]`).body
    expect(body).toHaveLength(1)
    const block = parseRawBlocksToEnrichedBlocks(body[0])
    if (!block) throw new Error("Block was dropped")
    return block
}

const LE_URL = "https://ourworldindata.org/grapher/life-expectancy"
const CM_URL = "https://ourworldindata.org/grapher/child-mortality"

describe("parsing ranking blocks", () => {
    it("parses ranking-cards with per-card options", () => {
        const block = parseBody(`{.ranking-cards}
title: $EntityName at a glance
subtitle: Compared with all countries
sparklines: true
change-since: 20
[.cards]
url: ${LE_URL}?country=$entityCode
topic: Health
url: ${CM_URL}?country=$entityCode
title: Child mortality
topic: Health
sort: lowest
column: under_five_mortality
[]
{}`)

        expect(block).toEqual({
            type: "ranking-cards",
            title: "$EntityName at a glance",
            subtitle: "Compared with all countries",
            sparklines: true,
            changeSinceYears: 20,
            cards: [
                {
                    url: `${LE_URL}?country=$entityCode`,
                    title: undefined,
                    topic: "Health",
                    sort: "highest",
                    column: undefined,
                },
                {
                    url: `${CM_URL}?country=$entityCode`,
                    title: "Child mortality",
                    topic: "Health",
                    sort: "lowest",
                    column: "under_five_mortality",
                },
            ],
            parseErrors: [],
        } satisfies EnrichedBlockRankingCards)
    })

    it("defaults ranking-cards to no sparklines, 10 years and highest-first", () => {
        const block = parseBody(`{.ranking-cards}
[.cards]
url: ${LE_URL}?country=DEU
[]
{}`) as EnrichedBlockRankingCards

        expect(block.parseErrors).toEqual([])
        expect(block.sparklines).toBe(false)
        expect(block.changeSinceYears).toBe(10)
        expect(block.cards[0].sort).toBe("highest")
    })

    it("parses peer-ranking with groups, sort and tolerance", () => {
        const block = parseBody(`{.peer-ranking}
url: ${CM_URL}?country=DEU
title: Child mortality
groups: Neighbours, Europe, European Union (27), High-income countries, World
sort: lowest
tolerance: 0
column: under_five_mortality
{}`)

        expect(block).toEqual({
            type: "peer-ranking",
            url: `${CM_URL}?country=DEU`,
            title: "Child mortality",
            groups: [
                "Neighbours",
                "Europe",
                "European Union (27)",
                "High-income countries",
                "World",
            ],
            sort: "lowest",
            tolerance: 0,
            column: "under_five_mortality",
            parseErrors: [],
        } satisfies EnrichedBlockPeerRanking)
    })

    it("leaves groups empty when omitted, meaning the entity's default groups", () => {
        const block = parseBody(`{.peer-ranking}
url: ${LE_URL}?country=DEU
{}`) as EnrichedBlockPeerRanking

        expect(block.parseErrors).toEqual([])
        expect(block.groups).toEqual([])
        expect(block.tolerance).toBeUndefined()
    })

    it("keeps region names that contain commas together", () => {
        const block = parseBody(`{.peer-comparison}
groups: Northern, Southern and Western Europe (ILO), All countries
[.indicators]
url: ${LE_URL}?country=DEU
[]
{}`) as EnrichedBlockPeerComparison

        expect(block.parseErrors).toEqual([])
        expect(block.groups).toEqual([
            "Northern, Southern and Western Europe (ILO)",
            "All countries",
        ])
    })

    it("parses peer-comparison indicators", () => {
        const block = parseBody(`{.peer-comparison}
title: How $entityName compares
groups: Europe, World
[.indicators]
url: ${LE_URL}?country=$entityCode
url: https://ourworldindata.org/grapher/gdp-per-capita-worldbank?country=$entityCode
title: GDP per capita
[]
{}`)

        expect(block).toEqual({
            type: "peer-comparison",
            title: "How $entityName compares",
            groups: ["Europe", "World"],
            indicators: [
                {
                    url: `${LE_URL}?country=$entityCode`,
                    title: undefined,
                    column: undefined,
                },
                {
                    url: "https://ourworldindata.org/grapher/gdp-per-capita-worldbank?country=$entityCode",
                    title: "GDP per capita",
                    column: undefined,
                },
            ],
            parseErrors: [],
        } satisfies EnrichedBlockPeerComparison)
    })
})

describe("ranking block validation", () => {
    const cards = (card: string, props = ""): string =>
        `{.ranking-cards}\n${props}[.cards]\n${card}\n[]\n{}`

    it.each([
        {
            name: "card without url",
            archie: cards("topic: Health"),
            error: "Missing url for ranking-cards card 1",
        },
        {
            name: "card selecting two countries",
            archie: cards(`url: ${LE_URL}?country=DEU~FRA`),
            error: "ranking-cards card 1 url must specify exactly one country",
        },
        {
            name: "card without a country",
            archie: cards(`url: ${LE_URL}`),
            error: "ranking-cards card 1 url must specify exactly one country",
        },
        {
            name: "card linking to an article",
            archie: cards(
                "url: https://ourworldindata.org/life-expectancy?country=DEU"
            ),
            error: "ranking-cards card 1 url must be a grapher or explorer link",
        },
        {
            name: "card with an invalid sort",
            archie: cards(`url: ${LE_URL}?country=DEU\nsort: best`),
            error: 'ranking-cards card 1 sort must be "highest" or "lowest"',
        },
        {
            name: "no cards",
            archie: "{.ranking-cards}\ntitle: At a glance\n{}",
            error: "ranking-cards must have at least one card",
        },
        {
            name: "non-numeric change-since",
            archie: cards(`url: ${LE_URL}?country=DEU`, "change-since: ten\n"),
            error: "ranking-cards change-since must be a whole number",
        },
        {
            name: "zero change-since",
            archie: cards(`url: ${LE_URL}?country=DEU`, "change-since: 0\n"),
            error: "ranking-cards change-since must be a whole number",
        },
        {
            name: "non-boolean sparklines",
            archie: cards(`url: ${LE_URL}?country=DEU`, "sparklines: yes\n"),
            error: 'sparklines must be either "true" or "false"',
        },
    ])("ranking-cards: $name", ({ archie, error }) => {
        const block = parseBody(archie) as EnrichedBlockRankingCards
        expect(block.cards).toEqual([])
        expect(block.parseErrors).toHaveLength(1)
        expect(block.parseErrors[0].message).toContain(error)
        expect(block.parseErrors[0].isWarning).toBeFalsy()
    })

    it.each([
        {
            name: "missing url",
            archie: "{.peer-ranking}\ngroups: Europe\n{}",
            error: "Missing url for peer-ranking block",
        },
        {
            name: "unknown group",
            archie: `{.peer-ranking}\nurl: ${LE_URL}?country=DEU\ngroups: Europe, G7\n{}`,
            error: 'peer-ranking has an unknown peer group "G7"',
        },
        {
            name: "a country instead of a group",
            archie: `{.peer-ranking}\nurl: ${LE_URL}?country=DEU\ngroups: France\n{}`,
            error: 'peer-ranking has an unknown peer group "France"',
        },
        {
            name: "invalid sort",
            archie: `{.peer-ranking}\nurl: ${LE_URL}?country=DEU\nsort: up\n{}`,
            error: 'peer-ranking sort must be "highest" or "lowest"',
        },
        {
            name: "negative tolerance",
            archie: `{.peer-ranking}\nurl: ${LE_URL}?country=DEU\ntolerance: -1\n{}`,
            error: "peer-ranking tolerance must be a whole number",
        },
    ])("peer-ranking: $name", ({ archie, error }) => {
        const block = parseBody(archie) as EnrichedBlockPeerRanking
        expect(block.url).toBe("")
        expect(block.parseErrors).toHaveLength(1)
        expect(block.parseErrors[0].message).toContain(error)
    })

    it.each([
        {
            name: "no indicators",
            archie: "{.peer-comparison}\ngroups: Europe\n{}",
            error: "peer-comparison must have at least one indicator",
        },
        {
            name: "indicator selecting two countries",
            archie: `{.peer-comparison}\n[.indicators]\nurl: ${LE_URL}?country=DEU\nurl: ${CM_URL}?country=~DEU~FRA\n[]\n{}`,
            error: "peer-comparison indicator 2 url must specify exactly one country",
        },
        {
            name: "unknown group",
            archie: `{.peer-comparison}\ngroups: Mars\n[.indicators]\nurl: ${LE_URL}?country=DEU\n[]\n{}`,
            error: 'peer-comparison has an unknown peer group "Mars"',
        },
    ])("peer-comparison: $name", ({ archie, error }) => {
        const block = parseBody(archie) as EnrichedBlockPeerComparison
        expect(block.indicators).toEqual([])
        expect(block.parseErrors).toHaveLength(1)
        expect(block.parseErrors[0].message).toContain(error)
    })

    // data-callout shares the single-country URL validation
    it.each([
        {
            archie: "{.data-callout}\n[.+content]\nText\n[]\n{}",
            error: "Missing url for data-callout block",
        },
        {
            archie: `{.data-callout}\nurl: ${LE_URL}?country=DEU~FRA\n[.+content]\nText\n[]\n{}`,
            error: "data-callout block url must specify exactly one country using the 'country' query parameter",
        },
    ])("data-callout: $error", ({ archie, error }) => {
        expect(parseBody(archie).parseErrors).toEqual([{ message: error }])
    })
})

describe("ranking block serialisation", () => {
    // The examples in exampleEnrichedBlocks.ts are round-tripped in
    // gdocTests.test.ts; these cover template URLs and non-default options.
    it.each<OwidEnrichedGdocBlock>([
        {
            type: "ranking-cards",
            title: "$EntityName at a glance",
            sparklines: false,
            changeSinceYears: 5,
            cards: [
                {
                    url: `${LE_URL}?country=$entityCode`,
                    sort: "highest",
                },
                {
                    url: `${CM_URL}?country=$entityCode&time=2020`,
                    title: "Child mortality",
                    topic: "Health",
                    sort: "lowest",
                    column: "under_five_mortality",
                },
            ],
            parseErrors: [],
        },
        {
            type: "peer-ranking",
            url: `${CM_URL}?country=$entityCode`,
            groups: ["Northern, Southern and Western Europe (ILO)", "World"],
            sort: "lowest",
            tolerance: 0,
            parseErrors: [],
        },
        {
            type: "peer-comparison",
            groups: [],
            indicators: [{ url: `${LE_URL}?country=$entityCode` }],
            parseErrors: [],
        },
    ])("round-trips $type", (block) => {
        const archie = OwidRawGdocBlockToArchieMLString(
            enrichedBlockToRawBlock(block)
        )
        expect(JSON.parse(JSON.stringify(parseBody(archie)))).toEqual(block)
    })
})

describe("ranking block text exports", () => {
    const ranking: LinkedRanking = {
        chartKey: "life-expectancy",
        columnSlug: "life_expectancy_0",
        title: "Life expectancy",
        unit: "years",
        source: "UN WPP (2024)",
        time: 2023,
        formattedTime: "2023",
        rows: [
            { code: "JPN", value: 84, time: 2023, formattedValue: "84 years" },
            { code: "FRA", value: 82, time: 2023, formattedValue: "82 years" },
            { code: "DEU", value: 81, time: 2023, formattedValue: "81 years" },
            { code: "USA", value: 78, time: 2023, formattedValue: "78 years" },
            { code: "POL", value: 77, time: 2023, formattedValue: "77 years" },
        ],
    }

    const linkedRankingsFor = (
        block: EnrichedBlockPeerRanking | EnrichedBlockRankingCards
    ): LinkedRankings =>
        // only the first spec has data, the others stay missing
        ({ [getRankingSpecsForBlock(block)[0].key]: ranking })

    const peerRanking: EnrichedBlockPeerRanking = {
        type: "peer-ranking",
        url: `${LE_URL}?country=DEU`,
        groups: ["Neighbours", "Europe", "World"],
        sort: "highest",
        parseErrors: [],
    }

    const rankingCards: EnrichedBlockRankingCards = {
        type: "ranking-cards",
        title: "Germany at a glance",
        sparklines: false,
        changeSinceYears: 10,
        cards: [
            { url: `${LE_URL}?country=DEU`, sort: "lowest" },
            { url: `${CM_URL}?country=DEU`, sort: "lowest" },
        ],
        parseErrors: [],
    }

    it("writes the entity's rank in each peer group as markdown", () => {
        expect(
            enrichedBlockToMarkdown(peerRanking, false, {
                linkedRankings: linkedRankingsFor(peerRanking),
            })
        ).toBe(
            [
                "### Life expectancy, 2023",
                "",
                "* Value: 81 years",
                // Neighbours of DEU in the rows: FRA, POL
                "* Among Neighbours: 2nd highest of 3",
                "* Among Europe: 2nd highest of 3",
                "* Among all countries: 3rd highest of 5",
            ].join("\n")
        )
    })

    it("lists only cards with data, ranked by the card's sort order", () => {
        expect(
            enrichedBlockToMarkdown(rankingCards, false, {
                linkedRankings: linkedRankingsFor(rankingCards),
            })
        ).toBe(
            [
                "### Germany at a glance",
                "",
                "* Life expectancy: 81 years (3rd lowest of 5 countries, 2023)",
            ].join("\n")
        )
    })

    it("writes the same facts as indexable sentences", () => {
        expect(
            enrichedBlockToIndexableText(rankingCards, {
                linkedRankings: linkedRankingsFor(rankingCards),
            })
        ).toBe(
            "Germany at a glance. Life expectancy: 81 years (3rd lowest of 5 countries, 2023)"
        )
    })

    it("drops blocks without linked rankings or without the entity's data", () => {
        expect(enrichedBlockToMarkdown(rankingCards, false, {})).toBeUndefined()
        expect(enrichedBlockToIndexableText(rankingCards, {})).toBeUndefined()

        const forUnrankedEntity: EnrichedBlockPeerRanking = {
            ...peerRanking,
            url: `${LE_URL}?country=BRA`,
        }
        expect(
            enrichedBlockToMarkdown(forUnrankedEntity, false, {
                linkedRankings: linkedRankingsFor(forUnrankedEntity),
            })
        ).toBeUndefined()
    })
})
