import { describe, expect, it } from "vitest"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherTabConfigOption,
    MapRegionName,
} from "@ourworldindata/types"
import { LifeExpectancyGrapher } from "../../testData/OwidTestData.sample"
import { GrapherState } from "../../core/GrapherState"
import { GrapherProgrammaticInterface } from "../../core/Grapher"
import {
    ControlsRowLayout,
    findControlsRowLayout,
    pickVisibleTabs,
} from "./ControlsRowHelpers"
import { EntitySelectionToggle } from "../EntitySelectionToggle"
import { SettingsMenu } from "../SettingsMenu"
import { DataTableFilterDropdown } from "../DataTableFilterDropdown"
import { DataTableSearchField } from "../DataTableSearchField"
import { MapRegionDropdown } from "../MapRegionDropdown"
import { MapZoomDropdown } from "../MapZoomDropdown"
import { MapResetButton } from "../MapResetButton"
import { MapZoomToSelectionButton } from "../MapZoomToSelectionButton"
import { ControlsRow } from "./ControlsRow"
import { CompactionStep, listCompactionSteps } from "./ControlsRowTestHelpers"
import { ContentSwitchers } from "../ContentSwitchers"

const makeFiveTabGrapher = (
    tab: GrapherTabConfigOption,
    overrides: Partial<GrapherProgrammaticInterface> = {}
): GrapherState =>
    LifeExpectancyGrapher({
        chartTypes: [
            GRAPHER_CHART_TYPES.LineChart,
            GRAPHER_CHART_TYPES.DiscreteBar,
            GRAPHER_CHART_TYPES.Marimekko,
        ],
        hasMapTab: true,
        tab,
        yAxis: { canChangeScaleType: true },
        map: { region: MapRegionName.Europe },
        ...overrides,
    })

const describeWidthChangeByStep = (
    grapherState: GrapherState
): Record<string, WidthChange> =>
    Object.fromEntries(
        listCompactionSteps(grapherState.availableTabs.length)
            .filter((step) => !isTabHidingStep(step))
            .map(({ changedFields, before, after }) => {
                const widthChange =
                    ControlsRow.measureWidth(grapherState, after) -
                    ControlsRow.measureWidth(grapherState, before)
                return [changedFields, describeWidthChange(widthChange)]
            })
    )

const isTabHidingStep = ({ changedFields }: CompactionStep): boolean =>
    changedFields.startsWith("tabs.visibleTabCount")

type WidthChange = "narrower" | "unchanged" | "wider"

function describeWidthChange(widthChange: number): WidthChange {
    if (widthChange < 0) return "narrower"
    if (widthChange > 0) return "wider"
    return "unchanged"
}

describe(ControlsRow.measureWidth, () => {
    it("narrows the chart tab's row at every step but the table filter's and the switch to icon tabs", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.chart)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "narrower",
            "settingsLabel: icon": "narrower",
            "showTableFilter: false": "unchanged",
            "tabs.labelMode: icon, tabs.visibleTabCount: 5": "wider",
            "entityLabel: actionOnly": "narrower",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    it("narrows the map tab's row at the tab padding steps and the short entity label only", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "narrower",
            "settingsLabel: icon": "unchanged",
            "showTableFilter: false": "unchanged",
            "tabs.labelMode: icon, tabs.visibleTabCount: 5": "wider",
            "entityLabel: actionOnly": "unchanged",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    it("narrows the table tab's row at the tab padding steps and the table filter only", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.table)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "unchanged",
            "settingsLabel: icon": "unchanged",
            "showTableFilter: false": "narrower",
            "tabs.labelMode: icon, tabs.visibleTabCount: 5": "wider",
            "entityLabel: actionOnly": "unchanged",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    it("narrows the row with every tab hidden into the +N menu", () => {
        const grapherState = makeFiveTabGrapher(
            GRAPHER_TAB_CONFIG_OPTIONS.chart
        )
        const tabHidingSteps = listCompactionSteps(
            grapherState.availableTabs.length
        ).filter(isTabHidingStep)
        expect(tabHidingSteps).toHaveLength(7)
        for (const { before, after } of tabHidingSteps) {
            expect(ControlsRow.measureWidth(grapherState, after)).toBeLessThan(
                ControlsRow.measureWidth(grapherState, before)
            )
        }
    })

    const makeFullLayout = (grapherState: GrapherState): ControlsRowLayout => ({
        tabs: {
            labelMode: "label",
            paddingPx: 16,
            visibleTabCount: grapherState.availableTabs.length,
        },
        entityLabel: "full",
        settingsLabel: "label",
        showTableFilter: true,
    })
    const SIDES_GAP = 16
    const CONTROLS_GAP = 8

    const measureControlsSide = (grapherState: GrapherState): number =>
        ControlsRow.measureWidth(grapherState, makeFullLayout(grapherState)) -
        ContentSwitchers.measureWidth(
            grapherState,
            makeFullLayout(grapherState).tabs
        )

    it("is only the gap between its sides when it shows nothing", () => {
        const grapherState = LifeExpectancyGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            hasMapTab: false,
            hasTableTab: false,
            hideEntityControls: true,
        })
        expect(
            ControlsRow.measureWidth(grapherState, makeFullLayout(grapherState))
        ).toBe(SIDES_GAP)
    })

    it("counts the region dropdown on the map tab while a continent is shown", () => {
        const continent = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map)
        const world = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map, {
            map: { region: MapRegionName.World },
        })
        expect(
            ControlsRow.measureWidth(continent, makeFullLayout(continent)) -
                ControlsRow.measureWidth(world, makeFullLayout(world))
        ).toBe(155 + CONTROLS_GAP)
    })

    describe("on the map tab without map selection", () => {
        const makeMobileMapGrapher = (
            overrides: Partial<GrapherProgrammaticInterface> = {}
        ): GrapherState =>
            makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map, {
                hideEntityControls: true,
                ...overrides,
            })

        it("shows only the zoom dropdown", () => {
            expect(measureControlsSide(makeMobileMapGrapher())).toBe(
                SIDES_GAP + 202
            )
        })

        it("shows only the region dropdown when the map is faceted", () => {
            const grapherState = makeMobileMapGrapher()
            grapherState.timelineHandleTimeBounds = [1950, 2020]
            expect(grapherState.isFaceted).toBe(true)
            expect(measureControlsSide(grapherState)).toBe(SIDES_GAP + 155)
        })

        it("shows only Reset zoom while the globe is active", () => {
            const grapherState = makeMobileMapGrapher()
            grapherState.mapConfig.globe = {
                ...grapherState.mapConfig.globe,
                isActive: true,
            }
            const resetZoomWidth = MapResetButton.measureWidth(
                grapherState,
                "resetZoom"
            )
            expect(resetZoomWidth).toBeDefined()
            expect(measureControlsSide(grapherState)).toBeCloseTo(
                SIDES_GAP + (resetZoomWidth ?? 0)
            )
        })
    })
})

describe("measuring a hidden control", () => {
    const chart = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.chart)
    const map = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map)
    const table = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.table)
    it.each([
        [
            "entity toggle, table tab",
            (): number | undefined =>
                EntitySelectionToggle.measureWidth(table, "full"),
        ],
        [
            "Settings, map tab",
            (): number | undefined => SettingsMenu.measureWidth(map, "label"),
        ],
        [
            "table filter, chart tab",
            (): number | undefined =>
                DataTableFilterDropdown.measureWidth(chart, true),
        ],
        [
            "search field, chart tab",
            (): number | undefined => DataTableSearchField.measureWidth(chart),
        ],
        [
            "region dropdown, chart tab",
            (): number | undefined => MapRegionDropdown.measureWidth(chart),
        ],
        [
            "zoom dropdown, chart tab",
            (): number | undefined => MapZoomDropdown.measureWidth(chart),
        ],
        [
            "Reset zoom, chart tab",
            (): number | undefined =>
                MapResetButton.measureWidth(chart, "resetZoom"),
        ],
        [
            "Reset view, chart tab",
            (): number | undefined =>
                MapResetButton.measureWidth(chart, "resetView"),
        ],
        [
            "zoom to selection, chart tab",
            (): number | undefined =>
                MapZoomToSelectionButton.measureWidth(chart),
        ],
    ])("measures nothing for the %s", (_, measureWidth) => {
        expect(measureWidth()).toBe(undefined)
    })
})

describe("choosing how many tabs to show", () => {
    const makeSevenTabGrapher = (): GrapherState =>
        LifeExpectancyGrapher({
            chartTypes: [
                GRAPHER_CHART_TYPES.LineChart,
                GRAPHER_CHART_TYPES.DiscreteBar,
                GRAPHER_CHART_TYPES.Marimekko,
                GRAPHER_CHART_TYPES.SlopeChart,
                GRAPHER_CHART_TYPES.ScatterPlot,
            ],
            hasMapTab: true,
            tab: GRAPHER_TAB_CONFIG_OPTIONS.chart,
        })

    const makeCompactLayout = (
        labelMode: "label" | "icon",
        visibleTabCount: number
    ): ControlsRowLayout => ({
        tabs: { labelMode, paddingPx: 12, visibleTabCount },
        entityLabel: "short",
        settingsLabel: "icon",
        showTableFilter: false,
    })

    const findLayout = (
        grapherState: GrapherState,
        maxWidth: number
    ): ControlsRowLayout =>
        findControlsRowLayout(
            (layout) => ControlsRow.measureWidth(grapherState, layout),
            maxWidth,
            grapherState.availableTabs.length
        )

    const SWEPT_WIDTHS_PX = Array.from({ length: 201 }, (_, i) => i * 5)

    it("shows every tab and no +N menu when the full layout fits", () => {
        const grapherState = makeSevenTabGrapher()
        const fullLayout: ControlsRowLayout = {
            tabs: { labelMode: "label", paddingPx: 16, visibleTabCount: 7 },
            entityLabel: "full",
            settingsLabel: "label",
            showTableFilter: true,
        }
        const layout = findLayout(
            grapherState,
            ControlsRow.measureWidth(grapherState, fullLayout)
        )
        expect(layout).toEqual(fullLayout)
        expect(
            pickVisibleTabs(
                grapherState.availableTabs,
                grapherState.activeTab,
                layout.tabs.visibleTabCount
            ).hidden
        ).toEqual([])
    })

    it("shows as many tabs as fit, and drops labels only when two labelled tabs don't fit", () => {
        const grapherState = makeSevenTabGrapher()
        const fits = (layout: ControlsRowLayout, maxWidth: number): boolean =>
            ControlsRow.measureWidth(grapherState, layout) <= maxWidth

        const shownLabelledCounts = new Set<number>()
        let isIconModeShown = false
        for (const maxWidth of SWEPT_WIDTHS_PX) {
            const { labelMode, visibleTabCount } = findLayout(
                grapherState,
                maxWidth
            ).tabs

            if (visibleTabCount < 7)
                expect(
                    fits(
                        makeCompactLayout(labelMode, visibleTabCount + 1),
                        maxWidth
                    )
                ).toBe(false)

            if (labelMode === "label") {
                expect(visibleTabCount).toBeGreaterThanOrEqual(2)
                shownLabelledCounts.add(visibleTabCount)
            } else {
                expect(fits(makeCompactLayout("label", 2), maxWidth)).toBe(
                    false
                )
                isIconModeShown = true
            }
        }
        expect([...shownLabelledCounts].toSorted()).toEqual([2, 3, 4, 5, 6, 7])
        expect(isIconModeShown).toBe(true)
    })

    it("shows more than three tabs of a seven-tab chart at 600px, where a fixed three tabs plus +N used to show", () => {
        const grapherState = makeSevenTabGrapher()
        const { tabs } = findLayout(grapherState, 600)
        expect(tabs.visibleTabCount).toBeGreaterThan(3)
    })
})
