import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import { ColumnTypeNames, OwidColumnDef } from "@ourworldindata/types"
import { SourcesModal } from "./SourcesModal"

type IndicatorOverrides = Partial<OwidColumnDef>

const makeTabs = (
    indicators: IndicatorOverrides[]
): { title: string; attribution?: string; timespan?: string }[] => {
    const defs: OwidColumnDef[] = indicators.map((overrides, index) => ({
        slug: `indicator_${index}`,
        type: ColumnTypeNames.Numeric,
        ...overrides,
    }))
    const table = new OwidTable([], defs)
    const manager = {
        inputColumnsWithSources: defs.map((def) => table.get(def.slug)),
        base: { current: null },
    }
    return new SourcesModal({ manager }).tabs.map((tab) => ({
        title: tab.title,
        attribution: tab.attribution,
        timespan: tab.timespan,
    }))
}

describe("SourcesModal tab labels", () => {
    it("leaves labels that don't collide alone", () => {
        expect(
            makeTabs([
                { name: "gdp", presentation: { titlePublic: "GDP" } },
                {
                    name: "population",
                    presentation: { titlePublic: "Population" },
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: undefined, timespan: undefined },
            {
                title: "Population",
                attribution: undefined,
                timespan: undefined,
            },
        ])
    })

    it("puts the disambiguator in parentheses after an existing attribution", () => {
        expect(
            makeTabs([
                {
                    name: "Children that died before age five",
                    presentation: {
                        titlePublic: "Child mortality rate",
                        titleVariant: "Long-run data",
                        attributionShort: "Gapminder",
                    },
                    descriptionShort: "Deaths per woman",
                },
                {
                    name: "Children that survived past age five",
                    presentation: {
                        titlePublic: "Child mortality rate",
                        titleVariant: "Long-run data",
                        attributionShort: "Gapminder",
                    },
                    descriptionShort: "Survivors per woman",
                },
            ])
        ).toEqual([
            {
                title: "Child mortality rate",
                attribution:
                    "Long-run data – Gapminder (Children that died before age five)",
                timespan: undefined,
            },
            {
                title: "Child mortality rate",
                attribution:
                    "Long-run data – Gapminder (Children that survived past age five)",
                timespan: undefined,
            },
        ])
    })

    it("keeps same-titled indicators with different content apart, labelled by indicator name", () => {
        expect(
            makeTabs([
                {
                    name: "GDP (PPP)",
                    presentation: { titlePublic: "GDP" },
                    descriptionShort: "In PPP dollars",
                },
                {
                    name: "GDP (nominal)",
                    presentation: { titlePublic: "GDP" },
                    descriptionShort: "In US dollars",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (PPP)", timespan: undefined },
            { title: "GDP", attribution: "GDP (nominal)", timespan: undefined },
        ])
    })

    it("labels them by the chart's display name over the indicator name", () => {
        expect(
            makeTabs([
                {
                    name: "gdp_ppp",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP (PPP)" },
                    descriptionShort: "In PPP dollars",
                },
                {
                    name: "gdp_nominal",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP (nominal)" },
                    descriptionShort: "In US dollars",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (PPP)", timespan: undefined },
            { title: "GDP", attribution: "GDP (nominal)", timespan: undefined },
        ])
    })

    it("falls back to the indicator name when the display name is the title", () => {
        expect(
            makeTabs([
                {
                    name: "GDP (PPP)",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP" },
                    descriptionShort: "In PPP dollars",
                },
                {
                    name: "GDP (nominal)",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP" },
                    descriptionShort: "In US dollars",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (PPP)", timespan: undefined },
            { title: "GDP", attribution: "GDP (nominal)", timespan: undefined },
        ])
    })

    it("falls back to the indicator name when the display name is a projection's title", () => {
        expect(
            makeTabs([
                {
                    name: "GDP (PPP)",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP", isProjection: true },
                    descriptionShort: "In PPP dollars",
                },
                {
                    name: "GDP (nominal)",
                    presentation: { titlePublic: "GDP" },
                    display: { name: "GDP", isProjection: true },
                    descriptionShort: "In US dollars",
                },
            ])
        ).toEqual([
            {
                title: "GDP (projection)",
                attribution: "GDP (PPP)",
                timespan: undefined,
            },
            {
                title: "GDP (projection)",
                attribution: "GDP (nominal)",
                timespan: undefined,
            },
        ])
    })
})

describe("SourcesModal tabs for indicators that differ only in timespan", () => {
    it("merges date ranges into one tab spanning all of them", () => {
        expect(
            makeTabs([
                {
                    name: "GDP",
                    presentation: { titlePublic: "GDP" },
                    timespan: "1990-2000",
                },
                {
                    name: "GDP",
                    presentation: { titlePublic: "GDP" },
                    timespan: "2010-2020",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: undefined, timespan: "1990-2020" },
        ])
    })

    it("keeps an indicator without a date range apart from one with a date range", () => {
        expect(
            makeTabs([
                { name: "GDP (latest)", presentation: { titlePublic: "GDP" } },
                {
                    name: "GDP (series)",
                    presentation: { titlePublic: "GDP" },
                    timespan: "1990-2020",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (latest)", timespan: undefined },
            {
                title: "GDP",
                attribution: "GDP (series)",
                timespan: "1990-2020",
            },
        ])
    })

    it("keeps a timespan that doesn't render as a date range apart from a missing one", () => {
        expect(
            makeTabs([
                {
                    name: "GDP (1990)",
                    presentation: { titlePublic: "GDP" },
                    timespan: "1990",
                },
                {
                    name: "GDP (latest)",
                    presentation: { titlePublic: "GDP" },
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (1990)", timespan: "1990" },
            {
                title: "GDP",
                attribution: "GDP (latest)",
                timespan: undefined,
            },
        ])
    })

    it("keeps timespans that don't render as a date range apart from each other", () => {
        expect(
            makeTabs([
                {
                    name: "GDP (1990)",
                    presentation: { titlePublic: "GDP" },
                    timespan: "1990",
                },
                {
                    name: "GDP (2000)",
                    presentation: { titlePublic: "GDP" },
                    timespan: "2000",
                },
            ])
        ).toEqual([
            { title: "GDP", attribution: "GDP (1990)", timespan: "1990" },
            { title: "GDP", attribution: "GDP (2000)", timespan: "2000" },
        ])
    })
})
