import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import {
    EnrichedBlockPeerRanking,
    EnrichedBlockRankingCards,
    LinkedRanking,
    LinkedRankings,
} from "@ourworldindata/types"
import { getRankingSpecsForBlock } from "@ourworldindata/utils"
import { Attachments, AttachmentsContext } from "../AttachmentsContext.js"
import { RankingCards } from "./RankingCards.js"
import { PeerRanking } from "./PeerRanking.js"
import {
    formatRankingValue,
    formatRankingValueParts,
    getGridColumns,
} from "./rankingUtils.js"

const URL = "https://ourworldindata.org/grapher/life-expectancy?country=~DEU"

const ranking: LinkedRanking = {
    chartKey: "life-expectancy",
    columnSlug: "le",
    title: "Life expectancy at birth",
    unit: "years",
    source: "UN WPP (2024)",
    time: 2023,
    formattedTime: "2023",
    prevTime: 2013,
    rows: [
        {
            code: "CHE",
            value: 84,
            time: 2023,
            formattedValue: "84 years",
            prevValue: 83,
        },
        {
            code: "FRA",
            value: 83.3,
            time: 2023,
            formattedValue: "83.3 years",
            prevValue: 82.5,
        },
        {
            code: "DEU",
            value: 81.4,
            time: 2023,
            formattedValue: "81.4 years",
            prevValue: 82.6,
        },
        {
            code: "POL",
            value: 78.6,
            time: 2023,
            formattedValue: "78.6 years",
            prevValue: 77,
        },
        {
            code: "NGA",
            value: 54,
            time: 2023,
            formattedValue: "54 years",
            prevValue: 51,
        },
    ],
}

const cardsBlock: EnrichedBlockRankingCards = {
    type: "ranking-cards",
    title: "Germany at a glance",
    sparklines: false,
    changeSinceYears: 10,
    cards: [{ url: URL, topic: "Health", sort: "highest" }],
    parseErrors: [],
}

const peerRankingBlock: EnrichedBlockPeerRanking = {
    type: "peer-ranking",
    url: URL,
    groups: ["Neighbours", "World"],
    sort: "highest",
    parseErrors: [],
}

const makeAttachments = (linkedRankings: LinkedRankings): Attachments => ({
    linkedCharts: {},
    linkedIndicators: {},
    linkedDocuments: {},
    imageMetadata: {},
    relatedCharts: [],
    tags: [],
    linkedRankings,
})

const rankingsFor = (
    block: EnrichedBlockRankingCards | EnrichedBlockPeerRanking
): LinkedRankings =>
    Object.fromEntries(
        getRankingSpecsForBlock(block).map((spec) => [spec.key, ranking])
    )

const render = (
    element: React.ReactElement,
    rankings: LinkedRankings
): string =>
    renderToStaticMarkup(
        <AttachmentsContext.Provider value={makeAttachments(rankings)}>
            {element}
        </AttachmentsContext.Provider>
    )

describe(RankingCards, () => {
    it("renders the entity's value, rank and rank change", () => {
        const html = render(
            <RankingCards block={cardsBlock} />,
            rankingsFor(cardsBlock)
        )
        expect(html).toContain("Germany at a glance")
        expect(html).toContain("81.4")
        expect(html).toContain("3rd highest of 5")
        // ranked 2nd in 2013 (among countries with data then), 3rd now
        expect(html).toContain("Down 1 place since 2013")
        expect(html).toContain("ranking-card--topic-health")
    })

    it("rounds the value and places the unit like grapher", () => {
        const withUnit = (
            units: Pick<LinkedRanking, "unit" | "shortUnit">,
            value: number
        ): LinkedRankings =>
            Object.fromEntries(
                getRankingSpecsForBlock(cardsBlock).map((spec) => [
                    spec.key,
                    {
                        ...ranking,
                        ...units,
                        rows: ranking.rows.map((row) => ({ ...row, value })),
                    },
                ])
            )
        const valueOf = (
            units: Pick<LinkedRanking, "unit" | "shortUnit">,
            value: number
        ): { number?: string; unit?: string } => {
            const html = render(
                <RankingCards block={cardsBlock} />,
                withUnit(units, value)
            )
            return {
                number: html.match(/ranking-card__number">([^<]*)</)?.[1],
                unit: html.match(/ranking-card__unit">([^<]*)</)?.[1],
            }
        }

        expect(valueOf({ unit: "%", shortUnit: "%" }, 84.8312)).toEqual({
            number: "84.8%",
        })
        expect(
            valueOf({ unit: "international-$", shortUnit: "$" }, 62824)
        ).toEqual({
            number: "$62,800",
        })
        expect(
            valueOf({ unit: "kilowatt-hours", shortUnit: "kWh" }, 33183.23)
        ).toEqual({
            number: "33,200",
            unit: "kWh",
        })
        // no short unit: the long unit is shown instead
        expect(
            valueOf(
                { unit: "deaths per 100,000 live births", shortUnit: "" },
                4.4321
            )
        ).toEqual({ number: "4.43", unit: "deaths per 100,000 live births" })
        // the abbreviation goes with the unit
        expect(valueOf({ unit: "people" }, 84_548_231)).toEqual({
            number: "84.5",
            unit: "million people",
        })
    })

    it("marks the sparkline's start and end and only overlays a comparable World line", () => {
        const sparklineBlock = { ...cardsBlock, sparklines: true }
        const withSparkline = (world: [number, number][]): LinkedRankings =>
            Object.fromEntries(
                getRankingSpecsForBlock(sparklineBlock).map((spec) => [
                    spec.key,
                    {
                        ...ranking,
                        sparkline: {
                            entity: [
                                [1950, 68],
                                [2023, 81.4],
                            ] as [number, number][],
                            world,
                        },
                    },
                ])
            )

        const comparable = render(
            <RankingCards block={sparklineBlock} />,
            withSparkline([
                [1950, 46],
                [2023, 73],
            ])
        )
        expect(comparable).toContain("<span>1950</span><span>2023</span>")
        expect(comparable.match(/ranking-sparkline__dot/g)).toHaveLength(2)
        expect(comparable).toContain("ranking-sparkline__world")
        expect(comparable).toContain("ranking-card__legend-world")

        // e.g. population: the World is on a different scale than a country
        const incomparable = render(
            <RankingCards block={sparklineBlock} />,
            withSparkline([
                [1950, 2_500],
                [2023, 8_000],
            ])
        )
        expect(incomparable).not.toContain("ranking-sparkline__world")
        expect(incomparable).not.toContain("ranking-card__legend-world")

        // the x-domain is the entity's time range: a World line that starts
        // earlier is clipped, so the year labels mark the entity line's ends
        const worldStartsEarlier = render(
            <RankingCards block={sparklineBlock} />,
            withSparkline([
                [1900, 30],
                [1950, 46],
                [2000, 60],
                [2023, 73],
                [2024, 74],
            ])
        )
        expect(worldStartsEarlier).toContain(
            "<span>1950</span><span>2023</span>"
        )
        const worldPoints = worldStartsEarlier
            .match(/ranking-sparkline__world" points="([^"]*)"/)?.[1]
            .split(" ")
        expect(worldPoints).toHaveLength(3)
        expect(worldPoints?.[0]).toMatch(/^0\.0,/)
        expect(worldPoints?.[2]).toMatch(/^220\.0,/)

        // no World points within the entity's time range: no World line
        const worldOutsideRange = render(
            <RankingCards block={sparklineBlock} />,
            withSparkline([
                [1900, 30],
                [1940, 40],
            ])
        )
        expect(worldOutsideRange).not.toContain("ranking-sparkline__world")
        expect(worldOutsideRange).not.toContain("ranking-card__legend-world")
    })

    it("renders nothing when the ranking wasn't computed", () => {
        expect(render(<RankingCards block={cardsBlock} />, {})).toBe("")
    })
})

describe(formatRankingValue, () => {
    it("rounds to 3 significant figures", () => {
        expect(formatRankingValue(206_917.22)).toBe("207,000")
        expect(formatRankingValue(81.43)).toBe("81.4")
        expect(formatRankingValue(0.4321)).toBe("0.432")
        expect(formatRankingValue(84_548_231)).toBe("84.5M")
    })

    it("places units like grapher", () => {
        expect(formatRankingValue(206_917.22, { unit: "kWh" })).toBe(
            "207,000 kWh"
        )
        expect(formatRankingValue(62_824, { unit: "$" })).toBe("$62,800")
        expect(formatRankingValue(59.091, { unit: "%" })).toBe("59.1%")
    })

    it("splits percent units into the number and the rest", () => {
        expect(formatRankingValueParts(22.04, "% of adults")).toEqual({
            number: "22.0%",
            unit: "of adults",
        })
    })
})

describe(getGridColumns, () => {
    it("avoids a mostly empty last row", () => {
        expect(getGridColumns(4, 4)).toBe(4)
        expect(getGridColumns(5, 4)).toBe(3)
        expect(getGridColumns(6, 4)).toBe(3)
        expect(getGridColumns(7, 4)).toBe(4)
        expect(getGridColumns(4, 3)).toBe(2)
        expect(getGridColumns(1, 3)).toBe(2)
    })
})

describe(PeerRanking, () => {
    it("offers the neighbours group for Germany and ranks within it", () => {
        const html = render(
            <PeerRanking block={peerRankingBlock} />,
            rankingsFor(peerRankingBlock)
        )
        expect(html).toContain("Neighbours")
        expect(html).toContain('aria-pressed="true"')
        expect(html).toContain("Among Germany and its neighbours")
        // CHE, FRA, DEU, POL are in the group; NGA is not
        expect(html).not.toContain("Nigeria")
        expect(html).toContain("3rd")
    })

    const withUnits = (
        units: Pick<LinkedRanking, "unit" | "shortUnit">
    ): LinkedRankings =>
        Object.fromEntries(
            getRankingSpecsForBlock(peerRankingBlock).map((spec) => [
                spec.key,
                {
                    ...ranking,
                    ...units,
                    rows: ranking.rows.map((row) => ({
                        ...row,
                        value: row.value * 2541.9,
                    })),
                },
            ])
        )
    const rowValues = (html: string): string[] =>
        [...html.matchAll(/peer-ranking__value"[^>]*>([^<]*)</g)].map(
            (match) => match[1]
        )
    const axisUnit = (html: string): string | undefined =>
        html.match(/peer-ranking__axis-unit">([^<]*)</)?.[1]

    it("shows rounded row values with a short unit, without repeating it on the axis", () => {
        const html = render(
            <PeerRanking block={peerRankingBlock} />,
            withUnits({ unit: "kilowatt-hours per person", shortUnit: "kWh" })
        )
        // DEU: 81.4 * 2541.9 = 206,910.66
        expect(rowValues(html)).toContain("207,000 kWh")
        expect(axisUnit(html)).toBeUndefined()
    })

    it("labels the axis with a unit that's too long for the rows", () => {
        const html = render(
            <PeerRanking block={peerRankingBlock} />,
            withUnits({ unit: "kilowatt-hours per person", shortUnit: "" })
        )
        expect(rowValues(html)).toContain("207,000")
        expect(axisUnit(html)).toBe("kilowatt-hours per person")
    })
})
