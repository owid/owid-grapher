import { match } from "ts-pattern"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    LargeVariantGridSlotKey,
    LayoutSlot,
} from "@ourworldindata/types"

type PlacingOptions =
    | {
          tableType: "data-table"
          numDataTableRows: number
          numDataTableRowsPerColumn: number
      }
    | { tableType: "data-points" }

export function placeGrapherTabsInLargeVariantGrid(
    tabs: GrapherTabName[],
    options: PlacingOptions
): LayoutSlot<LargeVariantGridSlotKey>[] {
    const { Table } = GRAPHER_TAB_NAMES
    const {
        Full,
        SingleCell,
        RightQuadLeftColumn,
        RightQuad,
        RightQuadBottomRow,
        LeftQuad,
        BottomRightCell,
        TopRightCell,
    } = LargeVariantGridSlotKey

    // Special case: The table tab is in the first position
    if (tabs.length === 1 && tabs[0] === Table)
        return [{ grapherTab: Table, slotKey: Full }]

    // Special case: There is no table tab (should never happen)
    if (!tabs.includes(Table))
        return tabs
            .slice(0, 8)
            .map((tab) => ({ grapherTab: tab, slotKey: SingleCell }))

    // All tabs except the primary tab and the table tab
    const remainingTabs = tabs.slice(2)
    const numRemainingTabs = remainingTabs.length

    // Find the appropriate slot for the table tab
    const tableSlot = match(options)
        .with(
            { tableType: "data-table" },
            ({ numDataTableRows, numDataTableRowsPerColumn }) => {
                // When there are chart thumbnails to be displayed on the right side,
                // show the table in the left column to leave space for the thumbnails
                if (numRemainingTabs > 0) return RightQuadLeftColumn

                // When no thumbnails need to be displayed, check if we have enough
                // table rows to justify using the full right quadrant
                return numDataTableRows > numDataTableRowsPerColumn
                    ? RightQuad
                    : RightQuadLeftColumn
            }
        )
        .with({ tableType: "data-points" }, () => {
            // When there are chart thumbnails to be displayed on the right side,
            // limit the table to the bottom row to leave space for the thumbnails
            if (numRemainingTabs > 0) return RightQuadBottomRow

            // Otherwise, use the full right quadrant
            return RightQuad
        })
        .exhaustive()

    // The primary/first tab always takes up the left half of the grid
    const placedPrimaryTab = { grapherTab: tabs[0], slotKey: LeftQuad }
    const placedTableTab = { grapherTab: Table, slotKey: tableSlot }

    // If the table takes up the right quadrant, there is no space
    // for any additional thumbnails
    if (tableSlot === RightQuad) return [placedPrimaryTab, placedTableTab]

    // Otherwise, there is space for two additional thumbnails
    return [
        placedPrimaryTab,
        placedTableTab,
        // If the table takes up the bottom row, place the remaining tabs anywhere
        // (starting by default from the left). If the table takes up the left
        // column, place the remaining tabs starting from the bottom
        {
            grapherTab: remainingTabs[0],
            slotKey:
                tableSlot === RightQuadBottomRow ? SingleCell : BottomRightCell,
        },
        {
            grapherTab: remainingTabs[1],
            slotKey:
                tableSlot === RightQuadBottomRow ? SingleCell : TopRightCell,
        },
    ].filter(({ grapherTab }) => grapherTab)
}
