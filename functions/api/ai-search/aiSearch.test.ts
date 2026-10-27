import { describe, expect, it } from "vitest"
import { ChartRecordType, OwidGdocType } from "@ourworldindata/types"
import {
    buildCandidatePool,
    CandidatePool,
    ChartCandidate,
    createBlockParser,
    PageCandidate,
    parsePlannerAnswer,
} from "./aiSearch.js"

const chart = (slug: string, entities: string[] = []): ChartCandidate =>
    ({
        type: ChartRecordType.Chart,
        objectID: slug,
        slug,
        title: slug,
        availableEntities: entities,
        availableTabs: [],
    }) as unknown as ChartCandidate

const topicPage = (slug: string): PageCandidate =>
    ({
        type: OwidGdocType.TopicPage,
        objectID: slug,
        slug,
        title: slug,
    }) as PageCandidate

const article = (slug: string): PageCandidate =>
    ({
        type: OwidGdocType.Article,
        objectID: slug,
        slug,
        title: slug,
    }) as PageCandidate

function pool(
    charts: [number, ChartCandidate][],
    pages: [number, PageCandidate][] = []
): CandidatePool {
    return { charts: new Map(charts), pages: new Map(pages) }
}

describe(buildCandidatePool, () => {
    it("takes three hits per rank from the original search and one from each expansion", () => {
        const original = {
            charts: ["a1", "a2", "a3", "a4"].map((s) => chart(s)),
            pages: [],
        }
        const expansion = {
            charts: ["b1", "b2"].map((s) => chart(s)),
            pages: [],
        }
        const { charts } = buildCandidatePool([original, expansion])
        expect([...charts.values()].map((c) => c.slug)).toEqual([
            "a1",
            "a2",
            "a3",
            "b1",
            "a4",
            "b2",
        ])
    })

    it("keeps a chart found by several searches once, at its first position", () => {
        const { charts } = buildCandidatePool([
            { charts: [chart("a"), chart("b")], pages: [] },
            { charts: [chart("b"), chart("c")], pages: [] },
        ])
        expect([...charts.values()].map((c) => c.slug)).toEqual(["a", "b", "c"])
    })

    it("gives every candidate a distinct id", () => {
        const { charts, pages } = buildCandidatePool([
            { charts: [chart("a")], pages: [topicPage("t")] },
        ])
        expect([...charts.keys(), ...pages.keys()]).toEqual([1, 2])
    })
})

describe(createBlockParser, () => {
    const candidates = pool(
        [
            [1, chart("life-expectancy", ["Nigeria", "World"])],
            [2, chart("child-mortality")],
            [3, chart("gdp")],
        ],
        [
            [10, topicPage("life-expectancy")],
            [11, article("why-life-expectancy")],
        ]
    )

    it("replaces ids with hits and tells pages apart by their type", () => {
        const parse = createBlockParser(candidates)
        expect(parse('{"type":"chart","id":1,"size":"large"}')).toMatchObject({
            type: "chart",
            size: "large",
            hit: { slug: "life-expectancy" },
        })
        expect(parse('{"type":"page","id":10}')).toMatchObject({
            type: "topicPage",
            hit: { slug: "life-expectancy" },
        })
        expect(parse('{"type":"page","id":11}')).toMatchObject({
            type: "article",
        })
    })

    it("drops unknown and repeated ids, and blocks left empty by that", () => {
        const parse = createBlockParser(candidates)
        expect(parse('{"type":"chart","id":99}')).toBeNull()
        expect(parse('{"type":"chart","id":2}')).not.toBeNull()
        expect(parse('{"type":"chart","id":2}')).toBeNull()
        expect(
            parse(
                '{"type":"group","title":"Gone","blocks":[{"type":"chart","id":2}]}'
            )
        ).toBeNull()
    })

    it("allows a single large chart", () => {
        const parse = createBlockParser(candidates)
        parse('{"type":"chart","id":1,"size":"large"}')
        expect(parse('{"type":"chart","id":2,"size":"large"}')).toMatchObject({
            size: "medium",
        })
    })

    it("shows charts in groups as thumbnails", () => {
        const parse = createBlockParser(candidates)
        expect(
            parse(
                '{"type":"group","title":"More","blocks":[{"type":"chart","id":2,"size":"large"}]}'
            )
        ).toMatchObject({ blocks: [{ size: "small" }] })
        expect(parse('{"type":"chart","id":1,"size":"large"}')).toMatchObject({
            size: "large",
        })
    })

    it("allows two wide cards on the page", () => {
        const parse = createBlockParser(candidates)
        const sizeOf = (id: number): unknown =>
            (
                parse(`{"type":"chart","id":${id},"size":"medium"}`) as {
                    size?: string
                } | null
            )?.size
        expect([1, 2, 3].map(sizeOf)).toEqual(["medium", "medium", "small"])
    })

    it("leaves the charts of a rejected group free for later blocks", () => {
        const parse = createBlockParser(candidates)
        expect(
            parse('{"type":"group","blocks":[{"type":"chart","id":2}]}')
        ).toBeNull()
        expect(parse('{"type":"chart","id":2}')).not.toBeNull()
    })

    it("defaults to medium cards on the page and small ones in groups", () => {
        const parse = createBlockParser(candidates)
        expect(parse('{"type":"chart","id":1}')).toMatchObject({
            size: "medium",
        })
        expect(
            parse(
                '{"type":"group","title":"More","blurb":"","blocks":[{"type":"chart","id":2},{"type":"forks"}]}'
            )
        ).toMatchObject({ blocks: [{ type: "chart", size: "small" }] })
    })

    it("keeps a country only if the chart has data for it, in the chart's spelling", () => {
        const parse = createBlockParser(candidates)
        expect(
            parse('{"type":"chart","id":1,"country":"nigeria"}')
        ).toMatchObject({ country: "Nigeria" })
        expect(
            parse('{"type":"chart","id":2,"country":"Nigeria"}')
        ).not.toHaveProperty("country")
    })

    it("needs at least two complete fork options", () => {
        const parse = createBlockParser(candidates)
        expect(
            parse(
                '{"type":"forks","question":"Which?","options":[{"label":"A","query":"a"},{"label":"B"}]}'
            )
        ).toBeNull()
        expect(
            parse(
                '{"type":"forks","question":"Which?","options":[{"label":"A","query":"a"},{"label":"B","query":"b"}]}'
            )
        ).toEqual({
            type: "forks",
            question: "Which?",
            options: [
                { label: "A", query: "a" },
                { label: "B", query: "b" },
            ],
        })
    })

    it("skips code fences, prose and broken JSON", () => {
        const parse = createBlockParser(candidates)
        expect(parse("```json")).toBeNull()
        expect(parse("Here is the layout:")).toBeNull()
        expect(parse('{"type":"chart","id":')).toBeNull()
        expect(parse('{"type":"related","queries":["a", 3, "b"]}')).toEqual({
            type: "related",
            queries: ["a", "b"],
        })
    })
})

describe(parsePlannerAnswer, () => {
    it("drops the original search, duplicates and non-strings", () => {
        expect(
            parsePlannerAnswer(
                '{"queries":["Obesity","obesity by age","obesity by age",4]}',
                "obesity"
            )
        ).toEqual(["obesity by age"])
    })

    it("returns nothing for an answer that isn't the expected JSON", () => {
        expect(parsePlannerAnswer("not json", "x")).toEqual([])
    })
})
