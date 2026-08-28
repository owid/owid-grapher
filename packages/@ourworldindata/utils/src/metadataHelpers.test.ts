import { afterEach, describe, expect, it, vi } from "vitest"

import {
    formatSourceDate,
    getAttributionFragmentsFromVariable,
    getIndicatorCitations,
    getDateRange,
    getETLPathComponents,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getOriginAttributions,
    getProcessingPhraseForAttribution,
    getYearSuffixFromOrigin,
    prepareSourcesForDisplay,
} from "./metadataHelpers.js"
import dayjs from "./dayjs.js"

describe(getOriginAttributions, () => {
    it("returns an empty array for undefined origins", () => {
        expect(getOriginAttributions(undefined)).toEqual([])
    })

    it("returns an empty array for no origins", () => {
        expect(getOriginAttributions([])).toEqual([])
    })

    it("prefers an explicit attribution over producer and year", () => {
        expect(
            getOriginAttributions([
                {
                    attribution: "Custom attribution",
                    producer: "Producer",
                    datePublished: "2019-01-01",
                },
            ])
        ).toEqual([{ label: "Custom attribution", url: undefined }])
    })

    it("appends the publication year to the producer", () => {
        expect(
            getOriginAttributions([
                { producer: "Producer", datePublished: "2019-01-01" },
            ])
        ).toEqual([{ label: "Producer (2019)", url: undefined }])
    })

    it("accepts a year-only publication date", () => {
        expect(
            getOriginAttributions([
                { producer: "Producer", datePublished: "2019" },
            ])
        ).toEqual([{ label: "Producer (2019)", url: undefined }])
    })

    it("omits the year if there is no publication date", () => {
        expect(getOriginAttributions([{ producer: "Producer" }])).toEqual([
            { label: "Producer", url: undefined },
        ])
    })

    it("omits the year if the publication date is unparseable", () => {
        expect(
            getOriginAttributions([
                { producer: "Producer", datePublished: "not a date" },
            ])
        ).toEqual([{ label: "Producer", url: undefined }])
    })

    it("carries the origin's url", () => {
        expect(
            getOriginAttributions([
                { producer: "Producer", urlMain: "https://example.org" },
            ])
        ).toEqual([{ label: "Producer", url: "https://example.org" }])
    })

    it("falls back to the title if there is no producer", () => {
        expect(
            getOriginAttributions([{ title: "Title", datePublished: "2019" }])
        ).toEqual([{ label: "Title (2019)", url: undefined }])
    })

    it("falls back to the url if there is no producer or title", () => {
        expect(
            getOriginAttributions([
                { urlMain: "https://example.org", datePublished: "2019" },
            ])
        ).toEqual([
            {
                label: "https://example.org (2019)",
                url: "https://example.org",
            },
        ])
    })

    it("drops an origin with nothing to name it", () => {
        expect(
            getOriginAttributions([
                { datePublished: "2019" },
                { producer: "Producer" },
            ])
        ).toEqual([{ label: "Producer", url: undefined }])
    })

    it("ignores an empty attribution and uses the producer", () => {
        expect(
            getOriginAttributions([{ attribution: "", producer: "Producer" }])
        ).toEqual([{ label: "Producer", url: undefined }])
    })

    it("keeps duplicates and preserves the order of origins", () => {
        expect(
            getOriginAttributions([
                { producer: "B" },
                { producer: "A" },
                { producer: "B" },
            ])
        ).toEqual([
            { label: "B", url: undefined },
            { label: "A", url: undefined },
            { label: "B", url: undefined },
        ])
    })
})

describe(getAttributionFragmentsFromVariable, () => {
    it("uses the presentation attribution if there is one", () => {
        expect(
            getAttributionFragmentsFromVariable({
                presentation: { attribution: "Custom attribution" },
                origins: [{ producer: "Producer" }],
                source: { name: "Source" },
            })
        ).toEqual(["Custom attribution"])
    })

    it("ignores an empty presentation attribution", () => {
        expect(
            getAttributionFragmentsFromVariable({
                presentation: { attribution: "" },
                source: { name: "Source" },
            })
        ).toEqual(["Source"])
    })

    it("lists the source name before the origin attributions", () => {
        expect(
            getAttributionFragmentsFromVariable({
                origins: [
                    { producer: "Producer", datePublished: "2019" },
                    { attribution: "Other" },
                ],
                source: { name: "Source" },
            })
        ).toEqual(["Source", "Producer (2019)", "Other"])
    })

    it("deduplicates fragments", () => {
        expect(
            getAttributionFragmentsFromVariable({
                origins: [{ producer: "Source" }, { producer: "Source" }],
                source: { name: "Source" },
            })
        ).toEqual(["Source"])
    })

    it("returns an empty array if there is nothing to attribute", () => {
        expect(getAttributionFragmentsFromVariable({})).toEqual([])
    })
})

describe(getETLPathComponents, () => {
    it("splits a full catalog path into its components", () => {
        expect(
            getETLPathComponents(
                "grapher/un/2024-07-12/world_population_prospects/population#population"
            )
        ).toEqual({
            channel: "grapher",
            producer: "un",
            version: "2024-07-12",
            dataset: "world_population_prospects",
            table: "population",
            indicator: "population",
        })
    })

    it("leaves trailing components undefined for a short path", () => {
        expect(getETLPathComponents("grapher/un")).toEqual({
            channel: "grapher",
            producer: "un",
            version: undefined,
            dataset: undefined,
            table: undefined,
            indicator: undefined,
        })
    })

    it("handles an empty path", () => {
        expect(getETLPathComponents("")).toEqual({
            channel: "",
            producer: undefined,
            version: undefined,
            dataset: undefined,
            table: undefined,
            indicator: undefined,
        })
    })

    it("ignores components beyond the indicator", () => {
        expect(getETLPathComponents("a/b/c/d/e/f/g")).toEqual({
            channel: "a",
            producer: "b",
            version: "c",
            dataset: "d",
            table: "e",
            indicator: "f",
        })
    })
})

describe(getLastUpdatedFromVariable, () => {
    it("extracts the date from the catalog path version", () => {
        expect(
            getLastUpdatedFromVariable({
                catalogPath: "grapher/un/2024-07-12/dataset/table",
                origins: [{ dateAccessed: "2020-01-01" }],
            })
        ).toEqual("2024-07-12")
    })

    it("falls back to the origins if the version is not a full date", () => {
        expect(
            getLastUpdatedFromVariable({
                catalogPath: "grapher/un/2024/dataset/table",
                origins: [{ dateAccessed: "2020-01-01" }],
            })
        ).toEqual("2020-01-01")
    })

    it("falls back to the origins if the version is not zero-padded", () => {
        expect(
            getLastUpdatedFromVariable({
                catalogPath: "grapher/un/2024-7-1/dataset/table",
                origins: [{ dateAccessed: "2020-01-01" }],
            })
        ).toEqual("2020-01-01")
    })

    it("picks the latest date accessed across origins", () => {
        expect(
            getLastUpdatedFromVariable({
                origins: [
                    { dateAccessed: "2020-01-01" },
                    { dateAccessed: "2022-05-05" },
                    { dateAccessed: "2021-12-31" },
                ],
            })
        ).toEqual("2022-05-05")
    })

    it("ignores origins without a date accessed", () => {
        expect(
            getLastUpdatedFromVariable({
                origins: [
                    { producer: "Producer" },
                    { dateAccessed: "2020-01-01" },
                ],
            })
        ).toEqual("2020-01-01")
    })

    it("returns undefined if no origin has a date accessed", () => {
        expect(
            getLastUpdatedFromVariable({ origins: [{ producer: "Producer" }] })
        ).toBeUndefined()
    })

    it("returns undefined if there is nothing to go on", () => {
        expect(getLastUpdatedFromVariable({})).toBeUndefined()
    })

    it("returns undefined if no origin has a date accessed", () => {
        expect(
            getLastUpdatedFromVariable({ origins: [{ producer: "Producer" }] })
        ).toBeUndefined()
    })
})

describe(getNextUpdateFromVariable, () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it("returns undefined if there is no update period", () => {
        expect(
            getNextUpdateFromVariable({
                catalogPath: "grapher/un/2024-07-12/dataset/table",
            })
        ).toBeUndefined()
    })

    it("adds the update period to the last update", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2024-08-01T12:00:00Z"))
        expect(
            getNextUpdateFromVariable({
                catalogPath: "grapher/un/2024-07-12/dataset/table",
                updatePeriodDays: 365,
            })
        ).toEqual("2025-07-12")
    })

    it("falls back to a month from now if the next update is overdue", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2024-08-01T12:00:00Z"))
        expect(
            getNextUpdateFromVariable({
                catalogPath: "grapher/un/2024-07-12/dataset/table",
                updatePeriodDays: 7,
            })
        ).toEqual(dayjs().add(1, "month").format("YYYY-MM-DD"))
    })

    it("counts from today if the last update is unknown", () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2024-08-01T12:00:00Z"))
        expect(getNextUpdateFromVariable({ updatePeriodDays: 30 })).toEqual(
            dayjs().add(30, "day").format("YYYY-MM-DD")
        )
    })
})

describe(getProcessingPhraseForAttribution, () => {
    const attribution = "Producer"

    it("describes major processing", () => {
        expect(getProcessingPhraseForAttribution(attribution, "major")).toEqual(
            "with major processing"
        )
    })

    it("describes minor processing", () => {
        expect(getProcessingPhraseForAttribution(attribution, "minor")).toEqual(
            "with minor processing"
        )
    })

    it("falls back to a generic phrase", () => {
        expect(
            getProcessingPhraseForAttribution(attribution, undefined)
        ).toEqual("processed")
    })

    it("says nothing when we are the only attribution", () => {
        expect(
            getProcessingPhraseForAttribution("Our World in Data", "major")
        ).toBeUndefined()
    })

    it("ignores the case of our own name", () => {
        expect(
            getProcessingPhraseForAttribution("our world in data", "major")
        ).toBeUndefined()
    })

    it("accepts the fragments as a list", () => {
        expect(
            getProcessingPhraseForAttribution(["Our World in Data"], "major")
        ).toBeUndefined()
    })

    it("still describes processing when we are one of several attributions", () => {
        expect(
            getProcessingPhraseForAttribution(
                ["Our World in Data", "Producer"],
                "major"
            )
        ).toEqual("with major processing")
    })

    it("still describes processing when the joined attribution names others", () => {
        expect(
            getProcessingPhraseForAttribution(
                "Our World in Data; Producer",
                "major"
            )
        ).toEqual("with major processing")
    })

    it("describes processing when there is no attribution at all", () => {
        expect(getProcessingPhraseForAttribution([], "major")).toEqual(
            "with major processing"
        )
    })
})

describe(prepareSourcesForDisplay, () => {
    it("returns an empty array if there is nothing to display", () => {
        expect(prepareSourcesForDisplay({})).toEqual([])
    })

    it("includes the source if it has a name and any provenance field", () => {
        expect(
            prepareSourcesForDisplay({
                source: {
                    name: "Source",
                    dataPublishedBy: "Publisher",
                    retrievedDate: "2024-01-01",
                    link: "https://example.com",
                },
            })
        ).toEqual([
            {
                label: "Source",
                dataPublishedBy: "Publisher",
                retrievedOn: "2024-01-01",
                retrievedFrom: "https://example.com",
            },
        ])
    })

    it("omits a source that only has a name", () => {
        expect(
            prepareSourcesForDisplay({ source: { name: "Source" } })
        ).toEqual([])
    })

    it("omits a source without a name", () => {
        expect(
            prepareSourcesForDisplay({
                source: { link: "https://example.com" },
            })
        ).toEqual([])
    })

    it("maps origins to display sources after the source", () => {
        expect(
            prepareSourcesForDisplay({
                source: { name: "Source", link: "https://example.com" },
                origins: [
                    {
                        producer: "Producer",
                        title: "Title",
                        description: "Description",
                        dateAccessed: "2024-02-02",
                        urlMain: "https://origin.example.com",
                        citationFull: "Citation",
                    },
                ],
            })
        ).toEqual([
            {
                label: "Source",
                retrievedFrom: "https://example.com",
            },
            {
                label: "Producer – Title",
                description: "Description",
                retrievedOn: "2024-02-02",
                retrievedFrom: "https://origin.example.com",
                citation: "Citation",
            },
        ])
    })

    it("labels an origin with its producer only", () => {
        expect(
            prepareSourcesForDisplay({ origins: [{ producer: "Producer" }] })
        ).toEqual([{ label: "Producer" }])
    })

    it("does not repeat the producer if the title matches it", () => {
        expect(
            prepareSourcesForDisplay({
                origins: [{ producer: "Producer", title: "Producer" }],
            })
        ).toEqual([{ label: "Producer" }])
    })

    it("omits the separator when an origin has no producer", () => {
        expect(
            prepareSourcesForDisplay({ origins: [{ title: "Title" }] })
        ).toEqual([{ label: "Title" }])
    })

    it("keeps the order of the origins", () => {
        expect(
            prepareSourcesForDisplay({
                origins: [{ producer: "B" }, { producer: "A" }],
            })
        ).toEqual([{ label: "B" }, { label: "A" }])
    })
})

describe(getYearSuffixFromOrigin, () => {
    it("prefers the date accessed", () => {
        expect(
            getYearSuffixFromOrigin({
                dateAccessed: "2024-03-07",
                datePublished: "2019-01-01",
            })
        ).toEqual(" (2024)")
    })

    it("falls back to the date published", () => {
        expect(
            getYearSuffixFromOrigin({ datePublished: "2019-01-01" })
        ).toEqual(" (2019)")
    })

    it("accepts year-only dates", () => {
        expect(getYearSuffixFromOrigin({ datePublished: "2019" })).toEqual(
            " (2019)"
        )
    })

    it("returns an empty string if there is no date", () => {
        expect(getYearSuffixFromOrigin({})).toEqual("")
    })

    it("returns an empty string if the date is unparseable", () => {
        expect(getYearSuffixFromOrigin({ dateAccessed: "not a date" })).toEqual(
            ""
        )
    })
})

describe(getIndicatorCitations, () => {
    const citations = (
        overrides: Partial<Parameters<typeof getIndicatorCitations>[0]> = {}
    ): ReturnType<typeof getIndicatorCitations> =>
        getIndicatorCitations({
            indicatorTitle: { title: "Indicator" },
            origins: [],
            attributions: ["Attribution"],
            ...overrides,
        })

    const citationUrl = "https://ourworldindata.org/grapher/indicator"

    it("omits the datapage citation without a citation url", () => {
        expect(citations().datapage).toBeUndefined()
    })

    it("still cites the page when the citation url is empty", () => {
        // mdim pages baked without a slug have one (MultiDimBaker.tsx)
        expect(citations({ citationUrl: "" }).datapage).toEqual(
            "“Data Page: Indicator”. " +
                `Our World in Data (${dayjs().year()}). ` +
                "Retrieved from  [online resource]"
        )
    })

    describe("short", () => {
        it("joins the attributions with the processing phrase", () => {
            expect(
                citations({
                    attributions: ["Producer A (2024)", "Producer B"],
                    owidProcessingLevel: "major",
                }).short
            ).toEqual(
                "Producer A (2024); Producer B – with major processing by Our World in Data"
            )
        })

        it("uses the generic processing phrase if the level is unknown", () => {
            expect(citations({ attributions: ["Producer A"] }).short).toEqual(
                "Producer A – processed by Our World in Data"
            )
        })

        it("keeps three attributions", () => {
            expect(
                citations({
                    attributions: ["A", "B", "C"],
                    owidProcessingLevel: "minor",
                }).short
            ).toEqual("A; B; C – with minor processing by Our World in Data")
        })

        it("shortens more than three attributions", () => {
            expect(
                citations({
                    attributions: ["A", "B", "C", "D"],
                    owidProcessingLevel: "minor",
                }).short
            ).toEqual(
                "A and other sources – with minor processing by Our World in Data"
            )
        })

        // TODO: fire the intended fallback on an empty attributions array.
        // `attributions ?? producersWithYear` only catches null and undefined,
        // and every caller passes a non-optional string[], so
        // `producersWithYear` is unreachable and the citation opens with a bare
        // separator.
        it("does not fall back to the origins if there are no attributions", () => {
            expect(
                citations({
                    origins: [
                        { producer: "Producer", dateAccessed: "2024-07-11" },
                    ],
                    attributions: [],
                }).short
            ).toEqual(" – processed by Our World in Data")
        })

        // TODO: return "Our World in Data" when there is no attribution at all,
        // rather than a separator with nothing before it. Mirrors the rule that
        // hides the processing phrase when the attribution is already us.
        it("has nothing to attribute without attributions or origins", () => {
            expect(citations({ attributions: [] }).short).toEqual(
                " – processed by Our World in Data"
            )
        })
    })

    describe("long", () => {
        it("assembles a full citation", () => {
            expect(
                citations({
                    origins: [
                        {
                            producer: "Producer",
                            title: "Title",
                            versionProducer: "v2",
                            dateAccessed: "2024-03-07",
                        },
                    ],
                    attributions: ["Producer (2024)"],
                    attributionShort: "Short",
                    titleVariant: "Variant",
                    owidProcessingLevel: "minor",
                    citationUrl,
                }).long
            ).toEqual(
                "Producer (2024) – with minor processing by Our World in Data. " +
                    "“Indicator – Short – Variant” [dataset]. " +
                    "Producer, “Title v2” [original data]. " +
                    `Retrieved ${dayjs().format("MMMM D, YYYY")} from ${citationUrl}`
            )
        })

        // TODO: fire the intended fallback on an empty attributions array, as
        // in short above. The citation currently opens with a bare separator
        // even though the origins name a producer.
        it("does not fall back to the origins if there are no attributions", () => {
            expect(
                citations({
                    origins: [
                        {
                            producer: "Producer",
                            title: "Title",
                            dateAccessed: "2024-07-11",
                        },
                    ],
                    attributions: [],
                }).long
            ).toEqual(
                " – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "Producer, “Title” [original data]."
            )
        })

        it("uses only the attribution short if there is no title variant", () => {
            expect(citations({ attributionShort: "Short" }).long).toEqual(
                "Attribution – processed by Our World in Data. “Indicator – Short” [dataset]."
            )
        })

        it("uses only the title variant if there is no attribution short", () => {
            expect(citations({ titleVariant: "Variant" }).long).toEqual(
                "Attribution – processed by Our World in Data. “Indicator – Variant” [dataset]."
            )
        })

        it("uses the bare title if there is neither", () => {
            expect(citations().long).toEqual(
                "Attribution – processed by Our World in Data. “Indicator” [dataset]."
            )
        })

        it("joins multiple attributions", () => {
            expect(
                citations({ attributions: ["A", "B", "C", "D"] }).long
            ).toEqual(
                "A; B; C; D – processed by Our World in Data. “Indicator” [dataset]."
            )
        })

        it("deduplicates identical origins and joins the rest", () => {
            expect(
                citations({
                    origins: [
                        { producer: "A", title: "One" },
                        { producer: "B", title: "Two" },
                        { producer: "A", title: "One" },
                    ],
                }).long
            ).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "A, “One”; B, “Two” [original data]."
            )
        })

        it("omits the quoted title when an origin has none", () => {
            expect(
                citations({ origins: [{ producer: "Producer" }] }).long
            ).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "Producer [original data]."
            )
        })

        it("omits the producer when an origin has none", () => {
            expect(citations({ origins: [{ title: "Title" }] }).long).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "“Title” [original data]."
            )
        })

        it("falls back to the title snapshot of an origin", () => {
            expect(
                citations({
                    origins: [
                        { producer: "Producer", titleSnapshot: "Snapshot" },
                    ],
                }).long
            ).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "Producer, “Snapshot” [original data]."
            )
        })

        it("falls back to the source name if there are no origins", () => {
            expect(citations({ source: { name: "Source" } }).long).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    "Source [original data]."
            )
        })

        it("omits the original data sentence if there is neither", () => {
            expect(citations({ source: {} }).long).toEqual(
                "Attribution – processed by Our World in Data. “Indicator” [dataset]."
            )
        })

        it("appends the archival date to the retrieval sentence", () => {
            expect(
                citations({ citationUrl, archivalDate: "20250414-074331" }).long
            ).toEqual(
                "Attribution – processed by Our World in Data. " +
                    "“Indicator” [dataset]. " +
                    `Retrieved ${dayjs().format("MMMM D, YYYY")} from ${citationUrl} (archived on April 14, 2025).`
            )
        })

        it("ignores the archival date if there is no citation url", () => {
            expect(citations({ archivalDate: "20250414-074331" }).long).toEqual(
                "Attribution – processed by Our World in Data. “Indicator” [dataset]."
            )
        })
    })

    describe("datapage", () => {
        it("cites the primary topic publication", () => {
            expect(
                citations({
                    origins: [{ producer: "Producer" }],
                    primaryTopic: {
                        topicTag: "Topic",
                        citation: "Author (2023) – “Topic”",
                    },
                    citationUrl,
                }).datapage
            ).toEqual(
                "“Data Page: Indicator”, part of the following publication: " +
                    "Author (2023) – “Topic”. " +
                    "Data adapted from Producer. " +
                    `Retrieved from ${citationUrl} [online resource]`
            )
        })

        it("does not add a period after a question mark", () => {
            expect(
                citations({
                    primaryTopic: {
                        topicTag: "Topic",
                        citation: "Author (2023) – Why?",
                    },
                    citationUrl,
                }).datapage
            ).toEqual(
                "“Data Page: Indicator”, part of the following publication: " +
                    "Author (2023) – Why? " +
                    `Retrieved from ${citationUrl} [online resource]`
            )
        })

        it("adds a period after a closing quotation mark", () => {
            expect(
                citations({
                    primaryTopic: {
                        topicTag: "Topic",
                        citation: "Author (2023) – “Topic”",
                    },
                    citationUrl,
                }).datapage
            ).toContain("publication: Author (2023) – “Topic”. Retrieved")
        })

        it("does not add a second period", () => {
            expect(
                citations({
                    primaryTopic: {
                        topicTag: "Topic",
                        citation: "Author (2023).",
                    },
                    citationUrl,
                }).datapage
            ).toEqual(
                "“Data Page: Indicator”, part of the following publication: " +
                    "Author (2023). " +
                    `Retrieved from ${citationUrl} [online resource]`
            )
        })

        it("credits Our World in Data if there is no primary topic", () => {
            expect(citations({ citationUrl }).datapage).toEqual(
                `“Data Page: Indicator”. Our World in Data (${dayjs().year()}). ` +
                    `Retrieved from ${citationUrl} [online resource]`
            )
        })

        it("lists the deduplicated producers", () => {
            expect(
                citations({
                    origins: [
                        { producer: "A" },
                        { producer: "B" },
                        { producer: "A" },
                    ],
                    source: { name: "Source" },
                    citationUrl,
                }).datapage
            ).toContain("Data adapted from A, B.")
        })

        it("falls back to the source name if there are no origins", () => {
            expect(
                citations({ source: { name: "Source" }, citationUrl }).datapage
            ).toContain("Data adapted from Source.")
        })

        it("omits the adapted-from sentence if there is neither", () => {
            expect(
                citations({ source: {}, citationUrl }).datapage
            ).not.toContain("Data adapted from")
        })

        it("appends the archival date", () => {
            expect(
                citations({ citationUrl, archivalDate: "20250414-074331" })
                    .datapage
            ).toEqual(
                `“Data Page: Indicator”. Our World in Data (${dayjs().year()}). ` +
                    `Retrieved from ${citationUrl} [online resource] (archived on April 14, 2025).`
            )
        })
    })
})

describe(formatSourceDate, () => {
    it("returns null for an undefined date", () => {
        expect(formatSourceDate(undefined, "MMMM D, YYYY")).toBeNull()
    })

    it("returns null for an empty date", () => {
        expect(formatSourceDate("", "MMMM D, YYYY")).toBeNull()
    })

    it("formats an ISO date", () => {
        expect(formatSourceDate("2024-03-07", "MMMM D, YYYY")).toEqual(
            "March 7, 2024"
        )
    })

    it("formats a day-first date", () => {
        expect(formatSourceDate("07/03/2024", "MMMM D, YYYY")).toEqual(
            "March 7, 2024"
        )
    })

    it("honours the requested format", () => {
        expect(formatSourceDate("2024-03-07", "MMMM YYYY")).toEqual(
            "March 2024"
        )
    })

    it("returns the input unchanged if it cannot be parsed", () => {
        expect(formatSourceDate("not a date", "MMMM D, YYYY")).toEqual(
            "not a date"
        )
    })

    it("returns a year-only date unchanged", () => {
        expect(formatSourceDate("2024", "MMMM D, YYYY")).toEqual("2024")
    })
})

describe(getDateRange, () => {
    it("joins two CE years with an en dash", () => {
        expect(getDateRange("1990-2020")).toEqual("1990–2020")
    })

    it("accepts an en dash separator and surrounding whitespace", () => {
        expect(getDateRange("  1990 – 2020  ")).toEqual("1990–2020")
    })

    it("marks both years as BCE", () => {
        expect(getDateRange("-5000--200")).toEqual("5000 BCE – 200 BCE")
    })

    it("marks a BCE start and a CE end", () => {
        expect(getDateRange("-5000-2020")).toEqual("5000 BCE – 2020 CE")
    })

    it("returns null for a single year", () => {
        expect(getDateRange("1990")).toBeNull()
    })

    it("returns null for an unrecognised separator", () => {
        expect(getDateRange("1990 to 2020")).toBeNull()
    })

    it("returns null for non-numeric years", () => {
        expect(getDateRange("nineteen-ninety")).toBeNull()
    })

    it("returns null for trailing junk", () => {
        expect(getDateRange("1990-2020 (approx)")).toBeNull()
    })

    it("returns null for an empty string", () => {
        expect(getDateRange("")).toBeNull()
    })
})
