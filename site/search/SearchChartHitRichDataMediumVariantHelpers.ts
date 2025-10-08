import * as _ from "lodash-es"
import { match } from "ts-pattern"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    GrapherValuesJson,
    SearchChartHitDataTableContent,
    SeriesStrategy,
} from "@ourworldindata/types"
import { GrapherState, WORLD_ENTITY_NAME } from "@ourworldindata/grapher"
import { buildChartHitDataDisplayProps } from "./searchUtils"
import {
    Layout,
    MediumVariantGridSlot,
    PlacedTab,
} from "./SearchChartHitRichDataTypes.js"
import {
    extractTableSlot,
    getTableColumnCountForGridSlot,
} from "./SearchChartHitRichDataHelpers"

type PlacingOptions =
    | { tableType: "none" }
    | { tableType: "unknown" }
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
): PlacedTab<MediumVariantGridSlot>[] {
    // If there is a data display, then three equally-sized slots are available,
    // plus two smaller slots below the data display. If there is no data display,
    // then four equally-sized slots are available.

    if (options.hasDataDisplay) {
        const placedMainTabs = assignTabsToGridSlots(tabs, {
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
        return assignTabsToGridSlots(tabs, {
            numAvailableGridSlots: 4,
            ...options,
        })
    }
}

/**
 * Assigns Grapher tabs to grid slots with special handling for the DiscreteBar tab.
 */
function assignTabsToGridSlots(
    tabs: GrapherTabName[],
    options: {
        numAvailableGridSlots: number
        prioritizeTableOverDiscreteBar?: boolean
    } & PlacingOptions
) {
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
    const numOccupiedSlots = _.sumBy(placedMainTabs, ({ slot }) =>
        getTableColumnCountForGridSlot(slot)
    )
    if (numOccupiedSlots < options.numAvailableGridSlots) {
        placedMainTabs.push({
            tab: GRAPHER_TAB_NAMES.DiscreteBar,
            slot: MediumVariantGridSlot.Single,
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
        .with({ tableType: "unknown" }, () => numAvailableSlotsForTable)
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
        chartInfo,
        dataTableContent,
        sortedTabs,
        entityForDataDisplay = WORLD_ENTITY_NAME,
        numDataTableRowsPerColumn,
    }: {
        chartInfo?: GrapherValuesJson
        dataTableContent?: SearchChartHitDataTableContent
        sortedTabs: GrapherTabName[]
        entityForDataDisplay?: EntityName
        numDataTableRowsPerColumn: number
    }
): Layout<MediumVariantGridSlot> | undefined {
    // Build the data table props
    if (!dataTableContent) return undefined

    // Prepare rendering the data display
    const hasDataDisplayProps = dataTableContent.type !== "data-points"
    const dataDisplayProps = hasDataDisplayProps
        ? buildChartHitDataDisplayProps({
              chartInfo,
              chartType: grapherState.chartType,
              entity: entityForDataDisplay,
              isEntityPickedByUser: entityForDataDisplay !== WORLD_ENTITY_NAME,
          })
        : undefined

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
                prioritizeTableOverDiscreteBar:
                    shouldPrioritizeTableOverDiscreteBar(grapherState),
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

export function pickInitialTableSlotForMediumVariant(
    grapherState: GrapherState,
    {
        chartInfo,
        sortedTabs,
        entityForDataDisplay = WORLD_ENTITY_NAME,
    }: {
        chartInfo?: GrapherValuesJson
        sortedTabs: GrapherTabName[]
        entityForDataDisplay?: EntityName
    }
): MediumVariantGridSlot | undefined {
    const hasDataDisplay = !!buildChartHitDataDisplayProps({
        chartInfo,
        chartType: grapherState.chartType,
        entity: entityForDataDisplay,
        isEntityPickedByUser: entityForDataDisplay !== WORLD_ENTITY_NAME,
    })

    const placedTabs = placeGrapherTabsInMediumVariantGridLayout(sortedTabs, {
        hasDataDisplay,
        tableType: "unknown",
        prioritizeTableOverDiscreteBar:
            shouldPrioritizeTableOverDiscreteBar(grapherState),
    })

    return extractTableSlot(placedTabs)
}

/**
 * Determine whether to allow dropping the DiscreteBar tab to make
 * room for the table. We only prioritize the table in one scenario:
 * When plotting columns (rather than entities), we want to
 * label as many columns as possible since all column lines are
 * plotted (they can't be deselected, other than entity lines)
 */
function shouldPrioritizeTableOverDiscreteBar(grapherState: GrapherState) {
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState
    return (
        seriesStrategy === SeriesStrategy.column &&
        !grapherState.isFaceted &&
        !grapherState.hasProjectedData &&
        !grapherState.isStackedDiscreteBar
    )
}
