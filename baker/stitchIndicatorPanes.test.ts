import { expect, it, describe } from "vitest"
import {
    AdditionalIndicator,
    DataPageDataV2,
    OwidOrigin,
} from "@ourworldindata/types"
import { computeIndicatorPaneStitch } from "./stitchIndicatorPanes.js"

const origin = (over: Partial<OwidOrigin> = {}): OwidOrigin => ({
    producer: "UN",
    title: "World Population Prospects",
    citationFull: "UN (2024).",
    dateAccessed: "2024-07-15",
    urlMain: "https://population.un.org",
    ...over,
})

const pane = (over: Partial<DataPageDataV2> = {}): AdditionalIndicator => ({
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
        ...over,
    } as DataPageDataV2,
})

describe(computeIndicatorPaneStitch, () => {
    it("stitches identical panes, keeping shared short/unit on the pane", () => {
        const r = computeIndicatorPaneStitch([
            pane(),
            pane({ title: { title: "Deaths" } }),
        ])
        expect(r).toBeDefined()
        expect(r!.list.map((e) => e.title)).toEqual(["Births", "Deaths"])
        expect(r!.list[0].short).toBeUndefined()
        expect(r!.list[0].unit).toBeUndefined()
        expect(r!.suppressDescriptionShort).toBe(false)
    })

    it("appends titleVariant to list entry titles", () => {
        const r = computeIndicatorPaneStitch([
            pane(),
            pane({
                title: { title: "Births" },
                titleVariant: "with medium scenario projections",
            }),
        ])
        expect(r!.list[1].title).toBe(
            "Births – with medium scenario projections"
        )
        expect(r!.suppressTitleVariant).toBe(true)
    })

    it("states a variant shared by all indicators once, not per entry", () => {
        const r = computeIndicatorPaneStitch([
            pane({ titleVariant: "period tables" }),
            pane({ title: { title: "Deaths" }, titleVariant: "period tables" }),
        ])
        expect(r!.list.map((e) => e.title)).toEqual(["Births", "Deaths"])
        expect(r!.suppressTitleVariant).toBe(false)
    })

    it("does not stitch when a substantive field differs", () => {
        expect(
            computeIndicatorPaneStitch([
                pane(),
                pane({ descriptionProcessing: "Different processing." }),
            ])
        ).toBeUndefined()
        expect(
            computeIndicatorPaneStitch([
                pane(),
                pane({ origins: [origin({ producer: "WHO" })] }),
            ])
        ).toBeUndefined()
    })

    it("ignores origin order and internal origin fields", () => {
        const a = origin()
        const b = origin({ producer: "Energy Institute", title: "Review" })
        const r = computeIndicatorPaneStitch([
            pane({ origins: [a, b] }),
            pane({
                title: { title: "Deaths" },
                origins: [
                    { ...b, id: 999 },
                    { ...a, titleSnapshot: "Old snapshot", urlDownload: "x" },
                ],
            }),
        ])
        expect(r).toBeDefined()
    })

    it("unions differing date ranges, refusing unparseable ones", () => {
        const r = computeIndicatorPaneStitch([
            pane(),
            pane({ title: { title: "Deaths" }, dateRange: "2024-2100" }),
        ])
        expect(r!.dateRange).toBe("1950-2100")
        expect(
            computeIndicatorPaneStitch([
                pane(),
                pane({ title: { title: "Deaths" }, dateRange: "since 1950" }),
            ])
        ).toBeUndefined()
    })

    it("moves differing shorts/units into the list and suppresses them on the pane", () => {
        const r = computeIndicatorPaneStitch([
            pane({ descriptionShort: "Births short.", unit: "births" }),
            pane({
                title: { title: "Deaths" },
                descriptionShort: "Deaths short.",
                unit: "deaths",
            }),
        ])
        expect(r!.list.map((e) => e.short)).toEqual([
            "Births short.",
            "Deaths short.",
        ])
        expect(r!.list.map((e) => e.unit)).toEqual(["births", "deaths"])
        expect(r!.suppressDescriptionShort).toBe(true)
        expect(r!.suppressUnit).toBe(true)
    })

    it("allows short differing WYSKs as per-entry notes, blocks long ones", () => {
        const r = computeIndicatorPaneStitch([
            pane({ descriptionKey: undefined }),
            pane({
                title: { title: "Conflict" },
                descriptionKey: "IHME splits impacts evenly across years.",
            }),
        ])
        expect(r).toBeDefined()
        expect(r!.list[0].note).toBeUndefined()
        expect(r!.list[1].note).toMatch(/IHME splits/)
        expect(r!.suppressDescriptionKey).toBe(true)

        expect(
            computeIndicatorPaneStitch([
                pane({ descriptionKey: undefined }),
                pane({
                    title: { title: "Conflict" },
                    descriptionKey: "x".repeat(300),
                }),
            ])
        ).toBeUndefined()
    })

    it("stitches differing producer docs as per-entry docs and suppresses the pane's", () => {
        const r = computeIndicatorPaneStitch([
            pane({ descriptionFromProducer: "Doc A" }),
            pane({
                title: { title: "Deaths" },
                descriptionFromProducer: "Doc B",
            }),
        ])
        expect(r).toBeDefined()
        expect(r!.suppressDescriptionFromProducer).toBe(true)
        expect(r!.list.map((e) => e.producerDescription)).toEqual([
            "Doc A",
            "Doc B",
        ])
        const same = computeIndicatorPaneStitch([
            pane({ descriptionFromProducer: "Doc" }),
            pane({
                title: { title: "Deaths" },
                descriptionFromProducer: "Doc",
            }),
        ])
        expect(same!.suppressDescriptionFromProducer).toBe(false)
        expect(same!.list[0].producerDescription).toBeUndefined()
    })

    it("stitches a shared source whose link/citation differ, surfacing them per entry", () => {
        const r = computeIndicatorPaneStitch([
            pane({
                origins: [origin({ urlMain: "https://a", citationFull: "A" })],
            }),
            pane({
                title: { title: "Deaths" },
                origins: [origin({ urlMain: "https://b", citationFull: "B" })],
            }),
        ])
        expect(r).toBeDefined()
        expect(r!.list.map((e) => e.sources?.[0]?.urlMain)).toEqual([
            "https://a",
            "https://b",
        ])
        // identical content → nothing to surface
        const same = computeIndicatorPaneStitch([
            pane(),
            pane({ title: { title: "Deaths" } }),
        ])
        expect(same!.list[0].sources).toBeUndefined()
        // a different source SET still blocks
        expect(
            computeIndicatorPaneStitch([
                pane(),
                pane({ origins: [origin(), origin({ producer: "WHO" })] }),
            ])
        ).toBeUndefined()
    })

    it("needs at least two panes", () => {
        expect(computeIndicatorPaneStitch([pane()])).toBeUndefined()
    })

    it("takes the soonest nextUpdate", () => {
        const r = computeIndicatorPaneStitch([
            pane({ nextUpdate: "2027-07-12" }),
            pane({ title: { title: "Deaths" }, nextUpdate: "2026-01-01" }),
            pane({ title: { title: "Births" } }),
        ])
        expect(r?.nextUpdate).toBe("2026-01-01")
    })

    it("does not repeat a differing title variant already in the title", () => {
        const r = computeIndicatorPaneStitch([
            pane({
                title: { title: "Population – historical" },
                titleVariant: "historical",
            }),
            pane({
                title: { title: "Population" },
                titleVariant: "projections",
            }),
        ])
        expect(r?.list.map((e) => e.title)).toEqual([
            "Population – historical",
            "Population – projections",
        ])
    })

    it("unions owners and takes the latest lastUpdated", () => {
        const r = computeIndicatorPaneStitch([
            pane({
                owners: [{ datasetId: 1, datasetName: "A", owners: ["Alice"] }],
                lastUpdated: "2024-07-12",
            }),
            pane({
                title: { title: "Deaths" },
                owners: [{ datasetId: 2, datasetName: "B", owners: ["Bob"] }],
                lastUpdated: "2025-01-01",
            }),
        ])
        expect(r!.owners![0].owners).toEqual(["Alice", "Bob"])
        expect(r!.lastUpdated).toBe("2025-01-01")
    })
})
