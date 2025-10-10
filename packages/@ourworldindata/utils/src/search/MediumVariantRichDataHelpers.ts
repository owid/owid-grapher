import * as _ from "lodash-es"
import { match } from "ts-pattern"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    MediumVariantGridSlotKey,
    LayoutSlot,
} from "@ourworldindata/types"
import { getTableColumnCountForGridSlotKey } from "./SearchHelpers.js"

type PlacingOptions =
    | { tableType: "none" }
    | {
          tableType: "data-table"
          numDataTableRows: number
          numDataTableRowsPerColumn: number
      }
    | {
          tableType: "data-points"
          numMaxSlotsForTable: number
      }

export function placeGrapherTabsInMediumVariantGridLayout(
    tabs: GrapherTabName[],
    options: {
        hasDataDisplay: boolean
        prioritizeTableOverDiscreteBar?: boolean
    } & PlacingOptions
): LayoutSlot<MediumVariantGridSlotKey>[] {
    // If there is a data display, then three equally-sized slots are available,
    // plus two smaller slots below the data display. If there is no data display,
    // then four equally-sized slots are available.

    if (options.hasDataDisplay) {
        const placedMainTabs = assignTabsToGridSlotKeys(tabs, {
            numAvailableGridSlotKeys: 3,
            ...options,
        })

        const remainingTabs = tabs.slice(placedMainTabs.length)
        const placedRemainingTabs = remainingTabs
            .slice(0, 2)
            .map((tab, tabIndex) => ({
                grapherTab: tab,
                slotKey:
                    tabIndex === 0
                        ? MediumVariantGridSlotKey.SmallLeft
                        : MediumVariantGridSlotKey.SmallRight,
            }))
        return [...placedMainTabs, ...placedRemainingTabs]
    } else {
        return assignTabsToGridSlotKeys(tabs, {
            numAvailableGridSlotKeys: 4,
            ...options,
        })
    }
}

/**
 * Assigns Grapher tabs to grid slots with special handling for the DiscreteBar tab.
 */
function assignTabsToGridSlotKeys(
    tabs: GrapherTabName[],
    options: {
        numAvailableGridSlotKeys: number
        prioritizeTableOverDiscreteBar?: boolean
    } & PlacingOptions
): LayoutSlot<MediumVariantGridSlotKey>[] {
    // No special handling for discrete bar charts
    if (!options.prioritizeTableOverDiscreteBar)
        return placeTabsInUniformGrid(tabs, options)

    const hasSecondaryDiscreteBarTab =
        tabs[0] !== GRAPHER_TAB_NAMES.DiscreteBar &&
        tabs.includes(GRAPHER_TAB_NAMES.DiscreteBar)

    // No need for special handling if there's no DiscreteBar tab
    if (!hasSecondaryDiscreteBarTab)
        return placeTabsInUniformGrid(tabs, options)

    // Place tabs without the discrete bar tab
    const placedMainTabs = placeTabsInUniformGrid(
        tabs.filter((tab) => tab !== GRAPHER_TAB_NAMES.DiscreteBar),
        options
    )

    // Check if there's space for the discrete bar tab
    const numOccupiedSlots = _.sumBy(placedMainTabs, ({ slotKey }) =>
        getTableColumnCountForGridSlotKey(slotKey)
    )
    if (numOccupiedSlots < options.numAvailableGridSlotKeys) {
        placedMainTabs.push({
            grapherTab: GRAPHER_TAB_NAMES.DiscreteBar,
            slotKey: MediumVariantGridSlotKey.Single,
        })
    }

    return placedMainTabs
}

/**
 * Place Grapher tabs in a uniform grid layout.
 *
 * Chart tabs always occupy a single slots. The table tab might occupy more
 * than one slot if there is space and enough data to fill it.
 */
function placeTabsInUniformGrid(
    tabs: GrapherTabName[],
    options: { numAvailableGridSlotKeys: number } & PlacingOptions
): LayoutSlot<MediumVariantGridSlotKey>[] {
    const maxNumTabs = options.numAvailableGridSlotKeys

    // If none of the tabs display a table, then all tabs trivially take up one slot each
    if (!tabs.some((tab) => tab === GRAPHER_TAB_NAMES.Table)) {
        return tabs.slice(0, maxNumTabs).map((tab) => ({
            grapherTab: tab,
            slotKey: MediumVariantGridSlotKey.Single,
        }))
    }

    const numTabs = Math.min(tabs.length, maxNumTabs)
    const numCharts = numTabs - 1 // without the table tab

    const numAvailableSlotsForTable =
        options.numAvailableGridSlotKeys - numCharts // >= 1

    if (numAvailableSlotsForTable <= 1) {
        return tabs.slice(0, maxNumTabs).map((tab) => ({
            grapherTab: tab,
            slotKey: MediumVariantGridSlotKey.Single,
        }))
    }

    const numSlotsForTable = match(options)
        .with({ tableType: "none" }, () => 0)
        .with({ tableType: "data-points" }, ({ numMaxSlotsForTable }) =>
            numMaxSlotsForTable
                ? Math.min(numAvailableSlotsForTable, numMaxSlotsForTable)
                : numAvailableSlotsForTable
        )
        .with(
            { tableType: "data-table" },
            ({ numDataTableRows, numDataTableRowsPerColumn }) => {
                const numNeededSlotsForTable = Math.ceil(
                    numDataTableRows / numDataTableRowsPerColumn
                )

                return Math.min(
                    numAvailableSlotsForTable,
                    numNeededSlotsForTable
                )
            }
        )
        .exhaustive()

    const tableSlot = getGridSlotKeyForCount(numSlotsForTable)

    return tabs.map((tab) => ({
        grapherTab: tab,
        slotKey:
            tab === GRAPHER_TAB_NAMES.Table
                ? tableSlot
                : MediumVariantGridSlotKey.Single,
    }))
}

function getGridSlotKeyForCount(slotCount: number): MediumVariantGridSlotKey {
    if (slotCount <= 1) return MediumVariantGridSlotKey.Single
    else if (slotCount === 2) return MediumVariantGridSlotKey.Double
    else if (slotCount === 3) return MediumVariantGridSlotKey.Triple
    else return MediumVariantGridSlotKey.Quad
}
