import * as d3 from "d3"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import { Bounds } from "@ourworldindata/utils"

type LabelKey = "title" | "percentage" | "description" | "perYear" | "perDay"

type LabelKeyRecord<V> = Record<LabelKey, V>
interface PartialLabelKeyRecord<V> {
    title: V
    percentage: V
    description?: V
    perYear?: V
    perDay?: V
}

interface TreemapTileLabelsProps {
    // Rectangle dimensions and positioning
    width: number
    height: number
    color: string

    // Data for rendering
    variable: string
    value: number
    numAllDeaths: number
    description?: string
    isLargestTile: boolean

    // Layout configuration
    treemapWidth: number
    treemapHeight: number
    isNarrow: boolean

    // Debug mode
    debug?: boolean
}

export function CausesOfDeathTreemapTileLabels({
    width,
    height,
    color,
    variable,
    value,
    numAllDeaths,
    description,
    isLargestTile,
    treemapWidth,
    treemapHeight,
    isNarrow,
    debug = false,
}: TreemapTileLabelsProps) {
    const area = width * height

    const minFontSize = isNarrow
        ? Math.max(10, treemapWidth / 100)
        : Math.max(8, treemapWidth / 150) // Minimum font size scales with width
    const maxFontSize = isNarrow
        ? Math.min(20, treemapWidth / 20, treemapHeight / 25)
        : Math.min(24, treemapWidth / 30, treemapHeight / 20) // Maximum font size scales with dimensions

    // Calculate font size based on rectangle area using d3 scaling
    // Make font size range responsive to visualization dimensions
    const fontSizeScale = d3
        .scaleSqrt()
        .domain([0, (treemapWidth * treemapHeight) / 4]) // assume max meaningful area is 1/4 of total
        .range([minFontSize, maxFontSize])
        .clamp(true)
    const baseFontSize = Math.round(fontSizeScale(area))

    // Calculate adaptive padding based on rectangle dimensions
    const horizontalPaddingScale = d3
        .scaleSqrt()
        .domain([0, treemapWidth / 2]) // based on rectangle width
        .range([2, 6]) // horizontal padding range from 2px to 6px
        .clamp(true)
    const horizontalPadding = Math.round(horizontalPaddingScale(width))

    const verticalPaddingScale = d3
        .scaleSqrt()
        .domain([0, treemapHeight / 2]) // based on rectangle height
        .range([2, 6]) // vertical padding range from 2px to 6px
        .clamp(true)
    const verticalPadding = Math.round(verticalPaddingScale(height))

    // Build the lines: percentage first, then yearly and daily values
    const formattedPercentage = formatPercentSigFig(value / numAllDeaths)
    const yearlyValue = formatNumberLongText(value)
    const dailyValue = formatSigFigNoAbbrev(value / 365)

    // Only the largest rectangle gets "died from" text
    const labelText = isLargestTile
        ? `died from ${variable.toLowerCase()}`
        : variable

    const contentBounds = new Bounds(0, 0, width, height)
        .padLeft(horizontalPadding)
        .padRight(horizontalPadding / 2)
        .padTop(verticalPadding)
        .padBottom(verticalPadding / 2)

    const availableWidth = contentBounds.width
    const availableHeight = contentBounds.height

    const lineHeight = 1

    const makeLabelWrapForFontSize = (fontSize: number) =>
        MarkdownTextWrap.fromFragments({
            main: { text: formattedPercentage, bold: true },
            secondary: { text: labelText },
            newLine: isLargestTile ? "continue-line" : "avoid-wrap",
            textWrapProps: {
                maxWidth: availableWidth,
                fontSize,
                lineHeight,
            },
        })

    const fontSize = calculateOptimalFontSize({
        makeTextWrap: makeLabelWrapForFontSize,
        initialFontSize: baseFontSize,
        minFontSize: isNarrow ? 10 : 8,
        availableWidth,
        availableHeight,
    })

    const descriptionFontSize = fontSize * 0.8
    const metricsFontSize = fontSize * 0.6

    const showMetrics = metricsFontSize >= 10
    const padding = verticalPadding / 2

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

    const render = (shouldShow: LabelKeyRecord<boolean>, color: string) => (
        <g fill={color} style={{ pointerEvents: "none" }}>
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

    const shouldShowAll: LabelKeyRecord<boolean> = {
        title: true,
        percentage: true,
        description: true,
        perYear: true,
        perDay: true,
    }

    const textColor = isDarkColor(color) ? "white" : "#5b5b5b"

    return debug ? (
        <>
            {render(shouldShowAll, "red")}
            {render(shouldShow, textColor)}
        </>
    ) : (
        render(shouldShow, textColor)
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

function formatPercentSigFig(value: number): string {
    if (value === 0) return "0%"

    const percentage = value * 100
    const significantDigits = 2
    const magnitude = Math.floor(Math.log10(Math.abs(percentage)))
    const factor = Math.pow(10, magnitude - (significantDigits - 1))
    const rounded = Math.round(percentage / factor) * factor

    // Format with appropriate decimal places
    if (rounded >= 10) {
        return `${Math.round(rounded)}%`
    } else {
        return `${rounded.toFixed(1)}%`
    }
}

function formatNumberLongText(value: number): string {
    if (value === 0) return "0"

    if (value >= 1000000000) {
        const billions = value / 1000000000
        return `${billions.toFixed(1)} billion`
    } else if (value >= 1000000) {
        const millions = value / 1000000
        return `${millions.toFixed(1)} million`
    } else {
        return d3.format(",.0f")(value)
    }
}

function formatSigFigNoAbbrev(value: number): string {
    if (value === 0) return "0"

    const significantDigits = 3
    const magnitude = Math.floor(Math.log10(Math.abs(value)))
    const factor = Math.pow(10, magnitude - (significantDigits - 1))
    const rounded = Math.round(value / factor) * factor

    return d3.format(",.0f")(rounded)
}
