import * as d3 from "d3"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import { Bounds } from "@ourworldindata/utils"
import { formatCount, formatShare } from "../helpers/PovertyHelpers.js"
import { useWhereAreThePoorChartContext } from "../helpers/PovertyTreemapContext.js"
import { TreeNode } from "../helpers/PovertyConstants.js"
import { MarkdownTextWrap } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrap.js"
import { MarkdownTextWrapSvg } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrapComponents.js"

type LabelKey = "title" | "share" | "headcount"

type LabelKeyRecord<V> = Record<LabelKey, V>
interface PartialLabelKeyRecord<V> {
    title: V
    share: V
    headcount?: V
}

export function PovertyTreemapTileLabels({
    node,
    width,
    height,
    color,
    treemapBounds,
}: {
    node: TreeNode
    width: number
    height: number
    color: string
    treemapBounds: Bounds
}) {
    const { isMobile } = useWhereAreThePoorChartContext()

    const { value, share, countryName } = node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined || !countryName) return null

    const area = width * height

    const minFontSize = isMobile
        ? Math.max(10, treemapBounds.width / 100)
        : Math.max(8, treemapBounds.width / 150) // Minimum font size scales with width
    const maxFontSize = isMobile
        ? Math.min(20, treemapBounds.width / 16, treemapBounds.height / 25)
        : Math.min(24, treemapBounds.width / 30, treemapBounds.height / 20) // Maximum font size scales with dimensions

    // Calculate font size based on rectangle area using d3 scaling
    // Make font size range responsive to visualization dimensions
    const fontSizeScale = d3
        .scaleSqrt()
        .domain([0, (treemapBounds.width * treemapBounds.height) / 4]) // assume max meaningful area is 1/4 of total
        .range([minFontSize, maxFontSize])
        .clamp(true)
    const baseFontSize = Math.round(fontSizeScale(area))

    // Calculate adaptive padding based on rectangle dimensions
    const horizontalPaddingScale = d3
        .scaleSqrt()
        .domain([0, treemapBounds.width / 2]) // based on rectangle width
        .range([2, 6]) // horizontal padding range from 2px to 6px
        .clamp(true)
    const horizontalPadding = Math.round(horizontalPaddingScale(width))

    const verticalPaddingScale = d3
        .scaleSqrt()
        .domain([0, treemapBounds.height / 2]) // based on rectangle height
        .range([2, 4]) // vertical padding range from 2px to 6px
        .clamp(true)
    const verticalPadding = Math.round(verticalPaddingScale(height))

    const formattedShare = formatShare(share)
    const formattedHeadcount = formatCount(value)

    const contentBounds = new Bounds(0, 0, width, height)
        .padLeft(horizontalPadding)
        .padRight(horizontalPadding / 2)
        .padTop(verticalPadding)
        .padBottom(verticalPadding / 2)

    const availableWidth = contentBounds.width
    const availableHeight = contentBounds.height

    const lineHeight = 1.1

    const makeLabelWrapForFontSize = (fontSize: number) =>
        MarkdownTextWrap.fromFragments({
            main: { text: countryName, bold: true },
            secondary: { text: formattedShare },
            newLine: "avoid-wrap",
            textWrapProps: { maxWidth: availableWidth, fontSize, lineHeight },
        })

    const fontSize = calculateOptimalFontSize({
        makeTextWrap: makeLabelWrapForFontSize,
        initialFontSize: baseFontSize,
        minFontSize: isMobile ? 10 : 8,
        availableWidth,
        availableHeight,
    })

    const metricsFontSize = isMobile ? fontSize * 0.7 : fontSize * 0.6

    const showMetrics = metricsFontSize >= (isMobile ? 9 : 10)
    const padding = verticalPadding

    const textWrap = {
        title: makeLabelWrapForFontSize(fontSize),
        share: new MarkdownTextWrap({
            text: formattedShare,
            maxWidth: availableWidth,
            fontSize: fontSize,
            lineHeight,
            fontWeight: 700,
        }),
        headcount: showMetrics
            ? new MarkdownTextWrap({
                  text: `${formattedHeadcount} people`,
                  maxWidth: availableWidth,
                  fontSize: metricsFontSize,
                  lineHeight,
              })
            : undefined,
    }

    const bounds = createTextBounds({ contentBounds, textWrap, padding })

    const shouldShow = determineVisibleLabels({
        contentBounds,
        textBounds: bounds,
    })

    const textColor = isDarkColor(color) ? "white" : "#5b5b5b"

    return (
        <g fill={textColor} style={{ pointerEvents: "none" }}>
            {shouldShow.title && (
                <MarkdownTextWrapSvg
                    textWrap={textWrap.title}
                    x={bounds.title.x}
                    y={bounds.title.y}
                    fillOpacity={0.9}
                />
            )}
            {shouldShow.share && (
                <MarkdownTextWrapSvg
                    textWrap={textWrap.share}
                    x={bounds.share.x}
                    y={bounds.share.y}
                    fillOpacity={0.9}
                />
            )}
            {textWrap.headcount && bounds.headcount && shouldShow.headcount && (
                <MarkdownTextWrapSvg
                    textWrap={textWrap.headcount}
                    x={bounds.headcount.x}
                    y={bounds.headcount.y}
                    fillOpacity={0.7}
                />
            )}
        </g>
    )
}

// Helper function to create bounds for all text elements
function createTextBounds({
    contentBounds,
    textWrap,
    padding,
}: {
    contentBounds: Bounds
    textWrap: PartialLabelKeyRecord<MarkdownTextWrap>
    padding: number
}): PartialLabelKeyRecord<Bounds> {
    const titleBounds = new Bounds(
        contentBounds.x,
        contentBounds.y,
        textWrap.title.width,
        textWrap.title.height
    )
    const shareBounds = new Bounds(
        contentBounds.x,
        contentBounds.y,
        textWrap.share.width,
        textWrap.share.height
    )
    const headcountBounds = textWrap.headcount
        ? new Bounds(
              contentBounds.x,
              titleBounds.bottom + padding,
              textWrap.headcount.width,
              textWrap.headcount.height
          )
        : undefined

    return {
        title: titleBounds,
        share: shareBounds,
        headcount: headcountBounds,
    }
}

// Helper function to check if text elements fit within available space
function determineVisibleLabels({
    contentBounds,
    textBounds,
}: {
    contentBounds: Bounds
    textBounds: PartialLabelKeyRecord<Bounds>
}): LabelKeyRecord<boolean> {
    const shouldShow: LabelKeyRecord<boolean> = {
        title: false,
        share: false,
        headcount: false,
    }

    shouldShow.title = contentBounds.encloses(textBounds.title)

    if (!shouldShow.title) {
        shouldShow.share = contentBounds.encloses(textBounds.share)
        return shouldShow
    }

    if (textBounds.headcount)
        shouldShow.headcount = contentBounds.encloses(textBounds.headcount)

    return shouldShow
}

function calculateOptimalFontSize({
    makeTextWrap,
    initialFontSize,
    availableWidth,
    availableHeight,
    minFontSize,
}: {
    makeTextWrap: (fontSize: number) => MarkdownTextWrap
    initialFontSize: number
    availableWidth: number
    availableHeight: number
    minFontSize: number
}): number {
    let fontSize = initialFontSize

    const maxIterations = 20 // Prevent infinite loops
    let iterations = 0

    let fitsWithinBounds = false
    while (
        !fitsWithinBounds &&
        fontSize > minFontSize &&
        iterations < maxIterations
    ) {
        const testMainLabelWrap = makeTextWrap(fontSize)

        fitsWithinBounds =
            testMainLabelWrap.width <= availableWidth &&
            testMainLabelWrap.height <= availableHeight

        // Reduce font size by 1px and try again
        if (!fitsWithinBounds) fontSize -= 1

        iterations++
    }

    return fontSize
}
