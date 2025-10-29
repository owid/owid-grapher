import { EntityName, Time } from "@ourworldindata/types"
import {
    CAUSE_OF_DEATH_CATEGORIES,
    CAUSE_OF_DEATH_CATEGORY_MAPPING,
    DataRow,
    CauseOfDeathCategory,
    CauseOfDeathIndicatorName,
    CAUSE_OF_DEATH_DESCRIPTIONS,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    COUNTRIES_WITH_DEFINITE_ARTICLE,
} from "./CausesOfDeathConstants"
import React, { useMemo, useState } from "react"
import * as d3 from "d3"
import { Bounds } from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { isDarkColor } from "@ourworldindata/grapher/src/color/ColorUtils"
import {
    Dropdown,
    BasicDropdownOption,
} from "@ourworldindata/grapher/src/controls/Dropdown"
import Arrow from "./Arrow"
import { Button, Link, Tooltip, TooltipTrigger } from "react-aria-components"
import useChartDimensions from "./useChartDimensions"

// @ts-expect-error - JavaScript module without type definitions
import { hybridSliceDiceSmartStack as _hybridSliceDiceSmartStack } from "./customTiling.js"

interface EnrichedDataItem {
    entityName: EntityName
    year: Time
    variable: string
    parentId?: string
    value: number | null
}

type TreeNode = d3.HierarchyRectangularNode<d3.HierarchyNode<EnrichedDataItem>>

export function CausesOfDeathComponent({
    data,
    entityName,
    year,
    tilingMethod,
    dimensionsConfig,
    debug = false,
}: {
    data: DataRow[]
    entityName: EntityName
    year: Time
    tilingMethod?: any
    dimensionsConfig?: {
        initialWidth?: number
        ratio?: number
        minHeight?: number
        maxHeight?: number
    }
    debug?: boolean
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>(
        {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
        },
        {
            initialWidth: dimensionsConfig?.initialWidth || 900,
            ratio: dimensionsConfig?.ratio || 3 / 2,
            minHeight: dimensionsConfig?.minHeight || 400,
            maxHeight: dimensionsConfig?.maxHeight || 800,
        }
    )
    const filteredData = useMemo(
        () =>
            data.filter(
                (row) => row.entityName === entityName && row.year === year
            ),
        [data, entityName, year]
    )

    const numAllDeaths = d3.sum(filteredData, (d) => d.value) || 0

    const enrichedData: EnrichedDataItem[] = [
        { entityName, year, variable: "All", value: null },
        ...CAUSE_OF_DEATH_CATEGORIES.map((category) => ({
            entityName,
            year,
            variable: category,
            parentId: "All",
            value: null,
        })),
        ...filteredData.map((row) => ({
            ...row,
            parentId:
                CAUSE_OF_DEATH_CATEGORY_MAPPING[
                    row.variable as CauseOfDeathIndicatorName
                ],
        })),
    ]

    const width = dimensions.width

    const isNarrow = width < 768 // same as small breakpoint

    const height = isNarrow ? 900 : dimensions.height
    const annotationHeight = isNarrow ? 0 : 30

    const stratifyFn = d3
        .stratify<EnrichedDataItem>()
        .id((d) => d.variable)
        .parentId((d) => d.parentId)

    const treeData = stratifyFn(enrichedData)

    const hierarchy = d3
        .hierarchy(treeData)
        .sum((d) => d.data.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(isNarrow ? d3.treemapSlice : (tilingMethod ?? d3.treemapSquarify))
        .size([width, height])
        .padding(1)
        .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])

    // Calculate totals for each high-level category
    const categoryTotals = useMemo(() => {
        const totals: Record<CauseOfDeathCategory, number> = {
            "Noncommunicable diseases": 0,
            "Infectious diseases": 0,
            "Maternal, neonatal, and nutritional disorders": 0,
            Injuries: 0,
        }

        filteredData.forEach((row) => {
            const category =
                CAUSE_OF_DEATH_CATEGORY_MAPPING[
                    row.variable as CauseOfDeathIndicatorName
                ]
            if (category && row.value) {
                totals[category] += row.value
            }
        })

        return totals
    }, [filteredData])

    // Find the largest and second largest categories
    const sortedCategories = Object.entries(categoryTotals)
        .map(([category, total]) => ({
            category: category as CauseOfDeathCategory,
            total,
        }))
        .sort((a, b) => b.total - a.total)

    const largestCategory = sortedCategories[0] || {
        category: "Noncommunicable diseases" as CauseOfDeathCategory,
        total: 0,
    }
    const secondLargestCategory = sortedCategories[1] || null

    const largestPercentage = formatPercentSigFig(
        largestCategory.total / numAllDeaths
    )
    const largestCategoryName = largestCategory.category.toLowerCase()

    const secondLargestPercentage = secondLargestCategory
        ? formatPercentSigFig(secondLargestCategory.total / numAllDeaths)
        : ""
    const secondLargestCategoryName =
        secondLargestCategory?.category.toLowerCase() || ""

    // Annotation styling constants - make responsive to visualization size
    const annotationFontSize = Math.min(18, Math.max(12, width / 50))
    const annotationFontWeight = 500

    // Find rectangles belonging to the largest category
    const largestCategoryLeaves = leaves.filter((leaf) => {
        const nodeData = leaf.data.data
        const category =
            CAUSE_OF_DEATH_CATEGORY_MAPPING[
                nodeData.variable as CauseOfDeathIndicatorName
            ]
        return category === largestCategory.category
    })

    // Find rectangles belonging to the second largest category
    const secondLargestCategoryLeaves = secondLargestCategory
        ? leaves.filter((leaf) => {
              const nodeData = leaf.data.data
              const category =
                  CAUSE_OF_DEATH_CATEGORY_MAPPING[
                      nodeData.variable as CauseOfDeathIndicatorName
                  ]
              return category === secondLargestCategory.category
          })
        : []

    // Find the bounding box of the largest category rectangles
    const categoryBounds = largestCategoryLeaves.reduce(
        (bounds, leaf) => ({
            minX: Math.min(bounds.minX, leaf.x0),
            minY: Math.min(bounds.minY, leaf.y0),
            maxX: Math.max(bounds.maxX, leaf.x1),
            maxY: Math.max(bounds.maxY, leaf.y1),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )

    // Check for overlap between first and second labels
    const firstLabelText = `${largestPercentage} died from ${largestCategoryName}`
    const secondLabelText = secondLargestCategory
        ? `${secondLargestPercentage} died from ${secondLargestCategoryName}`
        : ""

    // Calculate accurate text widths using Bounds.forText
    const firstLabelWidth = Bounds.forText(firstLabelText, {
        fontSize: annotationFontSize,
        fontWeight: annotationFontWeight,
    }).width
    const secondLabelWidth = Bounds.forText(secondLabelText, {
        fontSize: annotationFontSize,
        fontWeight: annotationFontWeight,
    }).width

    // Find the bounding box of the second largest category rectangles
    const secondCategoryBounds = secondLargestCategoryLeaves.reduce(
        (bounds, leaf) => ({
            minX: Math.min(bounds.minX, leaf.x0),
            minY: Math.min(bounds.minY, leaf.y0),
            maxX: Math.max(bounds.maxX, leaf.x1),
            maxY: Math.max(bounds.maxY, leaf.y1),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    )

    // Check if labels would overlap with some padding
    // First label (left-aligned): occupies from (categoryBounds.minX + 50) to (categoryBounds.minX + 50 + firstLabelWidth)
    // Second label (right-aligned): occupies from (secondCategoryBounds.maxX - 55 - secondLabelWidth) to (secondCategoryBounds.maxX - 55)
    // They overlap if: firstLabelEnd + padding > secondLabelStart
    const firstLabelEnd = categoryBounds.minX + 50 + firstLabelWidth
    const secondLabelStart = secondCategoryBounds.maxX - 55 - secondLabelWidth
    const labelsOverlap =
        secondLargestCategory && firstLabelEnd + 40 > secondLabelStart

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <svg
                viewBox={`0 0 ${width} ${height + annotationHeight}`}
                width={width}
                height={height + annotationHeight}
                style={{
                    maxWidth: "100%",
                    height: "auto",
                    font: "10px sans-serif",
                }}
                aria-label="Treemap"
                role="img"
            >
                {leaves.map((d) => {
                    const nodeValue = d.value || 0
                    const nodeData = d.data.data // First .data is from HierarchyRectangularNode, second is from HierarchyNode

                    // Only render leaf nodes that have actual data (not intermediate category nodes)
                    if (nodeValue === 0 || nodeData.value === null) {
                        return null
                    }

                    const idBase = slugify(nodeData.variable)
                    const leafId = `leaf-${idBase}`
                    const _clipId = `clip-${idBase}`
                    const parentKey = nodeData.parentId || ""
                    const widthRect = d.x1 - d.x0
                    const heightRect = d.y1 - d.y0

                    // Calculate font size based on rectangle area using d3 scaling
                    // Make font size range responsive to visualization dimensions
                    const rectArea = widthRect * heightRect
                    const minFontSize = isNarrow
                        ? Math.max(10, width / 100)
                        : Math.max(8, width / 150) // Minimum font size scales with width
                    const maxFontSize = isNarrow
                        ? Math.min(20, width / 20, height / 25)
                        : Math.min(24, width / 30, height / 20) // Maximum font size scales with dimensions
                    const fontSizeScale = d3
                        .scaleSqrt()
                        .domain([0, (width * height) / 4]) // assume max meaningful area is 1/4 of total
                        .range([minFontSize, maxFontSize])
                        .clamp(true)
                    let baseFontSize = Math.round(fontSizeScale(rectArea))

                    // Define minimum font size based on screen width
                    const absoluteMinFontSize = isNarrow ? 10 : 8

                    // Calculate adaptive padding based on rectangle dimensions
                    const horizontalPaddingScale = d3
                        .scaleSqrt()
                        .domain([0, width / 2]) // based on rectangle width
                        .range([2, 6]) // horizontal padding range from 2px to 6px
                        .clamp(true)
                    const horizontalPadding = Math.round(
                        horizontalPaddingScale(widthRect)
                    )

                    const verticalPaddingScale = d3
                        .scaleSqrt()
                        .domain([0, height / 2]) // based on rectangle height
                        .range([2, 6]) // vertical padding range from 2px to 6px
                        .clamp(true)
                    const verticalPadding = Math.round(
                        verticalPaddingScale(heightRect)
                    )

                    // Build the lines: percentage first, then yearly and daily values
                    const percentage = formatPercentSigFig(
                        nodeValue / numAllDeaths
                    )
                    const yearlyValue = formatNumberLongText(nodeValue)
                    const dailyValue = formatSigFigNoAbbrev(nodeValue / 365)

                    // Extract clean cause name by removing "total number of deaths from" prefix
                    const cleanCauseName = nodeData.variable
                        .replace(/^total number of deaths from\s+/i, "")
                        .replace(/^deaths from\s+/i, "")
                        .replace(/^number of deaths from\s+/i, "")

                    // Capitalize only the first letter for display, preserving original casing
                    const capitalizedCauseName =
                        cleanCauseName.charAt(0).toUpperCase() +
                        cleanCauseName.slice(1)

                    // Get description if available
                    const description =
                        CAUSE_OF_DEATH_DESCRIPTIONS[
                            nodeData.variable as CauseOfDeathIndicatorName
                        ]

                    // Only the largest rectangle gets "died from" text
                    const isLargestRect = leaves[0] === d
                    const labelText = isLargestRect
                        ? `died from ${cleanCauseName}`
                        : capitalizedCauseName

                    // Dynamic font scaling algorithm
                    const availableWidth =
                        widthRect - horizontalPadding - horizontalPadding / 2 // full padding on left, half on right
                    const availableHeight =
                        heightRect - verticalPadding - verticalPadding / 2 // full padding on top, half on bottom

                    let finalFontSize = baseFontSize
                    let textFits = false
                    const maxIterations = 20 // Prevent infinite loops
                    let iterations = 0

                    while (
                        !textFits &&
                        finalFontSize > absoluteMinFontSize &&
                        iterations < maxIterations
                    ) {
                        // Test main label with current font size
                        const testMainLabelWrap =
                            MarkdownTextWrap.fromFragments({
                                main: { text: percentage, bold: true },
                                secondary: { text: labelText },
                                newLine: isLargestRect
                                    ? "continue-line"
                                    : "avoid-wrap",
                                textWrapProps: {
                                    maxWidth: availableWidth,
                                    fontSize: finalFontSize,
                                    lineHeight: 1,
                                },
                            })

                        // Test description if it exists
                        const descriptionFontSize = Math.max(
                            finalFontSize * 0.8,
                            absoluteMinFontSize
                        )
                        const testDescriptionWrap = description
                            ? new MarkdownTextWrap({
                                  text: description,
                                  maxWidth: availableWidth,
                                  fontSize: descriptionFontSize,
                                  lineHeight: 1,
                              })
                            : null

                        // Calculate total height needed
                        let totalHeightNeeded = testMainLabelWrap.height
                        if (description && testDescriptionWrap) {
                            totalHeightNeeded +=
                                testDescriptionWrap.height + verticalPadding / 2
                        }

                        // Check if everything fits
                        const mainLabelFitsWidth =
                            testMainLabelWrap.width <= availableWidth
                        const mainLabelFitsHeight =
                            testMainLabelWrap.height <= availableHeight
                        const descriptionFitsWidth =
                            !description ||
                            testDescriptionWrap!.width <= availableWidth
                        const totalFitsHeight =
                            totalHeightNeeded <= availableHeight

                        textFits =
                            mainLabelFitsWidth &&
                            mainLabelFitsHeight &&
                            descriptionFitsWidth &&
                            totalFitsHeight

                        if (!textFits) {
                            // Reduce font size by 1px and try again
                            finalFontSize = Math.max(
                                finalFontSize - 1,
                                absoluteMinFontSize
                            )
                        }

                        iterations++
                    }

                    // Create text wrapping using the dynamically scaled font size
                    const mainLabelWrap = MarkdownTextWrap.fromFragments({
                        main: { text: percentage, bold: true },
                        secondary: { text: labelText },
                        newLine: isLargestRect ? "continue-line" : "avoid-wrap",
                        textWrapProps: {
                            maxWidth: availableWidth,
                            fontSize: finalFontSize,
                            lineHeight: 1,
                        },
                    })

                    // Create percentage-only text wrap for fallback cases
                    const percentageOnlyWrap = new MarkdownTextWrap({
                        text: percentage,
                        maxWidth: availableWidth,
                        fontSize: finalFontSize,
                        fontWeight: 700,
                        lineHeight: 1,
                    })
                    // Create description text wrap if description exists (using scaled font size)
                    const descriptionWrap = description
                        ? new MarkdownTextWrap({
                              text: description,
                              maxWidth: availableWidth,
                              fontSize: Math.max(
                                  finalFontSize * 0.8,
                                  absoluteMinFontSize
                              ),
                              lineHeight: 1,
                          })
                        : null

                    const metricFontSize = Math.max(
                        finalFontSize * 0.6,
                        absoluteMinFontSize
                    )
                    const showMetrics = metricFontSize >= 10

                    const yearlyWrap = new MarkdownTextWrap({
                        text: `Per year: ${yearlyValue}`,
                        maxWidth: availableWidth,
                        fontSize: metricFontSize,
                        lineHeight: 1.1,
                    })

                    const dailyWrap = new MarkdownTextWrap({
                        text: `Per average day: ${dailyValue}`,
                        maxWidth: availableWidth,
                        fontSize: metricFontSize,
                        lineHeight: 1.1,
                    })

                    // Check main label fit
                    const mainLabelFitsWidth =
                        mainLabelWrap.width <= availableWidth
                    const mainLabelFitsHeight =
                        mainLabelWrap.height <= availableHeight
                    const mainLabelFits =
                        mainLabelFitsWidth && mainLabelFitsHeight

                    // Check description fit (only if main label fits)
                    const descriptionFitsWidth =
                        !description || descriptionWrap!.width <= availableWidth
                    const descriptionHeightWithMain =
                        mainLabelWrap.height +
                        (description
                            ? descriptionWrap!.height + verticalPadding / 2
                            : 0)
                    const descriptionFitsHeight =
                        !description ||
                        descriptionHeightWithMain <= availableHeight
                    const descriptionFits =
                        descriptionFitsWidth && descriptionFitsHeight

                    // Check metrics fit (only if main label and optionally description fit)
                    const yearlyFitsWidth =
                        !showMetrics || yearlyWrap.width <= availableWidth
                    const dailyFitsWidth =
                        !showMetrics || dailyWrap.width <= availableWidth
                    const metricsWidthFits = yearlyFitsWidth && dailyFitsWidth

                    const heightWithMainAndDesc = descriptionFits
                        ? descriptionHeightWithMain
                        : mainLabelWrap.height
                    const metricsHeightWithRest =
                        heightWithMainAndDesc +
                        (showMetrics
                            ? yearlyWrap.height +
                              dailyWrap.height +
                              verticalPadding
                            : 0)
                    const metricsFitsHeight =
                        !showMetrics || metricsHeightWithRest <= availableHeight
                    const metricsFits = metricsWidthFits && metricsFitsHeight

                    // Check if percentage-only text fits (fallback option)
                    const percentageOnlyHeightFits =
                        percentageOnlyWrap.height <= availableHeight
                    const percentageOnlyWidthFits =
                        percentageOnlyWrap.width <= availableWidth
                    const percentageOnlyFits =
                        percentageOnlyHeightFits && percentageOnlyWidthFits

                    // Commented out font scaling code
                    // const maxTextWidth = Math.max(
                    //     ...lines.map(
                    //         (line) =>
                    //             Bounds.forText(line, { fontSize: baseFontSize })
                    //                 .width
                    //     )
                    // )
                    // if (maxTextWidth > availableWidth) {
                    //     const scaleFactor = availableWidth / maxTextWidth
                    //     baseFontSize = Math.max(
                    //         8,
                    //         Math.round(baseFontSize * scaleFactor)
                    //     )
                    // }

                    const color =
                        CAUSE_OF_DEATH_CATEGORY_COLORS[
                            parentKey as CauseOfDeathCategory
                        ] || "#cccccc"

                    return (
                        <g
                            key={idBase}
                            transform={`translate(${d.x0},${d.y0 + annotationHeight})`}
                        >
                            {/* Colored rect */}
                            <rect
                                id={leafId}
                                fill={color}
                                fillOpacity={0.9}
                                width={widthRect}
                                height={heightRect}
                                rx={2}
                            />

                            {/* Debug mode: Show hidden labels in red (render first so actual labels overwrite) */}
                            {debug && (
                                <>
                                    {/* Debug mode: Show hidden labels in red */}
                                    {!mainLabelFits && (
                                        <g fill="red" fillOpacity={0.8}>
                                            {mainLabelWrap.renderSVG(
                                                horizontalPadding,
                                                verticalPadding
                                            )}
                                        </g>
                                    )}

                                    {/* Debug mode: Show hidden description in red */}
                                    {mainLabelFits &&
                                        description &&
                                        descriptionWrap &&
                                        !descriptionFits && (
                                            <g fill="red" fillOpacity={0.8}>
                                                {descriptionWrap.renderSVG(
                                                    horizontalPadding,
                                                    verticalPadding +
                                                        mainLabelWrap.height +
                                                        verticalPadding / 2
                                                )}
                                            </g>
                                        )}

                                    {/* Debug mode: Show hidden metrics in red */}
                                    {mainLabelFits &&
                                        showMetrics &&
                                        !metricsFits && (
                                            <>
                                                <g fill="red" fillOpacity={0.8}>
                                                    {yearlyWrap.renderSVG(
                                                        horizontalPadding,
                                                        verticalPadding +
                                                            mainLabelWrap.height +
                                                            (descriptionFits &&
                                                            description
                                                                ? descriptionWrap!
                                                                      .height +
                                                                  verticalPadding /
                                                                      2
                                                                : 0) +
                                                            verticalPadding / 2
                                                    )}
                                                </g>
                                                <g fill="red" fillOpacity={0.8}>
                                                    {dailyWrap.renderSVG(
                                                        horizontalPadding,
                                                        verticalPadding +
                                                            mainLabelWrap.height +
                                                            (descriptionFits &&
                                                            description
                                                                ? descriptionWrap!
                                                                      .height +
                                                                  verticalPadding /
                                                                      2
                                                                : 0) +
                                                            yearlyWrap.height +
                                                            verticalPadding / 2
                                                    )}
                                                </g>
                                            </>
                                        )}
                                </>
                            )}

                            {/* Granular label rendering - show parts that fit */}
                            <g fill={isDarkColor(color) ? "white" : "#5b5b5b"}>
                                {mainLabelFits ? (
                                    <>
                                        {/* Main label with percentage */}
                                        <g fillOpacity={0.9}>
                                            {mainLabelWrap.renderSVG(
                                                horizontalPadding,
                                                verticalPadding
                                            )}
                                        </g>

                                        {/* Description - only show if it fits */}
                                        {description &&
                                            descriptionWrap &&
                                            descriptionFits && (
                                                <g fillOpacity={0.7}>
                                                    {descriptionWrap.renderSVG(
                                                        horizontalPadding,
                                                        verticalPadding +
                                                            mainLabelWrap.height +
                                                            verticalPadding / 2
                                                    )}
                                                </g>
                                            )}

                                        {/* Per year metric - only show if metrics fit */}
                                        {showMetrics && metricsFits && (
                                            <g fillOpacity={0.7}>
                                                {yearlyWrap.renderSVG(
                                                    horizontalPadding,
                                                    verticalPadding +
                                                        mainLabelWrap.height +
                                                        (descriptionFits &&
                                                        description
                                                            ? descriptionWrap!
                                                                  .height +
                                                              verticalPadding /
                                                                  2
                                                            : 0) +
                                                        verticalPadding / 2
                                                )}
                                            </g>
                                        )}

                                        {/* Per average day metric - only show if metrics fit */}
                                        {showMetrics && metricsFits && (
                                            <g fillOpacity={0.7}>
                                                {dailyWrap.renderSVG(
                                                    horizontalPadding,
                                                    verticalPadding +
                                                        mainLabelWrap.height +
                                                        (descriptionFits &&
                                                        description
                                                            ? descriptionWrap!
                                                                  .height +
                                                              verticalPadding /
                                                                  2
                                                            : 0) +
                                                        yearlyWrap.height +
                                                        verticalPadding / 2
                                                )}
                                            </g>
                                        )}
                                    </>
                                ) : percentageOnlyFits ? (
                                    /* Show only percentage if main label doesn't fit but percentage does */
                                    percentageOnlyWrap.renderSVG(
                                        horizontalPadding,
                                        verticalPadding
                                    )
                                ) : null}
                            </g>
                        </g>
                    )
                })}

                {/* Debug mode: Show hidden second largest category annotation in red (render first) */}
                {debug &&
                    !isNarrow &&
                    secondLargestCategory &&
                    secondLargestCategory.total > 0 &&
                    secondLargestCategoryLeaves.length > 0 &&
                    secondLargestCategory.total / numAllDeaths > 0.1 &&
                    labelsOverlap && (
                        <g>
                            <text
                                x={secondCategoryBounds.maxX - 55}
                                y={20}
                                style={{
                                    fontSize: `${annotationFontSize}px`,
                                    fill: "red",
                                    fontWeight: annotationFontWeight,
                                    textAnchor: "end",
                                    opacity: 0.8,
                                }}
                            >
                                <tspan fontWeight="700">
                                    {secondLargestPercentage}
                                </tspan>{" "}
                                died from{" "}
                                <tspan fill="red" fontWeight="700">
                                    {secondLargestCategoryName}
                                </tspan>
                            </text>
                            <Arrow
                                start={[
                                    secondCategoryBounds.maxX - 52,
                                    20 - annotationFontSize / 2 + 2,
                                ]}
                                end={[
                                    secondCategoryBounds.maxX - 11,
                                    annotationHeight,
                                ]}
                                startHandleOffset={[20, -5]}
                                endHandleOffset={[-5, -20]}
                                color="red"
                                width={1}
                                opacity={0.8}
                                headLength={6}
                                headAngle={45}
                            />
                        </g>
                    )}

                {/* Annotation for largest category positioned above its rectangles */}
                {!isNarrow &&
                    largestCategory.total > 0 &&
                    largestCategoryLeaves.length > 0 &&
                    largestCategory.total / numAllDeaths > 0.1 && (
                        <g>
                            <text
                                x={categoryBounds.minX + 50}
                                y={20}
                                style={{
                                    fontSize: `${annotationFontSize}px`,
                                    fill: "#5b5b5b",
                                    fontWeight: annotationFontWeight,
                                    textAnchor: "start",
                                }}
                            >
                                <tspan fontWeight="700">
                                    {largestPercentage}
                                </tspan>{" "}
                                died from{" "}
                                <tspan
                                    fill={
                                        CAUSE_OF_DEATH_CATEGORY_COLORS[
                                            largestCategory.category
                                        ] || "#5b5b5b"
                                    }
                                    fontWeight="700"
                                >
                                    {largestCategoryName}
                                </tspan>
                            </text>
                            <Arrow
                                start={[
                                    categoryBounds.minX + 47,
                                    20 - annotationFontSize / 2 + 2,
                                ]}
                                end={[
                                    categoryBounds.minX + 11,
                                    annotationHeight,
                                ]}
                                startHandleOffset={[-20, -5]}
                                endHandleOffset={[5, -20]}
                                color="#5b5b5b"
                                width={1}
                                opacity={0.7}
                                headLength={6}
                                headAngle={45}
                            />
                        </g>
                    )}

                {/* Annotation for second largest category positioned at top right */}
                {!isNarrow &&
                    secondLargestCategory &&
                    secondLargestCategory.total > 0 &&
                    secondLargestCategoryLeaves.length > 0 &&
                    secondLargestCategory.total / numAllDeaths > 0.1 &&
                    !labelsOverlap && (
                        <g>
                            <text
                                x={secondCategoryBounds.maxX - 55}
                                y={20}
                                style={{
                                    fontSize: `${annotationFontSize}px`,
                                    fill: "#5b5b5b",
                                    fontWeight: annotationFontWeight,
                                    textAnchor: "end",
                                }}
                            >
                                <tspan fontWeight="700">
                                    {secondLargestPercentage}
                                </tspan>{" "}
                                died from{" "}
                                <tspan
                                    fill={
                                        CAUSE_OF_DEATH_CATEGORY_COLORS[
                                            secondLargestCategory.category
                                        ] || "#5b5b5b"
                                    }
                                    fontWeight="700"
                                >
                                    {secondLargestCategoryName}
                                </tspan>
                            </text>
                            <Arrow
                                start={[
                                    secondCategoryBounds.maxX - 52,
                                    20 - annotationFontSize / 2 + 2,
                                ]}
                                end={[
                                    secondCategoryBounds.maxX - 11,
                                    annotationHeight,
                                ]}
                                startHandleOffset={[20, -5]}
                                endHandleOffset={[-5, -20]}
                                color="#5b5b5b"
                                width={1}
                                opacity={0.7}
                                headLength={6}
                                headAngle={45}
                            />
                        </g>
                    )}
            </svg>
            <div className="causes-of-death-source">
                <span>
                    <b>Data source:</b> IHME, Global Burden of Disease (2024)
                </span>
                <TooltipTrigger>
                    <Link
                        className="cc-by-button"
                        href="https://creativecommons.org/licenses/by/4.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        CC BY
                    </Link>
                    <Tooltip className="cc-by-tooltip">
                        Our World in Data charts are licensed under Creative
                        Commons; you are free to use, share, and adapt this
                        material. Click through to the CC BY page for more
                        information. Please bear in mind that the underlying
                        source data for all our charts might be subject to
                        different license terms from third-party authors.
                    </Tooltip>
                </TooltipTrigger>
            </div>
        </div>
    )
}

// New component for single country treemap with country selector
export function CausesOfDeathCountrySelector({
    data,
    year,
    tilingMethod = d3.treemapSquarify,
    debug = false,
}: {
    data: DataRow[]
    year: Time
    tilingMethod?: any
    debug?: boolean
}) {
    // Get unique countries from the data
    const countries = useMemo(() => {
        const uniqueCountries = Array.from(
            new Set(data.map((row) => row.entityName))
        )
            .sort()
            .map((country) => ({
                value: country,
                label: country,
            }))
        return uniqueCountries
    }, [data])

    const [selectedCountry, setSelectedCountry] =
        useState<BasicDropdownOption | null>(
            countries.find((country) => country.value === "World") ||
                (countries.length > 0 ? countries[0] : null)
        )

    // Calculate total deaths for selected country and year
    const totalDeaths = useMemo(() => {
        if (!selectedCountry) return 0
        const countryData = data.filter(
            (row) =>
                row.entityName === selectedCountry.value && row.year === year
        )
        return d3.sum(countryData, (d) => d.value) || 0
    }, [data, selectedCountry, year])

    // Format total deaths number
    const formattedTotalDeaths = useMemo(() => {
        return formatNumberLongText(totalDeaths)
    }, [totalDeaths])

    const handleCountryChange = (option: BasicDropdownOption | null) => {
        setSelectedCountry(option)
    }

    return (
        <div className="causes-of-death-country-selector">
            <img
                src="/owid-logo.svg"
                alt="Our World in Data logo"
                className="owid-logo-corner"
                width={52}
                height={29}
            />
            <div className="country-selector-section">
                <h3>
                    What do people die from?{" "}
                    <span style={{ color: "#858585" }}>
                        Causes of death{" "}
                        {selectedCountry?.label === "World"
                            ? "globally"
                            : `in ${formatCountryName(String(selectedCountry?.label || ""))}`}{" "}
                        in {year}
                    </span>
                </h3>
                <p className="causes-of-death-subtitle">
                    The size of the entire visualization represents the total
                    number of deaths in{" "}
                    {formatCountryName(String(selectedCountry?.label || ""))} in{" "}
                    {year}: {formattedTotalDeaths}. Each rectangle within is
                    proportional to the share of deaths due to a particular
                    cause.
                </p>

                <div style={{ marginBottom: "20px", maxWidth: "300px" }}>
                    <Dropdown
                        options={countries}
                        value={selectedCountry}
                        onChange={handleCountryChange}
                        placeholder="Select a region..."
                        isSearchable={true}
                        isClearable={false}
                        aria-label="Select region"
                        renderTriggerValue={renderRegionTriggerValue}
                    />
                </div>
            </div>

            {selectedCountry && (
                <div className="single-treemap-section">
                    <CausesOfDeathComponent
                        data={data}
                        entityName={selectedCountry.value as EntityName}
                        year={year}
                        dimensionsConfig={{
                            initialWidth: 900,
                            ratio: 3 / 2,
                            minHeight: 400,
                            maxHeight: 800,
                        }}
                        tilingMethod={tilingMethod}
                        debug={debug}
                    />
                </div>
            )}
        </div>
    )
}

function slugify(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]+/g, "-")
}

function _formatSigFig(value: number): string {
    return d3.format(".2s")(value)
}

function formatSigFigNoAbbrev(value: number): string {
    if (value === 0) return "0"

    const significantDigits = 3
    const magnitude = Math.floor(Math.log10(Math.abs(value)))
    const factor = Math.pow(10, magnitude - (significantDigits - 1))
    const rounded = Math.round(value / factor) * factor

    return d3.format(",.0f")(rounded)
}

function _formatPercent(value: number): string {
    return d3.format(".0%")(value)
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

function _format(value: number): string {
    return d3.format(",~")(value)
}

function formatNumberLongText(value: number): string {
    if (value === 0) return "0"

    if (value >= 1000000000) {
        const billions = value / 1000000000
        return `${billions.toFixed(1)} billion`
    } else if (value >= 1000000) {
        const millions = value / 1000000
        return `${millions.toFixed(1)} million`
    } else if (value >= 1000) {
        const thousands = value / 1000
        return `${thousands.toFixed(0)} thousand`
    } else {
        return value.toString()
    }
}

function renderRegionTriggerValue(
    option: BasicDropdownOption | null
): React.ReactNode | undefined {
    if (!option) return undefined
    return (
        <>
            <span className="label">Region: </span>
            {option.label}
        </>
    )
}

function formatCountryName(countryName: string): string {
    if (COUNTRIES_WITH_DEFINITE_ARTICLE.includes(countryName)) {
        return `the ${countryName}`
    }
    return countryName
}
