import { describe, expect, it } from "vitest"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherChartType,
    GrapherTabConfigOption,
} from "@ourworldindata/types"
import { LifeExpectancyGrapher } from "../testData/OwidTestData.sample"
import { ContentSwitchers } from "./ContentSwitchers"

const { LineChart, DiscreteBar, Marimekko } = GRAPHER_CHART_TYPES

const measureTabs = (
    chartTypes: GrapherChartType[],
    tab: GrapherTabConfigOption
): number =>
    ContentSwitchers.measureWidth(
        LifeExpectancyGrapher({ chartTypes, hasMapTab: true, tab }),
        { labelMode: "label", paddingPx: 16, visibleTabCount: 3 }
    )

describe(ContentSwitchers.measureWidth, () => {
    it("measures the tabs it shows, including an active tab swapped in from the overflow", () => {
        // Table, Map and the active chart type are visible in both pairs
        const swappedWithOverflow =
            measureTabs(
                [LineChart, DiscreteBar, Marimekko],
                GRAPHER_TAB_CONFIG_OPTIONS.marimekko
            ) -
            measureTabs(
                [LineChart, DiscreteBar, Marimekko],
                GRAPHER_TAB_CONFIG_OPTIONS.line
            )
        const swappedWithoutOverflow =
            measureTabs([Marimekko], GRAPHER_TAB_CONFIG_OPTIONS.marimekko) -
            measureTabs([LineChart], GRAPHER_TAB_CONFIG_OPTIONS.line)

        expect(swappedWithOverflow).not.toBe(0)
        expect(swappedWithOverflow).toBeCloseTo(swappedWithoutOverflow)
    })

    it("adds the overflow button only while tabs are hidden", () => {
        expect(
            measureTabs(
                [LineChart, DiscreteBar, Marimekko],
                GRAPHER_TAB_CONFIG_OPTIONS.line
            )
        ).toBeGreaterThan(
            measureTabs([LineChart], GRAPHER_TAB_CONFIG_OPTIONS.line)
        )
    })

    it("adds no width for a chart without tabs to switch between", () => {
        expect(
            ContentSwitchers.measureWidth(
                LifeExpectancyGrapher({
                    chartTypes: [LineChart],
                    hasMapTab: false,
                    hasTableTab: false,
                }),
                { labelMode: "label", paddingPx: 16, visibleTabCount: 1 }
            )
        ).toBe(0)
    })
})
