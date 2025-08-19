import { match } from "ts-pattern"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
import { buildChartHitDataTableContent } from "./SearchChartHitDataTableHelpers"
import {
    constructGrapherValuesJson,
    GrapherState,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import { buildChartHitDataDisplayProps } from "./searchUtils"
import {
    Layout,
    MediumVariantGridSlot,
    PlacedTab,
} from "./SearchChartHitRichDataTypes.js"

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
    options: { hasDataDisplay: boolean } & PlacingOptions
): PlacedTab<MediumVariantGridSlot>[] {
    // If there is a data display, then three equally-sized slots are available,
    // plus two smaller slots below the data display. If there is no data display,
    // then four equally-sized slots are available.

    if (options.hasDataDisplay) {
        const placedMainTabs = placeTabsInUniformGrid(tabs, {
            numAvailableGridSlots: 3,
            ...options,
        })

        const remainingTabs = tabs.slice(placedMainTabs.length)
        const placedRemainingTabs = remainingTabs
            .slice(0, 2)
            .map((tab, tabIndex) => ({
                tab,
                slot:
                    tabIndex === 0
                        ? MediumVariantGridSlot.SmallLeft
                        : MediumVariantGridSlot.SmallRight,
            }))
        return [...placedMainTabs, ...placedRemainingTabs]
    } else {
        return placeTabsInUniformGrid(tabs, {
            numAvailableGridSlots: 4,
            ...options,
        })
    }
}

/**
 * Place Grapher tabs in a uniform grid layout.
 *
 * Chart tabs always occupy a single slots. The table tab might occupy more
 * than one slot if there is space and enough data to fill it.
 */
function placeTabsInUniformGrid(
    tabs: GrapherTabName[],
    options: { numAvailableGridSlots: number } & PlacingOptions
) {
    const maxNumTabs = options.numAvailableGridSlots

    // If none of the tabs display a table, then all tabs trivially take up one slot each
    if (!tabs.some((tab) => tab === GRAPHER_TAB_NAMES.Table)) {
        return tabs
            .slice(0, maxNumTabs)
            .map((tab) => ({ tab, slot: MediumVariantGridSlot.Single }))
    }

    const numTabs = Math.min(tabs.length, maxNumTabs)
    const numCharts = numTabs - 1 // without the table tab

    const numAvailableSlotsForTable = options.numAvailableGridSlots - numCharts // >= 1

    if (numAvailableSlotsForTable <= 1) {
        return tabs
            .slice(0, maxNumTabs)
            .map((tab) => ({ tab, slot: MediumVariantGridSlot.Single }))
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

    const tableSlot = getGridSlotForCount(numSlotsForTable)

    return tabs.map((tab) => ({
        tab,
        slot:
            tab === GRAPHER_TAB_NAMES.Table
                ? tableSlot
                : MediumVariantGridSlot.Single,
    }))
}

function getGridSlotForCount(slotCount: number): MediumVariantGridSlot {
    if (slotCount <= 1) return MediumVariantGridSlot.Single
    else if (slotCount === 2) return MediumVariantGridSlot.Double
    else if (slotCount === 3) return MediumVariantGridSlot.Triple
    else return MediumVariantGridSlot.Quad
}

export function calculateMediumVariantLayout(
    grapherState: GrapherState,
    {
        sortedTabs,
        entityForDataDisplay = WORLD_ENTITY_NAME,
        numDataTableRowsPerColumn,
    }: {
        sortedTabs: GrapherTabName[]
        entityForDataDisplay?: EntityName
        numDataTableRowsPerColumn: number
    }
): Layout<MediumVariantGridSlot> | undefined {
    // Build the data table props
    const dataTableContent = buildChartHitDataTableContent({ grapherState })
    if (!dataTableContent) return undefined

    // Prepare rendering the data display
    const hasDataDisplayProps = dataTableContent.type !== "data-points"
    const chartInfo = hasDataDisplayProps
        ? constructGrapherValuesJson(grapherState, entityForDataDisplay)
        : undefined
    const dataDisplayProps = buildChartHitDataDisplayProps({
        chartInfo,
        chartType: grapherState.chartType,
        entity: entityForDataDisplay,
        isEntityPickedByUser: entityForDataDisplay !== WORLD_ENTITY_NAME,
    })

    // Figure out the layout by assigning each Grapher tab to grid slots.
    // The table tab can optionally span two or more slots (instead of just one)
    // if there's enough space in the grid and enough data to justify it.
    const placedTabs = match(dataTableContent)
        .with({ type: "data-table" }, (dataTableContent) =>
            placeGrapherTabsInMediumVariantGridLayout(sortedTabs, {
                hasDataDisplay: !!dataDisplayProps,
                tableType: dataTableContent.type,
                numDataTableRows: dataTableContent.props.rows.length,
                numDataTableRowsPerColumn,
            })
        )
        .with({ type: "data-points" }, (dataTableContent) =>
            placeGrapherTabsInMediumVariantGridLayout(sortedTabs, {
                hasDataDisplay: !!dataDisplayProps,
                tableType: dataTableContent.type,
                numMaxSlotsForTable: 2,
            })
        )
        .exhaustive()

    return { placedTabs, dataTableContent, dataDisplayProps }
}
