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
import { getRowChartTypeTabs, getRowThumbnailTab } from "./AllChartsBlock.js"

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

describe(getRowThumbnailTab, () => {
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("shows the map when the chart has one", () => {
        expect(
            getRowThumbnailTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual(GRAPHER_TAB_NAMES.WorldMap)
    })

    it("shows the first chart type when the chart has no map", () => {
        // "Share in poverty relative to different poverty lines" in Marwa's
        // mockup: a line chart with a bar view and no map, whose thumbnail is
        // the line chart.
        expect(
            getRowThumbnailTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual(GRAPHER_TAB_NAMES.LineChart)
    })

    it("never shows the table", () => {
        expect(
            getRowThumbnailTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.StackedArea,
                ])
            )
        ).toEqual(GRAPHER_TAB_NAMES.StackedArea)
        expect(
            getRowThumbnailTab(hitWithTabs([GRAPHER_TAB_NAMES.Table]))
        ).toBeUndefined()
    })

    it("has no view for a record with no tabs at all", () => {
        expect(getRowThumbnailTab({} as SearchChartHit)).toBeUndefined()
    })

    // A map shows every country whatever the search says, so a row sitting
    // next to a world map while reading "Italy" ignored the filter as far as
    // the reader can tell (Marwa, 2026-10-01). Such a row drops to its first
    // chart type, which the thumbnail then renders for that country.
    describe("while a country filter reaches the row", () => {
        const italy = ["Italy"]

        it("drops off the map onto the first chart type", () => {
            expect(
                getRowThumbnailTab(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                        GRAPHER_TAB_NAMES.LineChart,
                        GRAPHER_TAB_NAMES.DiscreteBar,
                    ]),
                    italy
                )
            ).toEqual(GRAPHER_TAB_NAMES.LineChart)
        })

        it("keeps the map for a chart that has no other view", () => {
            expect(
                getRowThumbnailTab(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                    ]),
                    italy
                )
            ).toEqual(GRAPHER_TAB_NAMES.WorldMap)
        })

        it("keeps the map where the only other view says nothing about one country", () => {
            // "Multidimensional Poverty Index (MPI)", whose only chart type is
            // a Marimekko: for one country that comes back as a single
            // hairline bar among a hundred pale ones at 170px, and as no mark
            // at all for a country the chart has no data for. The map is the
            // better thumbnail even filtered. See
            // TABS_UNREADABLE_FOR_ONE_COUNTRY.
            expect(
                getRowThumbnailTab(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                        GRAPHER_TAB_NAMES.Marimekko,
                    ]),
                    italy
                )
            ).toEqual(GRAPHER_TAB_NAMES.WorldMap)
        })

        it("passes over such a view to reach one that does", () => {
            expect(
                getRowThumbnailTab(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                        GRAPHER_TAB_NAMES.Marimekko,
                        GRAPHER_TAB_NAMES.LineChart,
                    ]),
                    italy
                )
            ).toEqual(GRAPHER_TAB_NAMES.LineChart)
        })

        it("changes nothing for a chart with no map", () => {
            expect(
                getRowThumbnailTab(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.StackedArea,
                    ]),
                    italy
                )
            ).toEqual(GRAPHER_TAB_NAMES.StackedArea)
        })
    })

    it("keeps the map where the search names a country the chart lacks", () => {
        // The filter is read per row, as the entities the search turned up on
        // *this* chart (see pickEntitiesForChartHit). None, and nothing is
        // passed to the thumbnail either — so flipping would swap a legible
        // world map for an unfiltered line chart.
        expect(
            getRowThumbnailTab(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.WorldMap,
                    GRAPHER_TAB_NAMES.LineChart,
                ]),
                []
            )
        ).toEqual(GRAPHER_TAB_NAMES.WorldMap)
    })
})

describe(getRowChartTypeTabs, () => {
    const hitWithTabs = (availableTabs: GrapherTabName[]) =>
        ({ availableTabs }) as SearchChartHit

    it("lists the chart types in the order Grapher's own tab bar does", () => {
        // "Share of population living in extreme poverty" in Marwa's mockup:
        // a tab bar reading Table | Map | Line | Bar | Marimekko, a map
        // thumbnail, and a row reading "Line Bar Marimekko". `availableTabs`
        // is already in tab-bar order, so this is that list with the table and
        // the thumbnail's own view dropped and nothing re-sorted (Marwa,
        // 2026-09-29).
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

    it("never repeats the view the thumbnail is already showing", () => {
        // The duplication Marwa reported on 2026-10-01: a line-chart thumbnail
        // beside a row that also offered a "Line" link. The thumbnail is the
        // line chart, so only the bar view is left to offer.
        expect(
            getRowChartTypeTabs(
                hitWithTabs([
                    GRAPHER_TAB_NAMES.Table,
                    GRAPHER_TAB_NAMES.LineChart,
                    GRAPHER_TAB_NAMES.DiscreteBar,
                ])
            )
        ).toEqual([GRAPHER_TAB_NAMES.DiscreteBar])
    })

    it("lists a single chart type when the thumbnail is the map", () => {
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
        // all. Its thumbnail *is* that view, so nothing is left.
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

    it("never lists the map, which the thumbnail shows whenever there is one", () => {
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
                    GRAPHER_TAB_NAMES.WorldMap,
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

    describe("while a country filter reaches the row", () => {
        const italy = ["Italy"]

        it("drops the view the thumbnail flipped to, and still omits the map", () => {
            // "Share of population living in extreme poverty" with "italy"
            // searched: the thumbnail is now the line chart, so the row offers
            // Bar and Marimekko. The map stays unlisted either way.
            expect(
                getRowChartTypeTabs(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                        GRAPHER_TAB_NAMES.LineChart,
                        GRAPHER_TAB_NAMES.DiscreteBar,
                        GRAPHER_TAB_NAMES.Marimekko,
                    ]),
                    italy
                )
            ).toEqual([
                GRAPHER_TAB_NAMES.DiscreteBar,
                GRAPHER_TAB_NAMES.Marimekko,
            ])
        })

        it("still lists the view a row kept its map for", () => {
            // The MPI row: the thumbnail stayed on the map, so the Marimekko
            // is still the one alternative worth naming.
            expect(
                getRowChartTypeTabs(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                        GRAPHER_TAB_NAMES.Marimekko,
                    ]),
                    italy
                )
            ).toEqual([GRAPHER_TAB_NAMES.Marimekko])
        })

        it("lists nothing for a map-only chart", () => {
            expect(
                getRowChartTypeTabs(
                    hitWithTabs([
                        GRAPHER_TAB_NAMES.Table,
                        GRAPHER_TAB_NAMES.WorldMap,
                    ]),
                    italy
                )
            ).toEqual([])
        })
    })
})
