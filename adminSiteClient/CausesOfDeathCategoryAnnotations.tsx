import { useMemo } from "react"
import { Bounds } from "@ourworldindata/utils"
import {
    DataRow,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TreeNode,
} from "./CausesOfDeathConstants"
import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import Arrow from "./Arrow"
import * as d3 from "d3"
import * as R from "remeda"
import { MarkdownTextWrap } from "@ourworldindata/components"

export function CausesOfDeathCategoryAnnotations({
    data,
    metadata,
    treeNodes,
    width,
    annotationHeight,
    debug,
}: {
    data: DataRow[]
    metadata: MyCausesOfDeathMetadata
    treeNodes: TreeNode[]
    width: number
    annotationHeight: number
    debug: boolean
}) {
    // Calculate deaths per category and sort by totals
    const sortedCategories = useMemo(() => {
        return R.pipe(
            data,
            R.map((row) => ({
                name: metadata.categoryNameByVariableName.get(row.variable),
                total: row.value ?? 0,
            })),
            R.filter((category) => category.name !== undefined),
            R.groupBy((category) => category.name!),
            R.mapValues((categories) =>
                R.sumBy(categories, (category) => category.total)
            ),
            Object.entries,
            R.map(([name, total]) => ({ name, total })),
            R.sortBy((category) => -category.total)
        )
    }, [data, metadata])

    const candidates = sortedCategories.slice(0, 2)

    // Don't render anything if there are no candidates
    if (candidates.length === 0) return null

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    const formattedPercentages = candidates.map((c) =>
        formatPercentSigFig(c.total / numAllDeaths)
    )

    const fontSize = Math.min(18, Math.max(12, width / 50))
    const fontWeight = 500
    const arrowWidth = 50

    const textWidths = candidates.map((_, i) => {
        const text = `**${formattedPercentages[i]}** died from **${candidates[i].name.toLowerCase()}**`
        return new MarkdownTextWrap({
            text,
            fontSize,
            fontWeight,
        }).width
    })

    const boundsForLargestCategory = getBoundsForLargestCategory({
        treeNodes,
        categoryName: candidates[0].name,
        annotationHeight,
    })
    const { bounds: boundsForSecondLargestCategory, anchor } =
        getBoundsForSecondLargestCategory({
            treeNodes,
            categoryName: candidates[1].name,
            annotationHeight,
            leftBound:
                boundsForLargestCategory.left + arrowWidth + textWidths[0] + 40,
        })
    const bounds = [boundsForLargestCategory, boundsForSecondLargestCategory]

    // Check if the second annotation fits within its container
    const availableWidthForSecondLabel = bounds[1].width - arrowWidth
    const secondAnnotationFits = availableWidthForSecondLabel >= textWidths[1]

    const getColor = (categoryName: string) =>
        CAUSE_OF_DEATH_CATEGORY_COLORS[categoryName] || "#5b5b5b"

    return (
        <g>
            <CategoryAnnotation
                bounds={bounds[0]}
                categoryName={candidates[0].name.toLowerCase()}
                categoryColor={getColor(candidates[0].name)}
                formattedPercentage={formattedPercentages[0]}
                anchor="start"
                fontSize={fontSize}
                fontWeight={fontWeight}
                arrowWidth={arrowWidth}
            />

            {debug && (
                <CategoryAnnotation
                    bounds={bounds[1]}
                    categoryName={candidates[1].name.toLowerCase()}
                    categoryColor={getColor(candidates[1].name)}
                    formattedPercentage={formattedPercentages[1]}
                    anchor={anchor}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    arrowWidth={arrowWidth}
                    color="red"
                />
            )}

            {secondAnnotationFits && (
                <CategoryAnnotation
                    bounds={bounds[1]}
                    categoryName={candidates[1].name.toLowerCase()}
                    categoryColor={getColor(candidates[1].name)}
                    formattedPercentage={formattedPercentages[1]}
                    anchor={anchor}
                    fontSize={fontSize}
                    fontWeight={fontWeight}
                    arrowWidth={arrowWidth}
                />
            )}
        </g>
    )
}

function CategoryAnnotation({
    bounds,
    categoryName,
    categoryColor,
    formattedPercentage,
    anchor,
    fontSize,
    fontWeight,
    color = "#5b5b5b",
    arrowWidth = 50,
}: {
    bounds: Bounds
    categoryColor: string
    categoryName: string
    formattedPercentage: string
    anchor: "start" | "end" // anchor the text at the start of the end of the bounds
    fontSize: number
    fontWeight: number
    color?: string
    arrowWidth?: number
}) {
    const isEndAnchored = anchor === "end"

    const x = isEndAnchored
        ? bounds.right - arrowWidth
        : bounds.left + arrowWidth
    const y = bounds.bottom - 12 // space between annotation and treemap

    const textStyle = {
        fontSize,
        fontWeight,
        fill: "#5b5b5b",
        textAnchor: anchor,
    }

    const arrowStart: [number, number] = [
        x + (isEndAnchored ? 3 : -3),
        y - fontSize / 2,
    ]
    const arrowEnd: [number, number] = [
        isEndAnchored ? bounds.right - 11 : bounds.left + 11,
        bounds.bottom - 3,
    ]

    const arrowStartHandleOffset: [number, number] = isEndAnchored
        ? [20, -5]
        : [-20, -5]
    const arrowEndHandleOffset: [number, number] = isEndAnchored
        ? [-5, -20]
        : [5, -20]

    return (
        <g>
            <text x={x} y={y} style={textStyle}>
                <tspan fontWeight="700">{formattedPercentage}</tspan> died from{" "}
                <tspan fill={categoryColor} fontWeight="700">
                    {categoryName}
                </tspan>
            </text>
            <Arrow
                start={arrowStart}
                end={arrowEnd}
                startHandleOffset={arrowStartHandleOffset}
                endHandleOffset={arrowEndHandleOffset}
                color={color}
                width={1}
                opacity={0.7}
                headLength={6}
                headAngle={45}
            />
        </g>
    )
}

function getBoundsForLargestCategory({
    treeNodes,
    categoryName,
    annotationHeight,
}: {
    treeNodes: TreeNode[]
    categoryName: string
    annotationHeight: number
}) {
    const categoryNodes = treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === categoryName
    })

    const x0 = minBy(categoryNodes, (leaf) => leaf.x0)
    const y0 = minBy(categoryNodes, (leaf) => leaf.y0)
    const x1 = maxBy(categoryNodes, (leaf) => leaf.x1)

    return new Bounds(
        x0,
        y0,
        // TODO: assumes the second category is to its right
        x1 - x0,
        annotationHeight
    )
}

function getBoundsForSecondLargestCategory({
    treeNodes,
    categoryName,
    annotationHeight,
    leftBound,
}: {
    treeNodes: TreeNode[]
    categoryName: string
    annotationHeight: number
    leftBound: number
}): { bounds: Bounds; anchor: "start" | "end" } {
    const categoryNodes = treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === categoryName
    })

    const x0 = minBy(categoryNodes, (leaf) => leaf.x0)
    const y0 = minBy(categoryNodes, (leaf) => leaf.y0)
    const x1 = maxBy(categoryNodes, (leaf) => leaf.x1)

    const treemapRight = maxBy(treeNodes, (leaf) => leaf.x1)

    const initialBounds = new Bounds(
        leftBound,
        y0,
        treemapRight - leftBound,
        annotationHeight
    )
    const leftAnchoredBounds = initialBounds.padLeft(x0 - leftBound)
    const rightAnchoredBounds = initialBounds.padRight(treemapRight - x1)

    const anchor =
        rightAnchoredBounds.width >= leftAnchoredBounds.width ? "end" : "start"
    const bounds = anchor === "end" ? rightAnchoredBounds : leftAnchoredBounds

    return { anchor, bounds }
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

const minBy = <T,>(array: T[], selector: (item: T) => number): number => {
    return Math.min(...array.map(selector))
}

const maxBy = <T,>(array: T[], selector: (item: T) => number): number => {
    return Math.max(...array.map(selector))
}
