import { describe, expect, it } from "vitest"
import {
    GRAPHER_TAB_NAMES,
    type GrapherQueryParams,
    type GrapherTabName,
} from "@ourworldindata/types"
import { toAllChartsGrapherParams } from "./allChartsEntitySelection.js"

describe(toAllChartsGrapherParams, () => {
    it.each<{
        name: string
        tab: GrapherTabName
        countries: string[]
        target?: "thumbnail" | "preview"
        expected: GrapherQueryParams
    }>([
        {
            name: "spreads four countries over a line chart",
            tab: GRAPHER_TAB_NAMES.LineChart,
            countries: [],
            expected: {
                tab: "line",
                country: "",
                peerCountries: "dataRange",
                peerCount: "4",
            },
        },
        {
            name: "spreads six countries over a discrete bar chart",
            tab: GRAPHER_TAB_NAMES.DiscreteBar,
            countries: [],
            expected: {
                tab: "discrete-bar",
                country: "",
                peerCountries: "dataRange",
                peerCount: "6",
            },
        },
        {
            name: "spreads three countries over a marimekko",
            tab: GRAPHER_TAB_NAMES.Marimekko,
            countries: [],
            expected: {
                tab: "marimekko",
                country: "",
                peerCountries: "dataRange",
                peerCount: "3",
            },
        },
        {
            name: "caps the author's selection on a swimlane",
            tab: GRAPHER_TAB_NAMES.Swimlane,
            countries: [],
            expected: {
                tab: "swimlane",
                country: "",
                peerCountries: "defaultSelection",
                peerCount: "6",
            },
        },
        {
            name: "adds the author's selection next to a picked country on a swimlane",
            tab: GRAPHER_TAB_NAMES.Swimlane,
            countries: ["Germany"],
            expected: {
                tab: "swimlane",
                country: "~DEU",
                peerCountries: "defaultSelection",
                peerCount: "5",
                focus: "~DEU",
            },
        },
        {
            name: "keeps the author's selection on the map",
            tab: GRAPHER_TAB_NAMES.WorldMap,
            countries: [],
            expected: { tab: "map" },
        },
        {
            name: "adds peers up to the cap next to a picked country",
            tab: GRAPHER_TAB_NAMES.LineChart,
            countries: ["Kenya"],
            expected: {
                tab: "line",
                country: "~KEN",
                peerCountries: "auto",
                peerCount: "3",
                focus: "~KEN",
            },
        },
        {
            name: "counts every picked country against the cap",
            tab: GRAPHER_TAB_NAMES.DiscreteBar,
            countries: ["Kenya", "Spain"],
            expected: {
                tab: "discrete-bar",
                country: "KEN~ESP",
                peerCountries: "auto",
                peerCount: "4",
                focus: "KEN~ESP",
            },
        },
        {
            name: "adds no peers once the picks reach the cap",
            tab: GRAPHER_TAB_NAMES.LineChart,
            countries: ["Kenya", "Spain", "Italy", "France"],
            expected: { tab: "line", country: "KEN~ESP~ITA~FRA" },
        },
        {
            name: "focuses the picked country on a marimekko",
            tab: GRAPHER_TAB_NAMES.Marimekko,
            countries: ["Kenya"],
            expected: { tab: "marimekko", country: "~KEN", focus: "~KEN" },
        },
        {
            name: "shows only the picked country on the map",
            tab: GRAPHER_TAB_NAMES.WorldMap,
            countries: ["Kenya"],
            expected: { tab: "map", country: "~KEN" },
        },
        {
            name: "selects nothing in a marimekko preview",
            tab: GRAPHER_TAB_NAMES.Marimekko,
            countries: [],
            target: "preview",
            expected: { tab: "marimekko", country: "" },
        },
        {
            name: "focuses the picked country in a marimekko preview",
            tab: GRAPHER_TAB_NAMES.Marimekko,
            countries: ["Kenya"],
            target: "preview",
            expected: { tab: "marimekko", country: "~KEN", focus: "~KEN" },
        },
        {
            name: "spreads four countries over a line chart preview",
            tab: GRAPHER_TAB_NAMES.LineChart,
            countries: [],
            target: "preview",
            expected: {
                tab: "line",
                country: "",
                peerCountries: "dataRange",
                peerCount: "4",
            },
        },
    ])("$name", ({ tab, countries, target = "thumbnail", expected }) => {
        expect(toAllChartsGrapherParams({ tab, countries, target })).toEqual(
            expected
        )
    })
})
