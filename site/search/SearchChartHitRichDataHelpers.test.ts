import { describe, expect, it } from "vitest"
import { parseImageRequest, type ImageRequest } from "@ourworldindata/grapher"
import {
    ChartLabelMode,
    ChartRecordType,
    GRAPHER_TAB_NAMES,
    GrapherVariant,
    LargeVariantGridSlotKey,
    LayoutSlot,
    MediumVariantGridSlotKey,
    SearchChartHit,
} from "@ourworldindata/types"
import { constructPreviewUrlForTab } from "./SearchChartHitRichDataHelpers.js"
import { constructChartAndPreviewUrlsForTab } from "./SearchChartHitSmallHelpers.js"

const hit: SearchChartHit = {
    type: ChartRecordType.Chart,
    title: "Life expectancy",
    slug: "life-expectancy",
    availableEntities: ["France", "Germany"],
    objectID: "1",
    availableTabs: [GRAPHER_TAB_NAMES.LineChart, GRAPHER_TAB_NAMES.WorldMap],
    __position: 1,
}

const largeLayout: LayoutSlot[] = [
    {
        slotKey: LargeVariantGridSlotKey.LeftQuad,
        grapherTab: GRAPHER_TAB_NAMES.LineChart,
    },
    {
        slotKey: LargeVariantGridSlotKey.RightQuadLeftColumn,
        grapherTab: GRAPHER_TAB_NAMES.WorldMap,
    },
]

const largeLayoutWithThreeSlots: LayoutSlot[] = [
    ...largeLayout,
    {
        slotKey: LargeVariantGridSlotKey.BottomRightCell,
        grapherTab: GRAPHER_TAB_NAMES.DiscreteBar,
    },
]

const mediumLayout: LayoutSlot[] = [
    {
        slotKey: MediumVariantGridSlotKey.Double,
        grapherTab: GRAPHER_TAB_NAMES.LineChart,
    },
    {
        slotKey: MediumVariantGridSlotKey.Single,
        grapherTab: GRAPHER_TAB_NAMES.WorldMap,
    },
    {
        slotKey: MediumVariantGridSlotKey.SmallLeft,
        grapherTab: GRAPHER_TAB_NAMES.SlopeChart,
    },
]

function parsePreviewUrl(previewUrl: string): ImageRequest {
    const result = parseImageRequest(new URL(previewUrl).searchParams)
    if (!result.ok) throw new Error(`${previewUrl}: ${result.error.reason}`)
    return result.request
}

function requestForSlot({
    variant,
    layout,
    slotIndex,
    isMediumScreen = false,
    hasScatter = false,
}: {
    variant: "large" | "medium"
    layout: LayoutSlot[]
    slotIndex: number
    isMediumScreen?: boolean
    hasScatter?: boolean
}): ImageRequest {
    const { previewUrl } = constructPreviewUrlForTab({
        hit,
        grapherQueryParams: {},
        variant,
        layout,
        slotIndex,
        isMediumScreen,
        hasScatter,
    })
    return parsePreviewUrl(previewUrl)
}

describe(constructPreviewUrlForTab, () => {
    it("requests an uncaptioned chart with values for the large first tab", () => {
        expect(
            requestForSlot({
                variant: "large",
                layout: largeLayout,
                slotIndex: 0,
            })
        ).toEqual({
            variant: GrapherVariant.Uncaptioned,
            labelMode: ChartLabelMode.Values,
            includeDetails: false,
            size: { kind: "explicit", width: 1200, height: 640 },
        })
    })

    it("makes the large first tab taller when two thumbnails sit beside it", () => {
        expect(
            requestForSlot({
                variant: "large",
                layout: largeLayoutWithThreeSlots,
                slotIndex: 0,
            }).size
        ).toEqual({ kind: "explicit", width: 1200, height: 704 })
    })

    it("requests a simplified thumbnail with values for the medium first tab", () => {
        expect(
            requestForSlot({
                variant: "medium",
                layout: mediumLayout,
                slotIndex: 0,
            })
        ).toEqual({
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.Values,
            includeDetails: false,
            size: { kind: "explicit" },
        })
    })

    it("requests a simplified thumbnail with all labels for other tabs", () => {
        expect(
            requestForSlot({
                variant: "medium",
                layout: [
                    mediumLayout[0],
                    {
                        slotKey: MediumVariantGridSlotKey.Single,
                        grapherTab: GRAPHER_TAB_NAMES.SlopeChart,
                    },
                ],
                slotIndex: 1,
            })
        ).toEqual({
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.All,
            includeDetails: false,
            size: { kind: "explicit" },
        })
    })

    it("uses a smaller font for maps and bar charts in thumbnails", () => {
        expect(
            requestForSlot({
                variant: "large",
                layout: largeLayout,
                slotIndex: 1,
            }).size
        ).toEqual({ kind: "explicit", fontSize: 12 })
    })

    it("requests scatter-sized thumbnails when the hit has a scatter plot", () => {
        expect(
            requestForSlot({
                variant: "medium",
                layout: mediumLayout,
                slotIndex: 2,
                hasScatter: true,
            }).size
        ).toEqual({ kind: "explicit", width: 1200, height: 800 })
    })

    it("draws all labels on the first tab on medium screens, where the table may be hidden", () => {
        expect(
            requestForSlot({
                variant: "large",
                layout: largeLayout,
                slotIndex: 0,
                isMediumScreen: true,
            })
        ).toEqual({
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.All,
            includeDetails: false,
            size: { kind: "explicit" },
        })
    })
})

describe(constructChartAndPreviewUrlsForTab, () => {
    it("requests a simplified thumbnail with all labels for small hits", () => {
        const { previewUrl } = constructChartAndPreviewUrlsForTab({
            hit,
            tab: GRAPHER_TAB_NAMES.LineChart,
        })
        expect(parsePreviewUrl(previewUrl)).toEqual({
            variant: GrapherVariant.Thumbnail,
            labelMode: ChartLabelMode.All,
            includeDetails: false,
            size: { kind: "explicit" },
        })
    })
})
