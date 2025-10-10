import * as R from "remeda"
import * as _ from "lodash-es"
import { match } from "ts-pattern"
import {
    PreviewType,
    PreviewVariant,
    RichDataComponentVariant,
} from "./SearchChartHitRichDataTypes.js"
import { SearchChartHitComponentVariant } from "./searchTypes"
import { getTableColumnCountForGridSlotKey } from "@ourworldindata/utils"
import {
    GridSlotKey,
    LargeVariantGridSlotKey,
    MediumVariantGridSlotKey,
    LayoutSlot,
} from "@ourworldindata/types"

// Keep in sync with $scatter-thumbnail-width and $scatter-thumbnail-height in SearchChartHitRichData.scss
const SCATTER_THUMBNAIL_WIDTH = 300
const SCATTER_THUMBNAIL_HEIGHT = 200

/** Number of table columns for a number of placed tabs */
export function getTotalColumnCount(
    placedTabs: LayoutSlot<GridSlotKey>[]
): number {
    return R.sumBy(placedTabs, (tab) =>
        getTableColumnCountForGridSlotKey(tab.slotKey)
    )
}

export function makeSlotClassNames(
    variant: RichDataComponentVariant,
    slot: GridSlotKey
): string {
    const baseName = `${variant}-variant`
    return `${baseName}__slot ${baseName}__${mapGridSlotKeyToClassName(slot)}`
}

export function getPreviewType(
    variant: SearchChartHitComponentVariant,
    {
        isPrimaryTab,
        isSmallSlot,
    }: { isPrimaryTab: boolean; isSmallSlot: boolean }
): PreviewType {
    // Use the large thumbnail for the primary tab in the large variant
    if (isPrimaryTab && variant === "large")
        return { variant: PreviewVariant.Large, isMinimal: true }

    // Use the minimal version for the first tab (which is annotated by the table)
    // and the small slot (which is too small to read any labels) and the complete
    // version for all other tabs
    const isMinimal = isSmallSlot || isPrimaryTab

    return { variant: PreviewVariant.Thumbnail, isMinimal }
}

export function calculateScatterPreviewImageDimensions(): {
    width: number
    height: number
} {
    return {
        width: 4 * SCATTER_THUMBNAIL_WIDTH,
        height: 4 * SCATTER_THUMBNAIL_HEIGHT,
    }
}

function mapGridSlotKeyToClassName(
    slot: MediumVariantGridSlotKey | LargeVariantGridSlotKey
): string {
    return (
        match(slot)
            // medium variant grid slots
            .with(MediumVariantGridSlotKey.Single, () => "single-slot")
            .with(MediumVariantGridSlotKey.Double, () => "double-slot")
            .with(MediumVariantGridSlotKey.Triple, () => "triple-slot")
            .with(MediumVariantGridSlotKey.Quad, () => "quad-slot")
            .with(MediumVariantGridSlotKey.SmallLeft, () => "small-slot-left")
            .with(MediumVariantGridSlotKey.SmallRight, () => "small-slot-right")

            // large variant grid slots
            .with(LargeVariantGridSlotKey.Full, () => "full")
            .with(LargeVariantGridSlotKey.LeftQuad, () => "left-quad")
            .with(LargeVariantGridSlotKey.RightQuad, () => "right-quad")
            .with(
                LargeVariantGridSlotKey.RightQuadLeftColumn,
                () => "right-quad-left-column"
            )
            .with(LargeVariantGridSlotKey.TopRightCell, () => "top-right-cell")
            .with(
                LargeVariantGridSlotKey.BottomRightCell,
                () => "bottom-right-cell"
            )
            .with(LargeVariantGridSlotKey.SingleCell, () => "single-cell")
            .exhaustive()
    )
}
