import { describe, expect, it } from "vitest"
import { GRAPHER_TAB_NAMES, GrapherTabName } from "@ourworldindata/types"
import {
    ControlsRowLayout,
    EntityLabelMode,
    EntityLabelParts,
    findControlsRowLayout,
    pickVisibleTabs,
    resolveEntityLabel,
} from "./ControlsRowHelpers"
import { listCompactionSteps } from "./ControlsRowTestHelpers"

const TAB_COUNT = 4

const FULL_LAYOUT: ControlsRowLayout = {
    tabs: { labelMode: "label", paddingPx: 16, visibleTabCount: TAB_COUNT },
    entityLabel: "full",
    settingsLabel: "label",
    showTableFilter: true,
}

const MOST_COMPACT_LAYOUT: ControlsRowLayout = {
    tabs: { labelMode: "icon", paddingPx: 8, visibleTabCount: 1 },
    entityLabel: "actionOnly",
    settingsLabel: "icon",
    showTableFilter: false,
}

describe(findControlsRowLayout, () => {
    it("returns the full layout when everything fits", () => {
        expect(findControlsRowLayout(() => 1000, Infinity, TAB_COUNT)).toEqual(
            FULL_LAYOUT
        )
    })

    it("returns a layout whose width equals the maximum", () => {
        expect(findControlsRowLayout(() => 1000, 1000, TAB_COUNT)).toEqual(
            FULL_LAYOUT
        )
    })

    it("returns the first layout that fits, not a narrower one", () => {
        expect(
            findControlsRowLayout(
                (layout) => (layout.settingsLabel === "icon" ? 500 : 501),
                500,
                TAB_COUNT
            )
        ).toEqual({
            tabs: { labelMode: "label", paddingPx: 12, visibleTabCount: 4 },
            entityLabel: "short",
            settingsLabel: "icon",
            showTableFilter: true,
        })
    })

    it("returns the most compact layout when nothing fits", () => {
        expect(findControlsRowLayout(() => 1, 0, TAB_COUNT)).toEqual(
            MOST_COMPACT_LAYOUT
        )
    })

    it("compacts in a fixed order", () => {
        expect(
            listCompactionSteps(TAB_COUNT).map((step) => step.changedFields)
        ).toEqual([
            "tabs.paddingPx: 12",
            "entityLabel: short",
            "settingsLabel: icon",
            "showTableFilter: false",
            "tabs.visibleTabCount: 3",
            "tabs.visibleTabCount: 2",
            "tabs.labelMode: icon, tabs.visibleTabCount: 4",
            "tabs.visibleTabCount: 3",
            "tabs.visibleTabCount: 2",
            "tabs.visibleTabCount: 1",
            "entityLabel: actionOnly",
            "tabs.paddingPx: 8",
        ])
    })

    it("hides no tab for a chart with a single tab", () => {
        expect(
            listCompactionSteps(1).map((step) => step.changedFields)
        ).toEqual([
            "tabs.paddingPx: 12",
            "entityLabel: short",
            "settingsLabel: icon",
            "showTableFilter: false",
            "tabs.labelMode: icon",
            "entityLabel: actionOnly",
            "tabs.paddingPx: 8",
        ])
    })

    it("hides only an icon tab for a chart with two tabs", () => {
        expect(
            listCompactionSteps(2).map((step) => step.changedFields)
        ).toEqual([
            "tabs.paddingPx: 12",
            "entityLabel: short",
            "settingsLabel: icon",
            "showTableFilter: false",
            "tabs.labelMode: icon",
            "tabs.visibleTabCount: 1",
            "entityLabel: actionOnly",
            "tabs.paddingPx: 8",
        ])
    })
})

describe(resolveEntityLabel, () => {
    const resolveAllModes = (
        parts: EntityLabelParts
    ): Record<EntityLabelMode, string> => ({
        full: resolveEntityLabel("full", parts),
        short: resolveEntityLabel("short", parts),
        actionOnly: resolveEntityLabel("actionOnly", parts),
    })

    it("drops the suffix before the entity name", () => {
        expect(
            resolveAllModes({
                action: "Edit",
                entity: "countries",
                entitySuffix: " and regions",
            })
        ).toEqual({
            full: "Edit countries and regions",
            short: "Edit countries",
            actionOnly: "Edit",
        })
    })

    it("drops the entity name when there is no suffix to drop", () => {
        expect(
            resolveAllModes({ action: "Edit", entity: "provinces" })
        ).toEqual({ full: "Edit provinces", short: "Edit", actionOnly: "Edit" })
    })
})

describe(pickVisibleTabs, () => {
    const { Table, WorldMap, LineChart, DiscreteBar, Marimekko } =
        GRAPHER_TAB_NAMES
    const TABS: GrapherTabName[] = [
        Table,
        WorldMap,
        LineChart,
        DiscreteBar,
        Marimekko,
    ]

    it("shows every tab when the count covers them all", () => {
        expect(pickVisibleTabs(TABS, LineChart, TABS.length)).toEqual({
            visible: TABS,
            hidden: [],
        })
        expect(pickVisibleTabs(TABS, LineChart, 10).hidden).toEqual([])
    })

    it("shows the first tabs when the active tab is among them", () => {
        expect(pickVisibleTabs(TABS, WorldMap, 3)).toEqual({
            visible: [Table, WorldMap, LineChart],
            hidden: [DiscreteBar, Marimekko],
        })
    })

    it("puts an active tab that would be hidden into the last visible slot", () => {
        expect(pickVisibleTabs(TABS, Marimekko, 3)).toEqual({
            visible: [Table, WorldMap, Marimekko],
            hidden: [LineChart, DiscreteBar],
        })
    })
})
