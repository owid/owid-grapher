import * as R from "remeda"
import { EntityName, Time } from "@ourworldindata/types"
import {
    DataRow,
    EnrichedDataItem,
    TooltipState,
    TreeNode,
} from "./CausesOfDeathConstants"
import { useMemo, useState, useCallback, useRef } from "react"
import * as d3 from "d3"
import { useChartDimensions, useScreenDimensions } from "./useDimensions"
import { Bounds, getRelativeMouse } from "@ourworldindata/utils"

import { CausesOfDeathMetadata } from "./CausesOfDeathMetadata.js"
import { CausesOfDeathTreemapTile } from "./CausesOfDeathTreemapTile.js"
import { CausesOfDeathTreemapTooltip } from "./CausesOfDeathTreemapTooltip.js"
import { CategoryAnnotations } from "./CausesOfDeathCategoryAnnotations.js"
import {
    stackedSliceDiceTiling,
    TilingFunction,
} from "./stackedSliceDiceTiling.js"
import {
    CausesOfDeathChartContext,
    useCausesOfDeathChartContext,
} from "./CausesOfDeathContext"
import { placeExternalCategoryAnnotations } from "./CausesOfDeathCategoryAnnotationsHelpers.js"
import { CausesOfDeathLegend } from "./CauseOfDeathLegend.js"

const SMALL_BREAKPOINT = 550

export function ResponsiveCausesOfDeathTreemap({
    data,
    timeSeriesData,
    metadata,
    entityName,
    year,
    ageGroup,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
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
    const { dimensions: windowDimensions } = useScreenDimensions()

    // The treemap should fill the window height on smaller screens
    const isNarrow = dimensions.width < SMALL_BREAKPOINT
    const height = isNarrow
        ? R.clamp(windowDimensions.height * 0.8, {
              min: config.minHeight,
              max: config.maxHeight,
          })
        : dimensions.height

    return (
        <div ref={ref}>
            <CausesOfDeathChartContext.Provider value={{ isMobile: isNarrow }}>
                {isNarrow && (
                    <CausesOfDeathLegend metadata={metadata} data={data} />
                )}

                <CausesOfDeathTreemap
                    data={data}
                    timeSeriesData={timeSeriesData}
                    metadata={metadata}
                    entityName={entityName}
                    year={year}
                    ageGroup={ageGroup}
                    width={dimensions.width}
                    height={height}
                />
            </CausesOfDeathChartContext.Provider>
        </div>
    )
}

function CausesOfDeathTreemap({
    data,
    timeSeriesData,
    metadata,
    entityName,
    year,
    ageGroup,
    width,
    height,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
    metadata: CausesOfDeathMetadata
    entityName: EntityName
    year: Time
    ageGroup: string
    width: number
    height: number
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const timerRef = useRef<number | null>(null)

    const { isMobile } = useCausesOfDeathChartContext()

    const [tooltipState, setTooltipState] = useState<TooltipState>({
        target: null,
        position: { x: 0, y: 0 },
    })

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
        // Delay hiding the tooltip to prevent flashing when moving between tiles
        timerRef.current = window.setTimeout(() => {
            setTooltipState((prev) => ({ ...prev, target: null }))
            timerRef.current = null
        }, 200)
    }, [])

    const numAllDeaths = d3.sum(data, (d) => d.value) || 0
    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { entityName, year, variable: "All" },

        // Category nodes
        ...metadata.categoriesForAgeGroup(ageGroup).map((category) => ({
            entityName,
            year,
            variable: category.name,
            parentId: "All", // points to the root node
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

    const tilingMethod: TilingFunction<d3.HierarchyNode<EnrichedDataItem>> =
        isMobile
            ? d3.treemapSlice
            : stackedSliceDiceTiling({ minColumnWidth: 100, minRowHeight: 30 })

    const treemapLayout = d3
        .treemap<d3.HierarchyNode<EnrichedDataItem>>()
        .tile(tilingMethod)
        .size([width, height])
        .padding(1)
        .round(true) // TODO: keep?

    const root = treemapLayout(hierarchy)
    const leaves = useMemo(() => root.leaves() as TreeNode[], [root])

    const treemapBounds = new Bounds(0, 0, width, height)

    // External category annotations
    const annotationHeight = 30
    const placedAnnotations = !isMobile
        ? placeExternalCategoryAnnotations({
              data,
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

    // Container bounds
    const containerPadding = {
        top: topAnnotations.length > 0 ? annotationHeight : 0,
        bottom: bottomAnnotations.length > 0 ? annotationHeight : 0,
    }
    const containerBounds = treemapBounds.expand(containerPadding)

    return (
        <div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${containerBounds.width} ${containerBounds.height}`}
                width={containerBounds.width}
                height={containerBounds.height}
                onMouseMove={onTileMouseMove}
            >
                {leaves.map((node) => (
                    <CausesOfDeathTreemapTile
                        key={node.data.id}
                        node={node}
                        isLargestTile={leaves[0].data.id === node.data.id}
                        translateY={containerPadding.top}
                        treemapBounds={treemapBounds}
                        onMouseEnter={onTileMouseEnter}
                        onMouseLeave={onTileMouseLeave}
                    />
                ))}

                <CategoryAnnotations placedAnnotations={placedAnnotations} />
            </svg>

            {tooltipState.target && (
                <CausesOfDeathTreemapTooltip
                    state={tooltipState}
                    shouldPinTooltipToBottom={isMobile}
                    containerBounds={containerBounds}
                    timeSeriesData={timeSeriesData}
                    year={year}
                />
            )}
        </div>
    )
}
