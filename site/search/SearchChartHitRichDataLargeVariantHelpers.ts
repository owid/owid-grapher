import { match } from "ts-pattern"
import {
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SearchChartHitDataTableContent,
} from "@ourworldindata/types"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    GrapherState,
} from "@ourworldindata/grapher"
import {
    LargeVariantGridSlot,
    Layout,
    PlacedTab,
} from "./SearchChartHitRichDataTypes.js"

export function calculateLargeVariantLayout(
    _grapherState: GrapherState,
    {
        dataTableContent,
        sortedTabs,
        numDataTableRowsPerColumn,
    }: {
        dataTableContent?: SearchChartHitDataTableContent
        sortedTabs: GrapherTabName[]
        numDataTableRowsPerColumn: number
    }
): Layout<LargeVariantGridSlot> | undefined {
    if (!dataTableContent) return undefined

    // Figure out the layout by assigning each Grapher tab to grid slots
    const placedTabs = match(dataTableContent)
        .with({ type: "data-table" }, (dataTableContent) =>
            placeGrapherTabsInLargeVariantGrid(sortedTabs, {
                tableType: dataTableContent.type,
                numDataTableRows: dataTableContent.props.rows.length,
                numDataTableRowsPerColumn,
            })
        )
        .with({ type: "data-points" }, (dataTableContent) =>
            placeGrapherTabsInLargeVariantGrid(sortedTabs, {
                tableType: dataTableContent.type,
            })
        )
        .exhaustive()

    return { placedTabs, dataTableContent }
}

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
): PlacedTab<LargeVariantGridSlot>[] {
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
    } = LargeVariantGridSlot

    // Special case: The table tab is in the first position
    if (tabs.length === 1 && tabs[0] === Table)
        return [{ tab: Table, slot: Full }]

    // Special case: There is no table tab (should never happen)
    if (!tabs.includes(Table))
        return tabs.slice(0, 8).map((tab) => ({ tab, slot: SingleCell }))

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
    const placedPrimaryTab = { tab: tabs[0], slot: LeftQuad }
    const placedTableTab = { tab: Table, slot: tableSlot }

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
            tab: remainingTabs[0],
            slot:
                tableSlot === RightQuadBottomRow ? SingleCell : BottomRightCell,
        },
        {
            tab: remainingTabs[1],
            slot: tableSlot === RightQuadBottomRow ? SingleCell : TopRightCell,
        },
    ].filter(({ tab }) => tab)
}

export function calculateLargePreviewImageDimensions(
    layout: Layout<LargeVariantGridSlot>
): {
    width: number
    height: number
} {
    const slots = layout.placedTabs.map(({ slot }) => slot)

    if (slots.length <= 2) {
        return {
            width: 4 * GRAPHER_THUMBNAIL_WIDTH,
            height: 4 * GRAPHER_THUMBNAIL_HEIGHT,
        }
    }

    // The large chart must be a little taller to match the combined height of
    // both thumbnails plus the vertical spacing and caption text between them.
    return {
        width: 4 * GRAPHER_THUMBNAIL_WIDTH,
        height: 4 * GRAPHER_THUMBNAIL_HEIGHT + 4 * 16, // Magic number
    }
}
