import { useMemo } from "react"
import { Bounds, PartialBy } from "@ourworldindata/utils"
import {
    DataRow,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TreeNode,
} from "./CausesOfDeathConstants"
import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import Arrow from "./Arrow"
import * as d3 from "d3"
import * as R from "remeda"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { getDropIndexes } from "@ourworldindata/core-table"
import { match } from "ts-pattern"

interface AnnotationCandidate {
    name: string
    total: number
    edge: "top" | "bottom"
    bounds: { y: number; x0: number; x1: number }
}

export function CausesOfDeathCategoryAnnotations({
    data,
    metadata,
    treeNodes,
    width,
    annotationHeight,
    debug,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
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

    const treemapTop = minBy(treeNodes, (leaf) => leaf.y0)
    const treemapBottom = maxBy(treeNodes, (leaf) => leaf.y1)

    const enrichedCategories = sortedCategories.map((category) => {
        const { edge, bounds } =
            getProminentEdgeForCategory(treeNodes, category.name, {
                top: treemapTop,
                bottom: treemapBottom,
            }) ?? {}

        return { ...category, edge, bounds }
    })

    const candidates = findCandidatesForAnnotations(enrichedCategories)

    console.log(candidates)

    const topCandidates = candidates.filter(
        (candidate) => candidate.edge === "top"
    )
    const bottomCandidates = candidates.filter(
        (candidate) => candidate.edge === "bottom"
    )

    return (
        <g>
            <CausesOfDeathCategoryAnnotationsTop
                candidates={topCandidates}
                data={data}
                treeNodes={treeNodes}
                width={width}
                annotationHeight={annotationHeight}
                debug={debug}
            />
            <CausesOfDeathCategoryAnnotationsBottom
                candidates={bottomCandidates}
                data={data}
                treeNodes={treeNodes}
                width={width}
                annotationHeight={annotationHeight}
                debug={debug}
            />
        </g>
    )

    // // Don't render anything if there are no candidates
    // if (candidates.length === 0) return null

    // const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    // const formattedPercentages = candidates.map((c) =>
    //     formatPercentSigFig(c.total / numAllDeaths)
    // )

    // const fontSize = Math.min(18, Math.max(12, width / 50))
    // const fontWeight = 500
    // const arrowWidth = 50

    // const textWidths = candidates.map((_, i) => {
    //     const text = `**${formattedPercentages[i]}** died from **${candidates[i].name.toLowerCase()}**`
    //     return new MarkdownTextWrap({
    //         text,
    //         fontSize,
    //         fontWeight,
    //     }).width
    // })

    // const boundsForLargestCategory = getBoundsForLargestCategory({
    //     treeNodes,
    //     categoryName: candidates[0].name,
    //     annotationHeight,
    // })
    // const { bounds: boundsForSecondLargestCategory, anchor } =
    //     getBoundsForSecondLargestCategory({
    //         treeNodes,
    //         categoryName: candidates[1].name,
    //         annotationHeight,
    //         leftBound:
    //             boundsForLargestCategory.left + arrowWidth + textWidths[0] + 40,
    //     })
    // const bounds = [boundsForLargestCategory, boundsForSecondLargestCategory]

    // const availableWidthForSecondLabel = bounds[1].width - arrowWidth
    // const secondAnnotationFits =
    //     // Check if the second annotation is on the same horizontal line as the first one
    //     bounds[1].y === bounds[0].y &&
    //     // Check if the second annotation fits within its container
    //     availableWidthForSecondLabel >= textWidths[1]

    // const getColor = (categoryName: string) =>
    //     CAUSE_OF_DEATH_CATEGORY_COLORS[categoryName] || "#5b5b5b"

    // return (
    //     <g>
    //         <CategoryAnnotation
    //             bounds={bounds[0]}
    //             categoryName={candidates[0].name.toLowerCase()}
    //             categoryColor={getColor(candidates[0].name)}
    //             formattedPercentage={formattedPercentages[0]}
    //             anchor="start"
    //             fontSize={fontSize}
    //             fontWeight={fontWeight}
    //             arrowWidth={arrowWidth}
    //         />

    //         {debug && (
    //             <CategoryAnnotation
    //                 bounds={bounds[1]}
    //                 categoryName={candidates[1].name.toLowerCase()}
    //                 categoryColor={getColor(candidates[1].name)}
    //                 formattedPercentage={formattedPercentages[1]}
    //                 anchor={anchor}
    //                 fontSize={fontSize}
    //                 fontWeight={fontWeight}
    //                 arrowWidth={arrowWidth}
    //                 color="red"
    //             />
    //         )}

    //         {secondAnnotationFits && (
    //             <CategoryAnnotation
    //                 bounds={bounds[1]}
    //                 categoryName={candidates[1].name.toLowerCase()}
    //                 categoryColor={getColor(candidates[1].name)}
    //                 formattedPercentage={formattedPercentages[1]}
    //                 anchor={anchor}
    //                 fontSize={fontSize}
    //                 fontWeight={fontWeight}
    //                 arrowWidth={arrowWidth}
    //             />
    //         )}
    //     </g>
    // )
}

function CausesOfDeathCategoryAnnotationsBottom({
    candidates,
    data,
    treeNodes,
    width,
    annotationHeight,
    debug,
}: {
    candidates: AnnotationCandidate[]
    data: DataRow[]
    treeNodes: TreeNode[]
    width: number
    annotationHeight: number
    debug: boolean
}) {
    console.log("Bottom candidates:", candidates)
    if (candidates.length === 0) return null

    const fontSize = Math.min(18, Math.max(12, width / 50))
    const fontWeight = 500
    const arrowWidth = 50

    const treemapLeft = minBy(treeNodes, (leaf) => leaf.x0)

    const candidate = candidates[0]

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    const formattedPercentage = formatPercentSigFig(
        candidate.total / numAllDeaths
    )

    const bounds = new Bounds(
        treemapLeft,
        candidate.bounds.y + annotationHeight,
        candidate.bounds.x0 + 30 - treemapLeft,
        annotationHeight
    )

    const getColor = (categoryName: string) =>
        CAUSE_OF_DEATH_CATEGORY_COLORS[categoryName] || "#5b5b5b"

    return (
        <>
            {/* <rect
                {...bounds.toProps()}
                fill="none"
                stroke="blue"
                strokeWidth={2}
            /> */}
            <CategoryAnnotation
                bounds={bounds}
                categoryName={candidate.name.toLowerCase()}
                categoryColor={getColor(candidate.name)}
                formattedPercentage={formattedPercentage}
                position="bottom"
                anchor="end"
                fontSize={fontSize}
                fontWeight={fontWeight}
                arrowWidth={arrowWidth}
            />
        </>
    )
}

function CausesOfDeathCategoryAnnotationsTop({
    candidates,
    data,
    treeNodes,
    width,
    annotationHeight,
    debug,
}: {
    candidates: AnnotationCandidate[]
    data: DataRow[]
    treeNodes: TreeNode[]
    width: number
    annotationHeight: number
    debug: boolean
}) {
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
        candidate: candidates[0],
        annotationHeight,
    })
    const { bounds: boundsForSecondLargestCategory, anchor } =
        getBoundsForSecondLargestCategory({
            candidate: candidates[1],
            treeNodes,
            annotationHeight,
            leftBound:
                boundsForLargestCategory.left + arrowWidth + textWidths[0] + 40,
        })
    const bounds = [boundsForLargestCategory, boundsForSecondLargestCategory]

    const availableWidthForSecondLabel = bounds[1].width - arrowWidth
    const secondAnnotationFits =
        // Check if the second annotation is on the same horizontal line as the first one
        bounds[1].y === bounds[0].y &&
        // Check if the second annotation fits within its container
        availableWidthForSecondLabel >= textWidths[1]

    const getColor = (categoryName: string) =>
        CAUSE_OF_DEATH_CATEGORY_COLORS[categoryName] || "#5b5b5b"

    return (
        <g>
            {/* <rect
                {...boundsForLargestCategory.toProps()}
                fill="none"
                stroke="red"
                strokeWidth={2}
            />
            <rect
                {...boundsForSecondLargestCategory.toProps()}
                fill="none"
                stroke="green"
                strokeWidth={2}
            /> */}

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

function findCandidatesForAnnotations(
    categories: PartialBy<AnnotationCandidate, "edge" | "bounds">[]
): AnnotationCandidate[] {
    return categories.filter((category) => isValidAnnotationCandidate(category))
}

function isValidAnnotationCandidate(
    candidate: PartialBy<AnnotationCandidate, "edge" | "bounds">
): candidate is AnnotationCandidate {
    return candidate.edge !== undefined && candidate.bounds !== undefined
}

function getNodesForCategory(treeNodes: TreeNode[], categoryName: string) {
    return treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === categoryName
    })
}

function getProminentEdgeForCategory(
    treeNodes: TreeNode[],
    categoryName: string,
    edges: { top: number; bottom: number }
): {
    edge: "top" | "bottom"
    bounds: { y: number; x0: number; x1: number }
} | null {
    const nodes = getNodesForCategory(treeNodes, categoryName)

    const topNodes = nodes.filter((node) => node.y0 === edges.top)
    if (topNodes.length > 0) {
        const bounds = {
            y: edges.top,
            x0: minBy(topNodes, (node) => node.x0),
            x1: maxBy(topNodes, (node) => node.x1),
        }
        return { edge: "top", bounds }
    }

    const bottomNodes = nodes.filter((node) => node.y1 === edges.bottom)
    if (bottomNodes.length > 0) {
        const bounds = {
            y: edges.bottom,
            x0: minBy(bottomNodes, (node) => node.x0),
            x1: maxBy(bottomNodes, (node) => node.x1),
        }
        return { edge: "bottom", bounds }
    }

    return null
}

function CategoryAnnotation({
    bounds,
    categoryName,
    categoryColor,
    formattedPercentage,
    position = "top",
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
    position?: "top" | "bottom"
    anchor: "start" | "end" // anchor the text at the start of the end of the bounds
    fontSize: number
    fontWeight: number
    color?: string
    arrowWidth?: number
}) {
    const isEndAnchored = anchor === "end"

    const direction = position === "top" ? 1 : -1

    const x = isEndAnchored
        ? bounds.right - arrowWidth
        : bounds.left + arrowWidth
    const y = position === "top" ? bounds.bottom - 12 : bounds.top + 12 // space between annotation and treemap

    const textStyle: React.CSSProperties = {
        fontSize,
        fontWeight,
        fill: "#5b5b5b",
        textAnchor: anchor,
        dominantBaseline: position === "bottom" ? "hanging" : undefined,
    }

    const arrowStart: [number, number] = [
        x + (isEndAnchored ? 3 : -3),
        y - direction * (fontSize / 2),
    ]
    const arrowEnd: [number, number] = [
        isEndAnchored ? bounds.right - 11 : bounds.left + 11,
        position === "top" ? bounds.bottom - 3 : bounds.top + 3,
    ]

    const arrowStartHandleOffset: [number, number] = isEndAnchored
        ? position === "top"
            ? [20, -5]
            : [20, 5]
        : [-20, -5]
    const arrowEndHandleOffset: [number, number] = isEndAnchored
        ? position === "top"
            ? [-5, -20]
            : [-5, 20]
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
    candidate,
    annotationHeight,
}: {
    candidate: AnnotationCandidate
    annotationHeight: number
}) {
    return new Bounds(
        candidate.bounds.x0,
        candidate.bounds.y,
        candidate.bounds.x1 - candidate.bounds.x0,
        annotationHeight
    )
}

function getBoundsForSecondLargestCategory({
    candidate,
    treeNodes,
    annotationHeight,
    leftBound,
}: {
    candidate: AnnotationCandidate
    treeNodes: TreeNode[]
    annotationHeight: number
    leftBound: number
}): { bounds: Bounds; anchor: "start" | "end" } {
    const x0 = candidate.bounds.x0
    const x1 = candidate.bounds.x1

    // todo: pass as rightBound
    const treemapRight = maxBy(treeNodes, (leaf) => leaf.x1)

    const initialBounds = new Bounds(
        leftBound,
        candidate.bounds.y,
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
