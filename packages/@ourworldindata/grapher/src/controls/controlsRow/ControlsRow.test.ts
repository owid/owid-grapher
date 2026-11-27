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
import { ControlsRowLayout } from "./ControlsRowHelpers"
import { EntitySelectionToggle } from "../EntitySelectionToggle"
import { SettingsMenu } from "../SettingsMenu"
import { DataTableFilterDropdown } from "../DataTableFilterDropdown"
import { DataTableSearchField } from "../DataTableSearchField"
import { MapRegionDropdown } from "../MapRegionDropdown"
import { MapZoomDropdown } from "../MapZoomDropdown"
import { MapResetButton } from "../MapResetButton"
import { MapZoomToSelectionButton } from "../MapZoomToSelectionButton"
import { ControlsRow } from "./ControlsRow"
import { listCompactionSteps } from "./ControlsRowTestHelpers"
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
        listCompactionSteps().map(({ changedFields, before, after }) => {
            const widthChange =
                ControlsRow.measureWidth(grapherState, after) -
                ControlsRow.measureWidth(grapherState, before)
            return [changedFields, describeWidthChange(widthChange)]
        })
    )

type WidthChange = "narrower" | "unchanged" | "wider"

function describeWidthChange(widthChange: number): WidthChange {
    if (widthChange < 0) return "narrower"
    if (widthChange > 0) return "wider"
    return "unchanged"
}

describe(ControlsRow.measureWidth, () => {
    it("narrows the chart tab's row at every step but the table filter's", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.chart)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "narrower",
            "settingsLabel: icon": "narrower",
            "showTableFilter: false": "unchanged",
            "tabs.labelMode: icon": "narrower",
            "entityLabel: actionOnly": "narrower",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    it("narrows the map tab's row at the tab steps and the short entity label only", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "narrower",
            "settingsLabel: icon": "unchanged",
            "showTableFilter: false": "unchanged",
            "tabs.labelMode: icon": "narrower",
            "entityLabel: actionOnly": "unchanged",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    it("narrows the table tab's row at the tab steps and the table filter only", () => {
        expect(
            describeWidthChangeByStep(
                makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.table)
            )
        ).toEqual({
            "tabs.paddingPx: 12": "narrower",
            "entityLabel: short": "unchanged",
            "settingsLabel: icon": "unchanged",
            "showTableFilter: false": "narrower",
            "tabs.labelMode: icon": "narrower",
            "entityLabel: actionOnly": "unchanged",
            "tabs.paddingPx: 8": "narrower",
        })
    })

    const FULL_LAYOUT: ControlsRowLayout = {
        tabs: { labelMode: "label", paddingPx: 16 },
        entityLabel: "full",
        settingsLabel: "label",
        showTableFilter: true,
    }
    const SIDES_GAP = 16
    const CONTROLS_GAP = 8

    const measureControlsSide = (grapherState: GrapherState): number =>
        ControlsRow.measureWidth(grapherState, FULL_LAYOUT) -
        ContentSwitchers.measureWidth(grapherState, FULL_LAYOUT.tabs)

    it("is only the gap between its sides when it shows nothing", () => {
        const grapherState = LifeExpectancyGrapher({
            chartTypes: [GRAPHER_CHART_TYPES.LineChart],
            hasMapTab: false,
            hasTableTab: false,
            hideEntityControls: true,
        })
        expect(ControlsRow.measureWidth(grapherState, FULL_LAYOUT)).toBe(
            SIDES_GAP
        )
    })

    it("counts the region dropdown on the map tab while a continent is shown", () => {
        const continent = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map)
        const world = makeFiveTabGrapher(GRAPHER_TAB_CONFIG_OPTIONS.map, {
            map: { region: MapRegionName.World },
        })
        expect(
            ControlsRow.measureWidth(continent, FULL_LAYOUT) -
                ControlsRow.measureWidth(world, FULL_LAYOUT)
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
