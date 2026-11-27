import { describe, expect, it } from "vitest"
import {
    ControlsRowLayout,
    EntityLabelMode,
    EntityLabelParts,
    findControlsRowLayout,
    resolveEntityLabel,
} from "./ControlsRowHelpers"

const FULL_LAYOUT: ControlsRowLayout = {
    tabs: { labelMode: "label", paddingPx: 16 },
    entityLabel: "full",
    settingsLabel: "label",
    showTableFilter: true,
}

const MOST_COMPACT_LAYOUT: ControlsRowLayout = {
    tabs: { labelMode: "icon", paddingPx: 8 },
    entityLabel: "actionOnly",
    settingsLabel: "icon",
    showTableFilter: false,
}

const collectLayouts = (): ControlsRowLayout[] => {
    const layouts: ControlsRowLayout[] = []
    const mostCompact = findControlsRowLayout((layout) => {
        layouts.push(layout)
        return 1
    }, 0)
    return [...layouts, mostCompact]
}

const flattenLayout = (
    layout: ControlsRowLayout
): Record<string, string | number | boolean> => ({
    "tabs.labelMode": layout.tabs.labelMode,
    "tabs.paddingPx": layout.tabs.paddingPx,
    entityLabel: layout.entityLabel,
    settingsLabel: layout.settingsLabel,
    showTableFilter: layout.showTableFilter,
})

/** The fields each compaction step changes, as `field: newValue` */
const listStepChanges = (): string[][] => {
    const layouts = collectLayouts().map(flattenLayout)
    return layouts.slice(1).map((layout, i) =>
        Object.entries(layout)
            .filter(([field, value]) => layouts[i][field] !== value)
            .map(([field, value]) => `${field}: ${value}`)
    )
}

describe(findControlsRowLayout, () => {
    it("returns the full layout when everything fits", () => {
        expect(findControlsRowLayout(() => 1000, Infinity)).toEqual(FULL_LAYOUT)
    })

    it("returns a layout whose width equals the maximum", () => {
        expect(findControlsRowLayout(() => 1000, 1000)).toEqual(FULL_LAYOUT)
    })

    it("returns the first layout that fits, not a narrower one", () => {
        expect(
            findControlsRowLayout(
                (layout) => (layout.settingsLabel === "icon" ? 500 : 501),
                500
            )
        ).toEqual({
            tabs: { labelMode: "label", paddingPx: 12 },
            entityLabel: "short",
            settingsLabel: "icon",
            showTableFilter: true,
        })
    })

    it("returns the most compact layout when nothing fits", () => {
        expect(findControlsRowLayout(() => 1, 0)).toEqual(MOST_COMPACT_LAYOUT)
    })

    it("compacts one control per step, in a fixed order", () => {
        expect(listStepChanges()).toEqual([
            ["tabs.paddingPx: 12"],
            ["entityLabel: short"],
            ["settingsLabel: icon"],
            ["showTableFilter: false"],
            ["tabs.labelMode: icon"],
            ["entityLabel: actionOnly"],
            ["tabs.paddingPx: 8"],
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
