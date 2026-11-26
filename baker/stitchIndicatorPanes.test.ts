import { expect, it, describe } from "vitest"
import {
    DataPageDataV2,
    IndicatorPaneData,
    OwidOrigin,
} from "@ourworldindata/types"
import { stitchIndicatorPanes } from "./stitchIndicatorPanes.js"

const origin = (overrides: Partial<OwidOrigin> = {}): OwidOrigin => ({
    producer: "UN",
    title: "World Population Prospects",
    citationFull: "UN (2024).",
    dateAccessed: "2024-07-15",
    urlMain: "https://population.un.org",
    ...overrides,
})

const pane = (
    overrides: Partial<DataPageDataV2> = {},
    faqEntries?: IndicatorPaneData["faqEntries"]
): IndicatorPaneData => ({
    datapageData: {
        status: "draft",
        title: { title: "Births" },
        attributions: ["UN (2024)"],
        topicTagsLinks: [],
        descriptionKey: "Shared key info.",
        origins: [origin()],
        dateRange: "1950-2023",
        lastUpdated: "2024-07-12",
        allCharts: [],
        relatedChartsByCoview: [],
        relatedResearch: [],
        chartConfig: {},
        descriptionShort: "Shared short.",
        unit: "people",
        ...overrides,
    } as DataPageDataV2,
    faqEntries,
})

const deaths = (overrides: Partial<DataPageDataV2> = {}): IndicatorPaneData =>
    pane({ title: { title: "Deaths" }, ...overrides })

describe(stitchIndicatorPanes, () => {
    it("keeps what the indicators share on the pane, not on the indicators", () => {
        const stitched = stitchIndicatorPanes([pane(), deaths()])
        expect(stitched?.indicators).toEqual([
            { title: "Births" },
            { title: "Deaths" },
        ])
        expect(stitched?.datapageData).toMatchObject({
            descriptionShort: "Shared short.",
            unit: "people",
            descriptionKey: "Shared key info.",
        })
    })

    it("needs at least two panes", () => {
        expect(stitchIndicatorPanes([pane()])).toBeUndefined()
    })

    it.each<[string, IndicatorPaneData]>([
        [
            "processing description",
            deaths({ descriptionProcessing: "Different processing." }),
        ],
        ["short attribution", deaths({ attributionShort: "WHO" })],
        ["attributions", deaths({ attributions: ["WHO (2024)"] })],
        ["legacy source", deaths({ source: { id: 1, name: "WHO" } })],
        [
            "FAQs",
            pane(
                { title: { title: "Deaths" } },
                { faqs: [{ type: "text", value: [], parseErrors: [] }] }
            ),
        ],
        ["sources", deaths({ origins: [origin({ producer: "WHO" })] })],
        [
            "set of sources",
            deaths({ origins: [origin(), origin({ producer: "WHO" })] }),
        ],
    ])("does not stitch panes whose %s differ", (_field, other) => {
        expect(stitchIndicatorPanes([pane(), other])).toBeUndefined()
    })

    it("moves what differs between the indicators off the pane and onto them", () => {
        const stitched = stitchIndicatorPanes([
            pane({
                title: { title: "Births", titleVariant: "estimates" },
                titleVariant: "estimates",
                descriptionShort: "Births short.",
                unit: "births",
                descriptionKey: undefined,
                descriptionFromProducer: "Births docs.",
            }),
            deaths({
                title: { title: "Deaths", titleVariant: "projections" },
                titleVariant: "projections",
                descriptionShort: "Deaths short.",
                unit: "deaths",
                descriptionKey: "A short note on deaths.",
                descriptionFromProducer: "Deaths docs.",
            }),
        ])
        expect(stitched?.indicators).toEqual([
            {
                title: "Births",
                titleVariant: "estimates",
                descriptionShort: "Births short.",
                unit: "births",
                descriptionFromProducer: "Births docs.",
            },
            {
                title: "Deaths",
                titleVariant: "projections",
                descriptionShort: "Deaths short.",
                unit: "deaths",
                descriptionKey: "A short note on deaths.",
                descriptionFromProducer: "Deaths docs.",
            },
        ])
        const { datapageData } = stitched!
        expect(datapageData.titleVariant).toBeUndefined()
        expect(datapageData.title.titleVariant).toBeUndefined()
        expect(datapageData.descriptionShort).toBeUndefined()
        expect(datapageData.unit).toBeUndefined()
        expect(datapageData.descriptionKey).toBeUndefined()
        expect(datapageData.descriptionFromProducer).toBeUndefined()
    })

    it("keeps a title variant every indicator shares on the pane", () => {
        const stitched = stitchIndicatorPanes([
            pane({ titleVariant: "period tables" }),
            deaths({ titleVariant: "period tables" }),
        ])
        expect(stitched?.indicators).toEqual([
            { title: "Births" },
            { title: "Deaths" },
        ])
        expect(stitched?.datapageData.titleVariant).toBe("period tables")
    })

    it("does not stitch when a differing 'What you should know' is long", () => {
        expect(
            stitchIndicatorPanes([
                pane({ descriptionKey: undefined }),
                deaths({ descriptionKey: "x".repeat(300) }),
            ])
        ).toBeUndefined()
    })

    it("ignores the order of the sources and the fields readers don't see", () => {
        const un = origin()
        const energyInstitute = origin({
            producer: "Energy Institute",
            title: "Review",
        })
        const withOtherLicense = {
            ...un,
            license: { name: "CC BY 4.0", url: "https://example.org/other" },
        }
        expect(
            stitchIndicatorPanes([
                pane({ origins: [un, energyInstitute] }),
                deaths({
                    origins: [
                        { ...energyInstitute, id: 999 },
                        { ...un, titleSnapshot: "Old", urlDownload: "x" },
                        // The same source again, from another ETL snapshot
                        withOtherLicense,
                    ],
                }),
            ])
        ).toBeDefined()
    })

    it("combines differing date ranges, and gives each indicator its own", () => {
        const stitched = stitchIndicatorPanes([
            pane(),
            deaths({ dateRange: "2024-2100" }),
        ])
        expect(stitched?.datapageData.dateRange).toBe("1950-2100")
        expect(
            stitched?.indicators.map((indicator) => indicator.dateRange)
        ).toEqual(["1950-2023", "2024-2100"])
    })

    it("reads a date range of a single year", () => {
        const stitched = stitchIndicatorPanes([
            pane(),
            deaths({ dateRange: "2030" }),
        ])
        expect(stitched?.datapageData.dateRange).toBe("1950-2030")
    })

    it("does not stitch when a differing date range can't be read", () => {
        expect(
            stitchIndicatorPanes([pane(), deaths({ dateRange: "since 1950" })])
        ).toBeUndefined()
    })

    it("lists each indicator's link and citation for a source they share", () => {
        const stitched = stitchIndicatorPanes([
            pane({
                origins: [origin({ urlMain: "https://a", citationFull: "A" })],
            }),
            deaths({
                origins: [origin({ urlMain: "https://b", citationFull: "B" })],
            }),
        ])
        expect(stitched?.sourceLinksByIndicator).toEqual([
            {
                originIndex: 0,
                links: [
                    {
                        label: "Births",
                        retrievedFrom: "https://a",
                        citation: "A",
                    },
                    {
                        label: "Deaths",
                        retrievedFrom: "https://b",
                        citation: "B",
                    },
                ],
            },
        ])
    })

    it("lists no links for a source every indicator links the same way", () => {
        const stitched = stitchIndicatorPanes([pane(), deaths()])
        expect(stitched?.sourceLinksByIndicator).toEqual([])
    })

    it("shows the highest processing level when the levels differ", () => {
        const stitched = stitchIndicatorPanes([
            pane({ owidProcessingLevel: "minor" }),
            deaths({ owidProcessingLevel: "major" }),
        ])
        expect(stitched?.datapageData.owidProcessingLevel).toBe("major")
    })

    it("shows every dataset's owners, the latest update and the soonest next one", () => {
        const stitched = stitchIndicatorPanes([
            pane({
                owners: [{ datasetId: 1, datasetName: "A", owners: ["Alice"] }],
                lastUpdated: "2024-07-12",
                nextUpdate: "2027-07-12",
            }),
            deaths({
                owners: [{ datasetId: 2, datasetName: "B", owners: ["Bob"] }],
                lastUpdated: "2025-01-01",
                nextUpdate: "2026-01-01",
            }),
            pane({ title: { title: "Migration" } }),
        ])
        expect(stitched?.datapageData).toMatchObject({
            owners: [{ owners: ["Alice", "Bob"] }],
            lastUpdated: "2025-01-01",
            nextUpdate: "2026-01-01",
        })
    })
})
