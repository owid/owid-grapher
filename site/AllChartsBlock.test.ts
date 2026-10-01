import { expect, it, describe } from "vitest"
import {
    ChartRecordType,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartHit,
} from "@ourworldindata/types"
import {
    indexTopicVocabularyByName,
    suggestedKeywords,
} from "./search/topicVocabulary.js"
import {
    getPrimaryNonMapTab,
    getRowThumbnailPreviewUrl,
    getRowThumbnailTabs,
} from "./AllChartsBlock.js"

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

describe(getRowThumbnailTabs, () => {
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("offers the views in the order Grapher's own tab bar lists them", () => {
        // A chart whose tab bar reads Table | Map | Line | Bar gets a strip
        // reading map, line, bar — so the row and the chart beside it can be
        // read against each other. `availableTabs` is already in tab-bar
        // order, so this is that list with the table dropped and nothing
        // re-sorted (Marwa, 2026-09-29).
        expect(
            getRowThumbnailTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([
            GRAPHER_TAB_NAMES.WorldMap,
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.DiscreteBar,
        ])
    })

    it("leaves a chart without a map in its own order", () => {
        expect(
            getRowThumbnailTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.LineChart, GRAPHER_TAB_NAMES.DiscreteBar])
    })

    it("offers a map-only chart exactly one thumbnail", () => {
        expect(
            getRowThumbnailTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.WorldMap])
    })

    it("never offers the table, and caps a row at three views", () => {
        expect(
            getRowThumbnailTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.SlopeChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([
            GRAPHER_TAB_NAMES.WorldMap,
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.SlopeChart,
        ])
    })

    it("spends no slot on a view a record happens to list twice", () => {
        expect(
            getRowThumbnailTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([
            GRAPHER_TAB_NAMES.WorldMap,
            GRAPHER_TAB_NAMES.LineChart,
            GRAPHER_TAB_NAMES.DiscreteBar,
        ])
    })

    it("offers nothing for a chart with no view but the table", () => {
        // Which renders no thumbnail strip at all rather than an empty one —
        // see AllChartsRowThumbnails.
        expect(
            getRowThumbnailTabs(hitWithTabs([GRAPHER_TAB_NAMES.Table]))
        ).toEqual([])
        expect(getRowThumbnailTabs(hitWithTabs([]))).toEqual([])
    })

    it("offers nothing for a record that omits the field entirely", () => {
        expect(getRowThumbnailTabs({} as SearchChartHit)).toEqual([])
    })
})

describe(getPrimaryNonMapTab, () => {
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("picks the first chart type after the table and the map", () => {
        // What the sidecar opens on when a search names a country: the map is
        // the one view that draws the same picture whatever is selected, so
        // showing it would leave nothing on screen saying the search had done
        // anything (Marwa, 2026-10-01).
        expect(
            getPrimaryNonMapTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual(GRAPHER_TAB_NAMES.LineChart)
    })

    it("picks the leading chart type when there is no map to skip", () => {
        expect(
            getPrimaryNonMapTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                    GRAPHER_TAB_NAMES.LineChart,
                ])
            )
        ).toEqual(GRAPHER_TAB_NAMES.DiscreteBar)
    })

    it("has nothing to offer a map-only chart, which stays on its map", () => {
        // Rather than naming a tab the chart hasn't got.
        expect(
            getPrimaryNonMapTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                ])
            )
        ).toBeUndefined()
    })
})

describe(getRowThumbnailPreviewUrl, () => {
    const hit = {
        type: ChartRecordType.Chart,
        slug: "life-expectancy",
        availableTabs: [
            GRAPHER_TAB_NAMES.Table,
            GRAPHER_TAB_NAMES.WorldMap,
            GRAPHER_TAB_NAMES.LineChart,
        ],
    } as SearchChartHit

    it("puts the selected countries in the URL, not just on the chart", () => {
        // These are static images cached by URL, so a selection that isn't in
        // the URL is a selection the visitor never sees.
        const url = getRowThumbnailPreviewUrl(
            hit,
            GRAPHER_TAB_NAMES.LineChart,
            ["Spain", "France"]
        )
        // Serialised as the entity codes Grapher reads, not the typed names.
        expect(url).toContain("country=ESP~FRA")
        // And the view the thumbnail is for survives alongside them.
        expect(url).toContain("tab=line")
    })

    it("gives two country selections two different URLs", () => {
        // The point of the above: same chart, same view, different picture.
        expect(
            getRowThumbnailPreviewUrl(hit, GRAPHER_TAB_NAMES.LineChart, [
                "Spain",
            ])
        ).not.toEqual(
            getRowThumbnailPreviewUrl(hit, GRAPHER_TAB_NAMES.LineChart, [
                "France",
            ])
        )
    })

    it("leaves the map's URL alone whatever is selected", () => {
        // A map draws every country whatever is selected, so a country in its
        // URL would only split one cached image into one per combination and
        // render the same picture. Verified against the deployed thumbnail
        // function, which returns a byte-identical PNG either way.
        expect(
            getRowThumbnailPreviewUrl(hit, GRAPHER_TAB_NAMES.WorldMap, [
                "Spain",
            ])
        ).toEqual(
            getRowThumbnailPreviewUrl(hit, GRAPHER_TAB_NAMES.WorldMap, [])
        )
    })

    it("keeps asking for the text-free thumbnail", () => {
        const url = getRowThumbnailPreviewUrl(
            hit,
            GRAPHER_TAB_NAMES.LineChart,
            []
        )
        expect(url).toContain("imMinimal=1")
        expect(url).toContain("imBare=1")
    })
})
