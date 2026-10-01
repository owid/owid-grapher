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
    // The only field the helper reads.
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("lists every view except the data table, map included", () => {
        // A chart whose tab bar reads Table | Map | Line | Bar | Marimekko
        // gives a row reading "Map Line Bar Marimekko", which is what the
        // design shows. `availableTabs` is already in tab-bar order, so this is
        // that list with the table dropped and nothing re-sorted.
        //
        // The map is listed like any other view: rows here picture nothing, so
        // there is no thumbnail already showing it.
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
            GRAPHER_TAB_NAMES.WorldMap,
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.DiscreteBar,
            GRAPHER_TAB_NAMES.Marimekko,
        ])
    })

    it("lists one link for a chart with one view besides the table", () => {
        // The design draws four links on every row, but that is a generic row
        // rather than per-chart data: a row offers exactly the views its own
        // chart has. A map and a table is one link, not none.
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.WorldMap])

        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.StackedArea,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.StackedArea])
    })

    it("lists nothing for a chart with no view but the table", () => {
        // Which renders no link row at all rather than an empty one — see
        // AllChartsRowChartTypes.
        expect(
            getRowChartTypeTabs(hitWithTabs([GRAPHER_TAB_NAMES.Table]))
        ).toEqual([])
        expect(getRowChartTypeTabs(hitWithTabs([]))).toEqual([])
    })

    it("lists nothing for a record that omits the field entirely", () => {
        expect(getRowChartTypeTabs({} as SearchChartHit)).toEqual([])
    })

    it("never offers the same view twice", () => {
        // Belt and braces against a record that lists a tab twice, which would
        // otherwise draw the same link in two places.
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.WorldMap,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.WorldMap, GRAPHER_TAB_NAMES.LineChart])
    })
})
