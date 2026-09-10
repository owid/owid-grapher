import { expect, it, describe } from "vitest"
import {
    AdditionalIndicator,
    DataPageDataV2,
    OwidOrigin,
} from "@ourworldindata/types"
import { computeIndicatorPaneCollapse } from "./collapseIndicatorPanes.js"

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

describe(computeIndicatorPaneCollapse, () => {
    it("collapses identical panes, keeping shared short/unit on the pane", () => {
        const r = computeIndicatorPaneCollapse([
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
        const r = computeIndicatorPaneCollapse([
            pane(),
            pane({
                title: { title: "Births" },
                titleVariant: "with medium scenario projections",
            }),
        ])
        expect(r!.list[1].title).toBe(
            "Births – with medium scenario projections"
        )
    })

    it("does not collapse when a substantive field differs", () => {
        expect(
            computeIndicatorPaneCollapse([
                pane(),
                pane({ descriptionProcessing: "Different processing." }),
            ])
        ).toBeUndefined()
        expect(
            computeIndicatorPaneCollapse([
                pane(),
                pane({ origins: [origin({ producer: "WHO" })] }),
            ])
        ).toBeUndefined()
    })

    it("ignores origin order and internal origin fields", () => {
        const a = origin()
        const b = origin({ producer: "Energy Institute", title: "Review" })
        const r = computeIndicatorPaneCollapse([
            pane({ origins: [a, b] }),
            pane({
                title: { title: "Deaths" },
                origins: [
                    { ...b, id: 999 } as OwidOrigin,
                    { ...a, titleSnapshot: "Old snapshot", urlDownload: "x" },
                ],
            }),
        ])
        expect(r).toBeDefined()
    })

    it("unions differing date ranges, refusing unparseable ones", () => {
        const r = computeIndicatorPaneCollapse([
            pane(),
            pane({ title: { title: "Deaths" }, dateRange: "2024-2100" }),
        ])
        expect(r!.dateRange).toBe("1950-2100")
        expect(
            computeIndicatorPaneCollapse([
                pane(),
                pane({ title: { title: "Deaths" }, dateRange: "since 1950" }),
            ])
        ).toBeUndefined()
    })

    it("moves differing shorts/units into the list and suppresses them on the pane", () => {
        const r = computeIndicatorPaneCollapse([
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
        const r = computeIndicatorPaneCollapse([
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
            computeIndicatorPaneCollapse([
                pane({ descriptionKey: undefined }),
                pane({
                    title: { title: "Conflict" },
                    descriptionKey: "x".repeat(300),
                }),
            ])
        ).toBeUndefined()
    })

    it("unions owners and takes the latest lastUpdated", () => {
        const r = computeIndicatorPaneCollapse([
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
