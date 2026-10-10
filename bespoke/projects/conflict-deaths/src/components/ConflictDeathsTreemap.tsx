import * as R from "remeda"
import { Time } from "@ourworldindata/types"
import {
    DataRow,
    EnrichedDataItem,
    TooltipState,
    TreeNode,
} from "../core/ConflictDeathsConstants"
import { useMemo, useState, useCallback, useRef } from "react"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import * as d3 from "d3"
import {
    useChartDimensions,
    useScreenDimensions,
} from "../../../../hooks/useDimensions"
import { Bounds, getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"

import { ConflictDeathsMetadata } from "../core/ConflictDeathsMetadata.js"
import { ConflictDeathsTreemapTile } from "./ConflictDeathsTreemapTile.js"
import { ConflictDeathsTreemapTooltip } from "./ConflictDeathsTreemapTooltip.js"
import { ConflictDeathsRegionAnnotations } from "./ConflictDeathsRegionAnnotations.js"
import {
    stackedSliceDiceTiling,
    TilingFunction,
} from "../core/stackedSliceDiceTiling.js"
import {
    ConflictDeathsChartContext,
    useConflictDeathsChartContext,
} from "../core/ConflictDeathsContext"
import { placeExternalRegionAnnotations } from "../core/ConflictDeathsRegionAnnotationsHelpers.js"
import { ConflictDeathsLegend } from "./ConflictDeathsLegend.js"

const SMALL_BREAKPOINT = 550

const ROOT_ID = "All countries"

export function ResponsiveConflictDeathsTreemap({
    data,
    timeSeriesData,
    metadata,
    year,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
    metadata: ConflictDeathsMetadata
    year: Time
}) {
    const config = {
        initialWidth: 900,
        ratio: 3 / 2,
        minHeight: 400,
        maxHeight: 800,
    }

    const { ref, dimensions } = useChartDimensions<HTMLDivElement>({ config })
    const { dimensions: windowDimensions } = useScreenDimensions()

    // The treemap should fill the window height on smaller screens
    const isNarrow = dimensions.width < SMALL_BREAKPOINT
    const height = isNarrow
        ? R.clamp(windowDimensions.height * 0.8, {
              min: config.minHeight,
              max: config.maxHeight,
          })
        : dimensions.height

    // Don't render if there's no space to draw (can happen briefly when the
    // ResizeObserver fires before the container has been laid out)
    const hasValidDimensions = dimensions.width > 0 && height > 0

    return (
        <div ref={ref}>
            <ConflictDeathsChartContext.Provider value={{ isMobile: isNarrow }}>
                {hasValidDimensions && (
                    <ConflictDeathsTreemap
                        data={data}
                        timeSeriesData={timeSeriesData}
                        metadata={metadata}
                        year={year}
                        width={dimensions.width}
                        height={height}
                    />
                )}
            </ConflictDeathsChartContext.Provider>
        </div>
    )
}

function ConflictDeathsTreemap({
    data,
    timeSeriesData,
    metadata,
    year,
    width,
    height,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
    metadata: ConflictDeathsMetadata
    year: Time
    width: number
    height: number
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const timerRef = useRef<number | null>(null)

    const { isMobile } = useConflictDeathsChartContext()

    const [tooltipState, setTooltipState] = useState<TooltipState>({
        target: null,
        position: { x: 0, y: 0 },
    })

    const dismissTooltip = useCallback(
        () => setTooltipState((prev) => ({ ...prev, target: null })),
        []
    )

    const { ref: chartRef, isPinned: shouldPinTooltipToBottom } =
        usePinnedTooltip<HTMLDivElement>(
            tooltipState.target !== null,
            dismissTooltip
        )

    const onTileMouseEnter = useCallback(
        (node: TreeNode, event: React.MouseEvent) => {
            if (!svgRef.current) return

            // Clear any pending hide timeout
            if (timerRef.current) {
                clearTimeout(timerRef.current)
                timerRef.current = null
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
        // On touch devices, tooltip dismissal is handled by usePinnedTooltip
        if (isTouchDevice()) return

        // Delay hiding the tooltip to prevent flashing when moving between tiles
        timerRef.current = window.setTimeout(() => {
            setTooltipState((prev) => ({ ...prev, target: null }))
            timerRef.current = null
        }, 200)
    }, [])

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { id: ROOT_ID, year },

        // Region nodes
        ...metadata.regions.map((region) => ({
            id: region.name,
            year,
            region: region.name,
            parentId: ROOT_ID,
        })),

        // Country nodes
        ...data.map((row) => ({
            id: row.entityName,
            entityName: row.entityName,
            year,
            region: row.region,
            value: row.value,
            share: row.value / numAllDeaths,
            parentId: row.region,
        })),
    ]

    const stratify = d3
        .stratify<EnrichedDataItem>()
        .id((d) => d.id)
        .parentId((d) => d.parentId)

    const treeData = stratify(enrichedData)

    const hierarchy = d3
        .hierarchy(treeData)
        .sum((d) => d.data.value || 0)
        .sort((a, b) => (b.value || 0) - (a.value || 0))

    const tilingMethod: TilingFunction<d3.HierarchyNode<EnrichedDataItem>> =
        isMobile
            ? d3.treemapSlice
            : stackedSliceDiceTiling({ minColumnWidth: 100, minRowHeight: 30 })

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(tilingMethod)
        .size([width, height])
        .padding(1)
        .round(true)

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])
    const largestLeafId = R.firstBy(leaves, [(leaf) => leaf.value ?? 0, "desc"])
        ?.data.id

    const treemapBounds = new Bounds(0, 0, width, height)

    // External region annotations
    const annotationHeight = 30
    const placedAnnotations = !isMobile
        ? placeExternalRegionAnnotations({
              data,
              treemapBounds,
              treemapNodes: leaves,
              annotationHeight,
          })
        : []
    // Not every region finds room for an annotation; show a legend then
    const numRegionsWithDeaths = R.unique(data.map((row) => row.region)).length
    const showLegend =
        isMobile || placedAnnotations.length < numRegionsWithDeaths

    const topAnnotations = placedAnnotations.filter(
        (a) => a.placement === "top"
    )
    const bottomAnnotations = placedAnnotations.filter(
        (a) => a.placement === "bottom"
    )

    // Container bounds
    const containerPadding = {
        top: topAnnotations.length > 0 ? annotationHeight : 0,
        bottom: bottomAnnotations.length > 0 ? annotationHeight : 0,
    }
    const containerBounds = treemapBounds.expand(containerPadding)

    return (
        <div ref={chartRef}>
            {showLegend && (
                <ConflictDeathsLegend metadata={metadata} data={data} />
            )}
            {/* Positions the tooltip relative to the treemap, below the legend */}
            <div className="conflict-deaths-treemap__plot">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${containerBounds.width} ${containerBounds.height}`}
                    width={containerBounds.width}
                    height={containerBounds.height}
                    onMouseMove={onTileMouseMove}
                >
                    {leaves.map((node) => (
                        <ConflictDeathsTreemapTile
                            key={node.data.id}
                            node={node}
                            isLargestTile={node.data.id === largestLeafId}
                            translateY={containerPadding.top}
                            treemapBounds={treemapBounds}
                            onMouseEnter={onTileMouseEnter}
                            onMouseLeave={onTileMouseLeave}
                        />
                    ))}

                    <ConflictDeathsRegionAnnotations
                        placedAnnotations={placedAnnotations}
                    />
                </svg>

                {tooltipState.target && (
                    <ConflictDeathsTreemapTooltip
                        state={tooltipState}
                        shouldPinTooltipToBottom={shouldPinTooltipToBottom}
                        containerBounds={containerBounds}
                        timeSeriesData={timeSeriesData}
                        years={metadata.availableYears}
                        year={year}
                    />
                )}
            </div>
        </div>
    )
}
