import { EntityName, Time } from "@ourworldindata/types"
import {
    CAUSE_OF_DEATH_CATEGORIES,
    DataRow,
    EnrichedDataItem,
    TooltipState,
    TreeNode,
} from "./CausesOfDeathConstants"
import { useMemo, useState, useCallback, useRef } from "react"
import * as d3 from "d3"
import useChartDimensions, { DimensionsConfig } from "./useChartDimensions"
import { CausesOfDeathCategoryAnnotations } from "./CausesOfDeathCategoryAnnotations"
import { Bounds, getRelativeMouse } from "@ourworldindata/utils"

import { MyCausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTreemapTile } from "./CausesOfDeathTreemapTile.js"
import { CausesOfDeathTreemapTooltip } from "./CausesOfDeathTreemapTooltip.js"

export { CausesOfDeathCaptionedChart } from "./CausesOfDeathCaptionedChart"

export const SMALL_BREAKPOINT = 768

export function ResponsiveCausesOfDeathTreemap({
    data,
    historicalData,
    metadata,
    entityName,
    year,
    dimensionsConfig,
    tilingMethod,
    isNarrow,
    debug = false,
}: {
    data: DataRow[]
    historicalData?: DataRow[]
    metadata: MyCausesOfDeathMetadata
    entityName: EntityName
    year: Time
    dimensionsConfig?: DimensionsConfig
    tilingMethod?: any // TODO
    isNarrow?: boolean
    debug?: boolean
}) {
    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({
        config: dimensionsConfig,
    })

    const height = isNarrow
        ? (dimensionsConfig?.maxHeight ?? 900)
        : dimensions.height

    return (
        <div ref={ref}>
            <CausesOfDeathTreemap
                data={data}
                historicalData={historicalData}
                metadata={metadata}
                entityName={entityName}
                year={year}
                tilingMethod={tilingMethod}
                width={dimensions.width}
                height={height}
                debug={debug}
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
    tilingMethod = d3.treemapSquarify,
    width,
    height,
    debug = false,
}: {
    data: DataRow[]
    historicalData?: DataRow[]
    metadata: MyCausesOfDeathMetadata
    entityName: EntityName
    year: Time
    width: number
    height: number
    tilingMethod?: any // TODO: type this
    debug?: boolean
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

            if (debug) {
                console.log("Tooltip target:", target, "Position:", position)
            }

            setTooltipState({ target, position })
        },
        [debug]
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

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0

    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { entityName, year, variable: "All", value: null, share: 0 }, // todo: null
        // Category nodes
        ...CAUSE_OF_DEATH_CATEGORIES.map((category) => ({
            entityName,
            year,
            variable: category,
            parentId: "All", // points to the root node
            value: null,
            share: null,
        })),
        // Data nodes
        ...data.map((row) => {
            const category = metadata.categoryNameByVariableName.get(
                row.variable
            )
            return {
                ...row,
                share: row.value / numAllDeaths,
                category,
                parentId: category,
            }
        }),
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
        .tile(tilingMethod)
        .size([width, height])
        .padding(1)
        .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])

    // TODO: extract?
    const isNarrow = width < SMALL_BREAKPOINT
    const annotationHeight = !isNarrow ? 30 : 0
    const shouldPinTooltipToBottom = isNarrow

    const treemapBounds = new Bounds(0, 0, width, height)
    const containerBounds = treemapBounds.expand({ bottom: annotationHeight })

    return (
        <div style={{ position: "relative" }}>
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
                        annotationHeight={annotationHeight}
                        isNarrow={isNarrow}
                        treemapBounds={treemapBounds}
                        debug={debug}
                        onMouseEnter={onTileMouseEnter}
                        onMouseLeave={onTileMouseLeave}
                    />
                ))}

                {!isNarrow && (
                    <CausesOfDeathCategoryAnnotations
                        data={data}
                        metadata={metadata}
                        treeNodes={leaves}
                        width={width}
                        annotationHeight={annotationHeight}
                        debug={debug}
                    />
                )}
            </svg>

            {tooltipState.target && (
                <CausesOfDeathTreemapTooltip
                    state={tooltipState}
                    shouldPinTooltipToBottom={shouldPinTooltipToBottom}
                    containerBounds={containerBounds}
                    historicalData={historicalData}
                />
            )}

            {/* <CausesOfDeathTreemapTooltip
                state={{
                    target: { node: leaves[0] },
                    position: { x: 0, y: 0 },
                }}
                historicalData={historicalData}
            /> */}
        </div>
    )
}
