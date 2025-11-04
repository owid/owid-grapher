import { useMemo } from "react"
import { Bounds } from "@ourworldindata/utils"
import {
    DataRow,
    CauseOfDeathCategory,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TreeNode,
} from "./CausesOfDeathConstants"
import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import Arrow from "./Arrow"
import * as d3 from "d3"
import * as R from "remeda"

export function CausesOfDeathCategoryAnnotations({
    data,
    metadata,
    treeNodes,
    width,
    isNarrow,
    annotationHeight,
}: {
    data: DataRow[]
    metadata: MyCausesOfDeathMetadata
    treeNodes: TreeNode[]
    width: number
    isNarrow: boolean
    annotationHeight: number
}) {
    // Calculate totals for each top-level category
    const categoryTotals = useMemo(() => {
        return R.pipe(
            data,
            R.map((row) => ({
                category: metadata.categoryNameByVariableName.get(row.variable),
                value: row.value ?? 0,
            })),
            R.filter((item) => item.category !== undefined),
            R.groupBy((item) => item.category!),
            R.mapValues((items) => R.sumBy(items, (item) => item.value))
        )
    }, [data, metadata])

    // Find the largest and second largest categories
    const sortedCategories = R.pipe(
        Object.entries(categoryTotals),
        R.map(([category, total]) => ({
            category: category as CauseOfDeathCategory,
            total,
        })),
        R.sortBy((item) => -item.total)
    )

    const largestCategory = sortedCategories.at(0)
    const secondLargestCategory = sortedCategories.at(1)

    if (!largestCategory) return null

    // todo: only largest
    if (largestCategory.total === 0) return null

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0

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
    const largestCategoryLeaves = treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === largestCategory.category
    })

    // Find rectangles belonging to the second largest category
    const secondLargestCategoryLeaves = secondLargestCategory
        ? treeNodes.filter((leaf) => {
              const nodeData = leaf.data.data
              const category = nodeData.category
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

    // Check if labels would overlap with some padding
    // First label (left-aligned): occupies from (categoryBounds.minX + 50) to (categoryBounds.minX + 50 + firstLabelWidth)
    // Second label (right-aligned): occupies from (secondCategoryBounds.maxX - 55 - secondLabelWidth) to (secondCategoryBounds.maxX - 55)
    // They overlap if: firstLabelEnd + padding > secondLabelStart
    const firstLabelEnd = categoryBounds.minX + 50 + firstLabelWidth
    const secondLabelStart = secondCategoryBounds.maxX - 55 - secondLabelWidth
    const labelsOverlap =
        secondLargestCategory && firstLabelEnd + 40 > secondLabelStart
    return (
        <>
            {/* Annotation for largest category positioned above its rectangles */}
            {!isNarrow &&
                largestCategory.total > 0 &&
                largestCategoryLeaves.length > 0 &&
                largestCategory.total / numAllDeaths > 0.1 && (
                    <CategoryAnnotation
                        x={categoryBounds.minX + 50}
                        y={20}
                        percentage={largestPercentage}
                        categoryName={largestCategoryName}
                        category={largestCategory.category}
                        textAnchor="start"
                        arrowStart={[
                            categoryBounds.minX + 47,
                            20 - annotationFontSize / 2 + 2,
                        ]}
                        arrowEnd={[categoryBounds.minX + 11, annotationHeight]}
                        arrowStartHandleOffset={[-20, -5]}
                        arrowEndHandleOffset={[5, -20]}
                        fontSize={annotationFontSize}
                        fontWeight={annotationFontWeight}
                    />
                )}

            {/* Annotation for second largest category positioned at top right */}
            {!isNarrow &&
                secondLargestCategory &&
                secondLargestCategory.total > 0 &&
                secondLargestCategoryLeaves.length > 0 &&
                secondLargestCategory.total / numAllDeaths > 0.1 &&
                !labelsOverlap && (
                    <CategoryAnnotation
                        x={secondCategoryBounds.maxX - 55}
                        y={20}
                        percentage={secondLargestPercentage}
                        categoryName={secondLargestCategoryName}
                        category={secondLargestCategory.category}
                        textAnchor="end"
                        arrowStart={[
                            secondCategoryBounds.maxX - 52,
                            20 - annotationFontSize / 2 + 2,
                        ]}
                        arrowEnd={[
                            secondCategoryBounds.maxX - 11,
                            annotationHeight,
                        ]}
                        arrowStartHandleOffset={[20, -5]}
                        arrowEndHandleOffset={[-5, -20]}
                        fontSize={annotationFontSize}
                        fontWeight={annotationFontWeight}
                    />
                )}
        </>
    )
}

function CategoryAnnotation({
    x,
    y,
    percentage,
    categoryName,
    category,
    textAnchor,
    arrowStart,
    arrowEnd,
    arrowStartHandleOffset,
    arrowEndHandleOffset,
    fontSize,
    fontWeight,
}: {
    x: number
    y: number
    percentage: string
    categoryName: string
    category: CauseOfDeathCategory
    textAnchor: "start" | "end"
    arrowStart: [number, number]
    arrowEnd: [number, number]
    arrowStartHandleOffset: [number, number]
    arrowEndHandleOffset: [number, number]
    fontSize: number
    fontWeight: number
}) {
    return (
        <g>
            <text
                x={x}
                y={y}
                style={{
                    fontSize: `${fontSize}px`,
                    fill: "#5b5b5b",
                    fontWeight: fontWeight,
                    textAnchor: textAnchor,
                }}
            >
                <tspan fontWeight="700">{percentage}</tspan> died from{" "}
                <tspan
                    fill={CAUSE_OF_DEATH_CATEGORY_COLORS[category] || "#5b5b5b"}
                    fontWeight="700"
                >
                    {categoryName}
                </tspan>
            </text>
            <Arrow
                start={arrowStart}
                end={arrowEnd}
                startHandleOffset={arrowStartHandleOffset}
                endHandleOffset={arrowEndHandleOffset}
                color="#5b5b5b"
                width={1}
                opacity={0.7}
                headLength={6}
                headAngle={45}
            />
        </g>
    )
}

// Helper function to format percentages with significant figures
const formatPercentSigFig = (value: number): string => {
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
