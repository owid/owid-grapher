import { expect, it, describe } from "vitest"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartHit,
} from "@ourworldindata/types"
import {
    indexTopicVocabularyByName,
    suggestedKeywords,
} from "./search/topicVocabulary.js"
import { getRowChartTypeTabs } from "./AllChartsBlock.js"

describe(suggestedKeywords, () => {
    it("suggests the vocabulary's terms in the vocabulary's own order", () => {
        // Deliberately not re-ordered here: the generator picked this order by
        // measuring what each term reveals of this very chart list, weighted by
        // how much each chart is viewed. See suggestedKeywords.
        const keywords = ["sex ratio", "female population", "missing women"]
        expect(suggestedKeywords(keywords)).toEqual(keywords)
    })

    it("never suggests a place, however the vocabulary names it", () => {
        expect(
            suggestedKeywords([
                "United States",
                "UK",
                "Africa",
                "World",
                "school attendance",
            ])
        ).toEqual(["school attendance"])
    })

    it("suggests nothing for a topic the vocabulary doesn't cover", () => {
        expect(suggestedKeywords(undefined)).toEqual([])
        expect(suggestedKeywords([])).toEqual([])
    })
})

describe(indexTopicVocabularyByName, () => {
    const published = {
        "gender-ratio": {
            topic_name: "Gender Ratio",
            keywords: ["Sex ratio", "Missing women"],
            stats: { num_keywords: 2 },
        },
    }

    it("re-keys the published vocabulary by topic name", () => {
        expect(indexTopicVocabularyByName(published)).toEqual({
            "Gender Ratio": ["Sex ratio", "Missing women"],
        })
    })

    it("skips entries a regeneration could have left malformed", () => {
        expect(
            indexTopicVocabularyByName({
                ...published,
                "no-name": { keywords: ["Orphaned"] },
                "no-keywords": { topic_name: "No Keywords" },
                "wrong-type": { topic_name: "Wrong Type", keywords: "nope" },
                "junk-keywords": {
                    topic_name: "Junk Keywords",
                    keywords: ["Kept", "", null, 7],
                },
                nothing: null,
            })
        ).toEqual({
            "Gender Ratio": ["Sex ratio", "Missing women"],
            "Junk Keywords": ["Kept"],
        })
    })

    it("tolerates a response that isn't an object at all", () => {
        expect(indexTopicVocabularyByName(null)).toEqual({})
        expect(indexTopicVocabularyByName("nope")).toEqual({})
    })
})

describe(getRowChartTypeTabs, () => {
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("lists the chart types in the order Grapher's own tab bar does", () => {
        // "Share of population living in extreme poverty" in Marwa's mockup:
        // a tab bar reading Table | Map | Line | Bar | Marimekko, and a row
        // reading "Line Bar Marimekko". `availableTabs` is already in tab-bar
        // order, so this is that list with the table and the map dropped and
        // nothing re-sorted (Marwa, 2026-09-29).
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                    GRAPHER_TAB_NAMES.Marimekko,
                ])
            )
        ).toEqual([
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.DiscreteBar,
            GRAPHER_TAB_NAMES.Marimekko,
        ])
    })

    it("lists a chart with several chart types and no map", () => {
        // "Share in poverty relative to different poverty lines": a line
        // chart with a bar view and no map, listing "Line Bar".
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.LineChart, GRAPHER_TAB_NAMES.DiscreteBar])
    })

    it("lists a single chart type when the chart also has a map", () => {
        // "Multidimensional Poverty Index (MPI)": the thumbnail is the map,
        // and the row lists just "Marimekko" — the other view it has.
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.Marimekko,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.Marimekko])
    })

    it("lists nothing for a chart whose only view is its chart type", () => {
        // "Total population living in extreme poverty by world region": a
        // stacked area chart with no map, which the mockup gives no list at
        // all. One link repeating what the thumbnail already shows is noise.
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.StackedArea,
                ])
            )
        ).toEqual([])
    })

    it("lists nothing for a map-only chart", () => {
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                ])
            )
        ).toEqual([])
    })

    it("never lists the map itself, which the thumbnail already shows", () => {
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                    GRAPHER_TAB_NAMES.SlopeChart,
                    GRAPHER_TAB_NAMES.Marimekko,
                ])
            )
        ).not.toContain(GRAPHER_TAB_NAMES.WorldMap)
    })

    it("lists a view a record happens to name twice only once", () => {
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.LineChart, GRAPHER_TAB_NAMES.DiscreteBar])
    })

    it("lists nothing for a record with no tabs at all", () => {
        expect(getRowChartTypeTabs({} as SearchChartHit)).toEqual([])
    })
})
