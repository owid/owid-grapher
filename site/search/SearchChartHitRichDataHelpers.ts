import * as R from "remeda"
import * as _ from "lodash-es"
import { match } from "ts-pattern"
import { RichDataComponentVariant } from "./SearchChartHitRichDataTypes.js"
import {
    SearchChartHitComponentVariant,
    GridSlotKey,
    LargeVariantGridSlotKey,
    MediumVariantGridSlotKey,
    LayoutSlot,
    SearchChartHit,
    GrapherQueryParams,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
    ChartLabelMode,
    GrapherVariant,
} from "@ourworldindata/types"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    mapGrapherTabNameToQueryParam,
    type ExplicitImageSize,
    type ImageRequest,
} from "@ourworldindata/grapher"
import { constructPreviewUrl } from "./searchUtils.js"
import { getTableColumnCountForGridSlotKey } from "@ourworldindata/utils"

// Keep in sync with $scatter-thumbnail-width and $scatter-thumbnail-height in SearchChartHitRichData.scss
const SCATTER_THUMBNAIL_WIDTH = 300
const SCATTER_THUMBNAIL_HEIGHT = 200

const STACKED_THUMBNAIL_SPACING_PX = 16

const TABS_WITH_SMALLER_THUMBNAIL_FONT: GrapherTabName[] = [
    GRAPHER_TAB_NAMES.WorldMap,
    GRAPHER_TAB_NAMES.DiscreteBar,
    GRAPHER_TAB_NAMES.StackedDiscreteBar,
    GRAPHER_TAB_NAMES.Swimlane,
    GRAPHER_TAB_NAMES.Dumbbell,
]

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

export function constructPreviewUrlForTab({
    hit,
    grapherQueryParams,
    variant,
    layout,
    slotIndex,
    isMediumScreen,
    hasScatter,
}: {
    hit: SearchChartHit
    grapherQueryParams: GrapherQueryParams
    variant: SearchChartHitComponentVariant
    layout: LayoutSlot[]
    slotIndex: number
    isMediumScreen: boolean
    hasScatter: boolean
}): { previewUrl: string; imageWidth?: number; imageHeight?: number } {
    const { grapherTab, previewParams } = layout[slotIndex]

    const isAnnotatedByTable = slotIndex === 0 && !isMediumScreen

    const grapherParamsForSlotTab = {
        ...grapherQueryParams,
        tab: mapGrapherTabNameToQueryParam(grapherTab),
    }

    const isLargePreview = isAnnotatedByTable && variant === "large"
    const size: ExplicitImageSize = isLargePreview
        ? { kind: "explicit", ...calculateLargePreviewImageDimensions(layout) }
        : {
              kind: "explicit",
              ...(hasScatter && calculateScatterPreviewImageDimensions()),
              ...(TABS_WITH_SMALLER_THUMBNAIL_FONT.includes(grapherTab) && {
                  fontSize: 12,
              }),
          }
    const imageRequest: ImageRequest = isLargePreview
        ? {
              variant: GrapherVariant.Uncaptioned,
              labelMode: ChartLabelMode.Values,
              size,
              includeDetails: false,
          }
        : {
              variant: GrapherVariant.Thumbnail,
              labelMode: isAnnotatedByTable
                  ? ChartLabelMode.Values
                  : ChartLabelMode.All,
              size,
              includeDetails: false,
          }

    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams: {
            ...grapherParamsForSlotTab,
            ...previewParams,
        },
        imageRequest,
    })

    return { previewUrl, imageWidth: size.width, imageHeight: size.height }
}

function calculateLargePreviewImageDimensions(layout: LayoutSlot[]): {
    width: number
    height: number
} {
    const slots = layout.map(({ slotKey }) => slotKey)

    if (slots.length <= 2) {
        return {
            width: 4 * GRAPHER_THUMBNAIL_WIDTH,
            height: 4 * GRAPHER_THUMBNAIL_HEIGHT,
        }
    }

    return {
        width: 4 * GRAPHER_THUMBNAIL_WIDTH,
        height: 4 * (GRAPHER_THUMBNAIL_HEIGHT + STACKED_THUMBNAIL_SPACING_PX),
    }
}
