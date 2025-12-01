import * as d3 from "d3"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import { Bounds } from "@ourworldindata/utils"
import { formatCount, formatShare } from "./CausesOfDeathHelpers.js"
import { useCausesOfDeathChartContext } from "./CausesOfDeathContext"
import { TreeNode } from "./CausesOfDeathConstants.js"

type LabelKey = "title" | "percentage" | "description" | "perYear" | "perDay"

type LabelKeyRecord<V> = Record<LabelKey, V>
interface PartialLabelKeyRecord<V> {
    title: V
    percentage: V
    description?: V
    perYear?: V
    perDay?: V
}

export function CausesOfDeathTreemapTileLabels({
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
    const { isMobile } = useCausesOfDeathChartContext()

    const { value, share, variable, description } = node.data.data

    // Shouldn't happen
    if (value === undefined || share === undefined) return null

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

    // Build the lines: percentage first, then yearly and daily values
    const formattedPercentage = formatShare(share)
    const yearlyValue = formatCount(value)
    const dailyValue = formatCount(value / 365, { abbreviate: false })

    // Only the largest rectangle gets "died from" text
    const lowercaseVariable =
        variable.toUpperCase() === variable ? variable : variable.toLowerCase()
    const labelText = isLargestTile
        ? `died from ${lowercaseVariable}`
        : variable

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
            main: { text: formattedPercentage, bold: true },
            secondary: { text: labelText },
            newLine: isLargestTile ? "continue-line" : "avoid-wrap",
            textWrapProps: { maxWidth: availableWidth, fontSize, lineHeight },
        })

    const fontSize = calculateOptimalFontSize({
        makeTextWrap: makeLabelWrapForFontSize,
        initialFontSize: baseFontSize,
        minFontSize: isMobile ? 10 : 8,
        availableWidth,
        availableHeight,
    })

    const descriptionFontSize = fontSize * 0.8
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
        description: description
            ? new MarkdownTextWrap({
                  text: description,
                  maxWidth: availableWidth,
                  fontSize: descriptionFontSize,
                  lineHeight,
              })
            : undefined,
        perYear: showMetrics
            ? new MarkdownTextWrap({
                  text: `Per year: ${yearlyValue}`,
                  maxWidth: availableWidth,
                  fontSize: metricsFontSize,
                  lineHeight,
              })
            : undefined,
        perDay: showMetrics
            ? new MarkdownTextWrap({
                  text: `Per average day: ${dailyValue}`,
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
            {shouldShow.title &&
                textWrap.title.renderSVG(bounds.title.x, bounds.title.y, {
                    textProps: { fillOpacity: 0.9 },
                })}
            {shouldShow.percentage &&
                textWrap.percentage.renderSVG(
                    bounds.percentage.x,
                    bounds.percentage.y,
                    { textProps: { fillOpacity: 0.9 } }
                )}
            {textWrap.description &&
                bounds.description &&
                shouldShow.description &&
                textWrap.description.renderSVG(
                    bounds.description.x,
                    bounds.description.y,
                    { textProps: { fillOpacity: 0.7 } }
                )}
            {textWrap.perYear &&
                bounds.perYear &&
                shouldShow.perYear &&
                textWrap.perYear.renderSVG(bounds.perYear.x, bounds.perYear.y, {
                    textProps: { fillOpacity: 0.7 },
                })}
            {textWrap.perDay &&
                bounds.perDay &&
                shouldShow.perDay &&
                textWrap.perDay.renderSVG(bounds.perDay.x, bounds.perDay.y, {
                    textProps: { fillOpacity: 0.7 },
                })}
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
    const percentageBounds = new Bounds(
        contentBounds.x,
        contentBounds.y,
        textWrap.percentage.width,
        textWrap.percentage.height
    )
    const descriptionBounds = textWrap.description
        ? new Bounds(
              contentBounds.x,
              titleBounds.bottom + padding,
              textWrap.description.width,
              textWrap.description.height
          )
        : undefined
    const perYearBounds = textWrap.perYear
        ? new Bounds(
              contentBounds.x,
              (descriptionBounds
                  ? descriptionBounds.bottom
                  : titleBounds.bottom) + padding,
              textWrap.perYear.width,
              textWrap.perYear.height
          )
        : undefined
    const perDayBounds = textWrap.perDay
        ? new Bounds(
              contentBounds.x,
              perYearBounds ? perYearBounds.bottom + padding / 2 : 0,
              textWrap.perDay.width,
              textWrap.perDay.height
          )
        : undefined

    return {
        title: titleBounds,
        percentage: percentageBounds,
        description: descriptionBounds,
        perYear: perYearBounds,
        perDay: perDayBounds,
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
        description: false,
        perYear: false,
        perDay: false,
    }

    shouldShow.title = contentBounds.encloses(textBounds.title)

    if (!shouldShow.title) {
        shouldShow.percentage = contentBounds.encloses(textBounds.percentage)
        return shouldShow
    }

    if (textBounds.description)
        shouldShow.description = contentBounds.encloses(textBounds.description)

    // Show both per year and per day metrics together, or neither
    if (textBounds.perYear && textBounds.perDay) {
        const bothMetricsFit =
            contentBounds.encloses(textBounds.perYear) &&
            contentBounds.encloses(textBounds.perDay)
        shouldShow.perYear = bothMetricsFit
        shouldShow.perDay = bothMetricsFit
    }

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
