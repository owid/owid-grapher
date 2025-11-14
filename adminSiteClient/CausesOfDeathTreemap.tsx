import * as R from "remeda"
import { EntityName, Time } from "@ourworldindata/types"
import {
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    DataRow,
    EnrichedDataItem,
    TooltipState,
    TreeNode,
} from "./CausesOfDeathConstants"
import { useMemo, useState, useCallback, useRef } from "react"
import * as d3 from "d3"
import { useChartDimensions, useWindowDimensions } from "./useDimensions"
import { Bounds, getRelativeMouse } from "@ourworldindata/utils"

import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTreemapTile } from "./CausesOfDeathTreemapTile.js"
import { CausesOfDeathTreemapTooltip } from "./CausesOfDeathTreemapTooltip.js"
import {
    Category,
    NewCategoryAnnotations,
    PlacedCategory,
} from "./CausesOfDeathCategoryAnnotations.js"
import { formatPercentSigFig } from "./CausesOfDeathHelpers.js"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { match } from "ts-pattern"
import { CausesOfDeathMobileBarChart } from "./CausesOfDeathMobileBarChart.js"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

export { CausesOfDeathCaptionedChart } from "./CausesOfDeathCaptionedChart"

export const SMALL_BREAKPOINT = 768

export function ResponsiveCausesOfDeathTreemap({
    data,
    historicalData,
    metadata,
    entityName,
    year,
    ageGroup,
}: {
    data: DataRow[]
    historicalData?: DataRow[]
    metadata: CausesOfDeathMetadata
    entityName: EntityName
    year: Time
    ageGroup: string
}) {
    const config = {
        initialWidth: 900,
        ratio: 3 / 2,
        minHeight: 400,
        maxHeight: 800,
    }

    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({ config })
    const { dimensions: windowDimensions } = useWindowDimensions()

    const isNarrow = dimensions.width < SMALL_BREAKPOINT
    const height = isNarrow
        ? R.clamp(windowDimensions.height - 16, {
              min: config.minHeight,
              max: config.maxHeight,
          })
        : dimensions.height

    return (
        <div ref={ref}>
            <CausesOfDeathTreemap
                data={data}
                historicalData={historicalData}
                metadata={metadata}
                entityName={entityName}
                year={year}
                ageGroup={ageGroup}
                width={dimensions.width}
                height={height}
            />
        </div>
    )
}

function CausesOfDeathTreemap({
    data,
    historicalData,
    metadata,
    entityName,
    year,
    ageGroup,
    width,
    height,
}: {
    data: DataRow[]
    historicalData?: DataRow[]
    metadata: CausesOfDeathMetadata
    entityName: EntityName
    year: Time
    ageGroup: string
    width: number
    height: number
}) {
    // Tooltip state management
    const [tooltipState, setTooltipState] = useState<TooltipState>({
        target: null,
        position: { x: 0, y: 0 },
    })
    const svgRef = useRef<SVGSVGElement>(null)
    const hideTimeoutRef = useRef<number | null>(null)

    const onTileMouseEnter = useCallback(
        (node: TreeNode, event: React.MouseEvent) => {
            if (!svgRef.current) return

            // Clear any pending hide timeout
            if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current)
                hideTimeoutRef.current = null
            }

            const position = getRelativeMouse(svgRef.current, event.nativeEvent)
            const target = { node }

            setTooltipState({ target, position })
        },
        []
    )

    const onTileMouseMove = useCallback(
        (event: React.MouseEvent) => {
            if (!svgRef.current || !tooltipState.target) return

            const position = getRelativeMouse(svgRef.current, event.nativeEvent)
            setTooltipState((prev) => ({ ...prev, position }))
        },
        [tooltipState.target]
    )

    const onTileMouseLeave = useCallback(() => {
        // Delay hiding the tooltip to prevent flashing when moving between tiles
        hideTimeoutRef.current = window.setTimeout(() => {
            setTooltipState((prev) => ({ ...prev, target: null }))
            hideTimeoutRef.current = null
        }, 200) // 200ms delay should be enough to prevent flashing
    }, [])

    const isNarrow = width < SMALL_BREAKPOINT
    const tilingMethod = isNarrow
        ? d3.treemapSlice
        : stackedSliceDiceTiling({ minSliceWidth: 120, minStackHeight: 40 })

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { entityName, year, variable: "All", value: null, share: 0 }, // todo: null
        // Category nodes
        ...metadata.categoriesForAgeGroup(ageGroup).map((category) => ({
            entityName,
            year,
            variable: category.name,
            parentId: "All", // points to the root node
            value: null,
            share: null,
        })),
        // Data nodes
        ...data.map((row) => ({
            ...row,
            share: row.value / numAllDeaths,
            category: row.category,
            parentId: row.category,
        })),
    ]

    const stratify = d3
        .stratify<EnrichedDataItem>()
        .id((d) => d.variable)
        .parentId((d) => d.parentId)

    const treeData = stratify(enrichedData)

    const hierarchy = d3
        .hierarchy(treeData)
        .sum((d) => d.data.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(tilingMethod as any) // TODO
        .size([width, height])
        .padding(1)
        .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])

    const shouldPinTooltipToBottom = isNarrow

    const treemapBounds = new Bounds(0, 0, width, height)

    // todo: data structure for annotations
    const annotationHeight = 30
    const placedAnnotations = !isNarrow
        ? placeExternalCategoryAnnotations({
              data,
              metadata,
              treemapBounds,
              treemapNodes: leaves,
              annotationHeight,
          })
        : []
    const topAnnotations = placedAnnotations.filter(
        (a) => a.placement === "top"
    )
    const bottomAnnotations = placedAnnotations.filter(
        (a) => a.placement === "bottom"
    )

    const containerPadding = {
        top: topAnnotations.length > 0 ? annotationHeight : 0,
        bottom: bottomAnnotations.length > 0 ? annotationHeight : 0,
    }
    const containerBounds = treemapBounds.expand(containerPadding)

    return (
        <div style={{ position: "relative" }}>
            {isNarrow && (
                <CausesOfDeathMobileBarChart
                    data={data}
                    metadata={metadata}
                    ageGroup={ageGroup}
                />
            )}

            <svg
                ref={svgRef}
                className="causes-of-death-treemap"
                viewBox={`0 0 ${containerBounds.width} ${containerBounds.height}`}
                width={containerBounds.width}
                height={containerBounds.height}
                onMouseMove={onTileMouseMove}
            >
                {leaves.map((node) => (
                    <CausesOfDeathTreemapTile
                        key={node.data.id}
                        node={node}
                        description={
                            metadata.variableByName.get(node.data.data.variable)
                                ?.description || ""
                        }
                        isLargestTile={leaves[0] === node}
                        annotationHeight={containerPadding.top}
                        isNarrow={isNarrow}
                        treemapBounds={treemapBounds}
                        onMouseEnter={onTileMouseEnter}
                        onMouseLeave={onTileMouseLeave}
                    />
                ))}

                <NewCategoryAnnotations placedAnnotations={placedAnnotations} />
            </svg>

            {tooltipState.target && (
                <CausesOfDeathTreemapTooltip
                    state={tooltipState}
                    shouldPinTooltipToBottom={shouldPinTooltipToBottom}
                    containerBounds={containerBounds}
                    historicalData={historicalData}
                />
            )}
        </div>
    )
}

function placeExternalCategoryAnnotations({
    data,
    metadata,
    treemapBounds,
    treemapNodes,
    annotationHeight,
}: {
    data: DataRow[]
    metadata: CausesOfDeathMetadata
    treemapBounds: Bounds
    treemapNodes: TreeNode[]
    annotationHeight: number
}): PlacedCategory[] {
    // Calculate deaths per category and sort by totals
    const sortedCategories: Category[] = R.pipe(
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

    const placedCategories: PlacedCategory[] = []
    for (const category of sortedCategories) {
        const numAllDeaths = d3.sum(data, (d) => d.value) || 0
        const formattedPercentage = formatPercentSigFig(
            category.total / numAllDeaths
        )

        const topPlacedCategory = placeCategoryAnnotation(
            category,
            placedCategories,
            treemapBounds,
            treemapNodes,
            formattedPercentage,
            "top",
            annotationHeight
        )
        if (topPlacedCategory) {
            placedCategories.push(topPlacedCategory)
            continue
        }

        const bottomPlacedCategory = placeCategoryAnnotation(
            category,
            placedCategories,
            treemapBounds,
            treemapNodes,
            formattedPercentage,
            "bottom",
            annotationHeight
        )
        if (bottomPlacedCategory) {
            placedCategories.push(bottomPlacedCategory)
            continue
        }
    }

    console.log("PLACED", placedCategories)
    return placedCategories
}

function placeCategoryAnnotation(
    category: Category,
    placedCategories: PlacedCategory[],
    treemapBounds: Bounds,
    treemapNodes: TreeNode[],
    formattedPercentage: string,
    placement: "top" | "bottom",
    annotationHeight: number
): PlacedCategory | undefined {
    const categoryNodes = getNodesForCategory(treemapNodes, category.name)

    const getY = match(placement)
        .with("top", () => (node: TreeNode) => node.y0)
        .with("bottom", () => (node: TreeNode) => node.y1)
        .exhaustive()

    // Check if there's at least one node aligned to the top or bottom of the treemap
    const treemapY = match(placement)
        .with("top", () => minBy(treemapNodes, getY))
        .with("bottom", () => maxBy(treemapNodes, getY))
        .exhaustive()
    const relevantNodes = categoryNodes.filter(
        (node) => getY(node) === treemapY
    )
    // console.log("relevant nodes", category.name, placement, relevantNodes)
    if (relevantNodes.length === 0) return undefined

    const left = minBy(relevantNodes, (node) => node.x0)
    const right = maxBy(relevantNodes, (node) => node.x1)
    const nodesWidth = right - left

    // todo: move elsewhere?
    const fontSize = Math.min(18, Math.max(12, treemapBounds.width / 50))
    const fontWeight = 500
    const arrowWidth = 75 // space for arrow and a bit of padding

    const categoryColor =
        CAUSE_OF_DEATH_CATEGORY_COLORS[category.name] || "#5b5b5b"
    const textFragments = [
        { text: formattedPercentage, style: { fontWeight: 700 } },
        { text: " died from ", style: {} },
        {
            text: category.name.toLowerCase(),
            style: { fontWeight: 700, fill: categoryColor },
        },
    ]
    // TODO
    const label = `**${textFragments[0].text}**${textFragments[1].text}**${textFragments[2].text}**`
    console.log(label)

    const textWrap = new MarkdownTextWrap({
        text: label,
        maxWidth: Infinity, // no wrapping
        fontSize,
        fontWeight,
    })
    const textWidth = textWrap.width

    const relevantPlacedCategories = placedCategories.filter(
        (c) => c.placement === placement
    )
    const placedBounds = combineBounds(
        relevantPlacedCategories.map((c) => c.bounds)
    )

    const y = placement === "top" ? treemapY : treemapY + annotationHeight
    const annotationWidth = arrowWidth + textWidth

    const padding = Math.min(30, 0.33 * nodesWidth)

    const candidates: {
        x: number
        arrowAnchor: PlacedCategory["arrowAnchor"]
        textAnchor: PlacedCategory["textAnchor"]
    }[] = [
        // arrow is on the left, annotation text to the right
        { x: left, arrowAnchor: "left", textAnchor: "start" },

        // arrow is on the left, annotation text to the left
        {
            x: left - arrowWidth - textWidth + padding,
            arrowAnchor: "left",
            textAnchor: "end",
        },

        // arrow is on the right, annotation text to the left
        {
            x: right - arrowWidth - textWidth,
            arrowAnchor: "right",
            textAnchor: "end",
        },

        // arrow is on the right, annotation text to the right
        { x: right - padding, arrowAnchor: "right", textAnchor: "start" },
    ]

    for (const { x, arrowAnchor, textAnchor } of candidates) {
        const bounds = new Bounds(x, y, annotationWidth, annotationHeight)
        if (
            (!placedBounds || !bounds.hasHorizontalOverlap(placedBounds)) &&
            bounds.left >= treemapBounds.left &&
            bounds.right <= treemapBounds.right
        ) {
            return {
                ...category,
                bounds,
                placement,
                arrowAnchor,
                textAnchor,
                textFragments,
                fontSize,
            }
        }
    }

    // // arrow is on the left, annotation text to the right
    // const boundsLeftAnchored = new Bounds(left, y, width, height)
    // if (
    //     (!placedBounds ||
    //         !boundsLeftAnchored.hasHorizontalOverlap(placedBounds)) &&
    //     boundsLeftAnchored.left >= treemapBounds.left &&
    //     boundsLeftAnchored.right <= treemapBounds.right
    // ) {
    //     return {
    //         ...category,
    //         bounds: boundsLeftAnchored,
    //         placement,
    //         arrowAnchor: "left",
    //         textAnchor: "start",
    //         textFragments,
    //         fontSize,
    //     }
    // }

    // // arrow is on the left, annotation text to the left
    // const boundsLeftAnchoredReverse = new Bounds(
    //     left - arrowWidth - textWidth + 30, // +30 so the arrow points to the right node
    //     y,
    //     width,
    //     height
    // )
    // if (
    //     (!placedBounds ||
    //         !boundsLeftAnchoredReverse.hasHorizontalOverlap(placedBounds)) &&
    //     boundsLeftAnchoredReverse.left >= treemapBounds.left &&
    //     boundsLeftAnchoredReverse.right <= treemapBounds.right
    // ) {
    //     return {
    //         ...category,
    //         bounds: boundsLeftAnchoredReverse,
    //         placement,
    //         arrowAnchor: "left",
    //         textAnchor: "end",
    //         textFragments,
    //         fontSize,
    //     }
    // }

    // // arrow is on the right, annotation text to the left
    // const boundsRightAnchored = new Bounds(
    //     right - arrowWidth - textWidth,
    //     y,
    //     width,
    //     height
    // )
    // console.log(category.name, placement, "boundsRightAnchored", {
    //     hasOverlap: boundsRightAnchored.hasHorizontalOverlap(placedBounds),
    //     placedBounds: { left: placedBounds.left, right: placedBounds.right },
    //     boundsRightAnchored: {
    //         left: boundsRightAnchored.left,
    //         right: boundsRightAnchored.right,
    //     },
    //     treemapBounds,
    //     isWithinTreemap:
    //         boundsRightAnchored.left >= treemapBounds.left &&
    //         boundsRightAnchored.right <= treemapBounds.right,
    // })
    // if (
    //     (!placedBounds ||
    //         !boundsRightAnchored.hasHorizontalOverlap(placedBounds)) &&
    //     boundsRightAnchored.left >= treemapBounds.left &&
    //     boundsRightAnchored.right <= treemapBounds.right
    // ) {
    //     return {
    //         ...category,
    //         bounds: boundsRightAnchored,
    //         placement,
    //         arrowAnchor: "right",
    //         textAnchor: "end",
    //         textFragments,
    //         fontSize,
    //     }
    // }

    // // arrow is on the right, annotation text to the right
    // const boundsRightAnchoredReverse = new Bounds(right, y, width, height)
    // if (
    //     (!placedBounds ||
    //         !boundsRightAnchoredReverse.hasHorizontalOverlap(placedBounds)) &&
    //     boundsRightAnchoredReverse.left >= treemapBounds.left &&
    //     boundsRightAnchoredReverse.right <= treemapBounds.right
    // ) {
    //     return {
    //         ...category,
    //         bounds: boundsRightAnchoredReverse,
    //         placement,
    //         arrowAnchor: "right",
    //         textAnchor: "start",
    //         textFragments,
    //         fontSize,
    //     }
    // }

    return undefined
}

function getNodesForCategory(treeNodes: TreeNode[], categoryName: string) {
    return treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === categoryName
    })
}

function combineBounds(bounds: Bounds[]): Bounds {
    if (bounds.length === 0) return new Bounds(0, 0, 0, 0)
    if (bounds.length === 1) return bounds[0]

    let combinedBounds = bounds[0]
    for (let i = 1; i < bounds.length; i++) {
        combinedBounds = combinedBounds.expand({
            top: Math.min(combinedBounds.top, bounds[i].top),
            right: Math.max(combinedBounds.right, bounds[i].right),
            bottom: Math.max(combinedBounds.bottom, bounds[i].bottom),
            left: Math.min(combinedBounds.left, bounds[i].left),
        })
    }

    return combinedBounds
}

const minBy = <T,>(array: T[], selector: (item: T) => number): number => {
    return Math.min(...array.map(selector))
}

const maxBy = <T,>(array: T[], selector: (item: T) => number): number => {
    return Math.max(...array.map(selector))
}
