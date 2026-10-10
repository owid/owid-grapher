import * as d3 from "d3"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import { articulateEntity, Bounds } from "@ourworldindata/utils"
import { formatExactCount, formatShare } from "../core/ConflictDeathsHelpers.js"
import { useConflictDeathsChartContext } from "../core/ConflictDeathsContext.js"
import { TreeNode } from "../core/ConflictDeathsConstants.js"
import { MarkdownTextWrap } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrap.js"
import { TextWrapGroup } from "@ourworldindata/components/src/MarkdownTextWrap/TextWrapGroup.js"
import { MarkdownTextWrapSvg } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrapComponents.js"

type LabelKey = "title" | "percentage" | "deaths"

type LabelKeyRecord<V> = Record<LabelKey, V>
interface PartialLabelKeyRecord<V> {
    title: V
    percentage: V
    deaths?: V
}

export function ConflictDeathsTreemapTileLabels({
    node,
    width,
    height,
    color,
    isLargestTile,
    treemapBounds,
}: {
    node: TreeNode
    width: number
    height: number
    color: string
    isLargestTile: boolean
    treemapBounds: Bounds
}) {
    const { isMobile } = useConflictDeathsChartContext()

    const { value, share, entityName } = node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined || !entityName) return null

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

    // Build the lines: percentage and country first, then the death count
    const formattedPercentage = formatShare(share)
    const formattedDeaths = formatExactCount(value)

    // Only the largest rectangle gets "died in" text
    const labelText = isLargestTile
        ? `died in ${articulateEntity(entityName)}`
        : entityName

    const contentBounds = new Bounds(0, 0, width, height)
        .padLeft(horizontalPadding)
        .padRight(horizontalPadding / 2)
        .padTop(verticalPadding)
        .padBottom(verticalPadding / 2)

    const availableWidth = contentBounds.width
    const availableHeight = contentBounds.height

    const lineHeight = 1.1

    const makeLabelWrapForFontSize = (fontSize: number) =>
        new TextWrapGroup({
            fragments: [
                { text: formattedPercentage, fontWeight: 700 },
                {
                    text: labelText,
                    newLine: isLargestTile ? "continue-line" : "avoid-wrap",
                },
            ],
            maxWidth: availableWidth,
            fontSize,
            lineHeight,
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
        percentage: new MarkdownTextWrap({
            text: formattedPercentage,
            maxWidth: availableWidth,
            fontSize: fontSize,
            lineHeight,
            fontWeight: 700,
        }),
        deaths: showMetrics
            ? new MarkdownTextWrap({
                  text: `${formattedDeaths} ${value === 1 ? "death" : "deaths"}`,
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
            {shouldShow.percentage && (
                <MarkdownTextWrapSvg
                    textWrap={textWrap.percentage}
                    x={bounds.percentage.x}
                    y={bounds.percentage.y}
                    fillOpacity={0.9}
                />
            )}
            {textWrap.deaths && bounds.deaths && shouldShow.deaths && (
                <MarkdownTextWrapSvg
                    textWrap={textWrap.deaths}
                    x={bounds.deaths.x}
                    y={bounds.deaths.y}
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
    textWrap: PartialLabelKeyRecord<MarkdownTextWrap | TextWrapGroup>
    padding: number
}): PartialLabelKeyRecord<Bounds> {
    const titleBounds = new Bounds(
        contentBounds.x,
        contentBounds.y,
        textWrap.title.width,
        textWrap.title.height
    )
    const percentageBounds = new Bounds(
        contentBounds.x,
        contentBounds.y,
        textWrap.percentage.width,
        textWrap.percentage.height
    )
    const deathsBounds = textWrap.deaths
        ? new Bounds(
              contentBounds.x,
              titleBounds.bottom + padding,
              textWrap.deaths.width,
              textWrap.deaths.height
          )
        : undefined

    return {
        title: titleBounds,
        percentage: percentageBounds,
        deaths: deathsBounds,
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
        percentage: false,
        deaths: false,
    }

    shouldShow.title = contentBounds.encloses(textBounds.title)

    if (!shouldShow.title) {
        shouldShow.percentage = contentBounds.encloses(textBounds.percentage)
        return shouldShow
    }

    if (textBounds.deaths)
        shouldShow.deaths = contentBounds.encloses(textBounds.deaths)

    return shouldShow
}

function calculateOptimalFontSize({
    makeTextWrap,
    initialFontSize,
    availableWidth,
    availableHeight,
    minFontSize,
}: {
    makeTextWrap: (fontSize: number) => TextWrapGroup
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
