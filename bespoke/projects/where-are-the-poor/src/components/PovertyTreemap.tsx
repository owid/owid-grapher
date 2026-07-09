import * as R from "remeda"
import { Time } from "@ourworldindata/types"
import {
    DataRow,
    EnrichedDataItem,
    GroupBy,
    PovertyLine,
    TooltipState,
    TreeNode,
} from "../helpers/PovertyConstants.js"
import { useMemo, useState, useCallback, useRef } from "react"
import { usePinnedTooltip } from "../../../../hooks/usePinnedTooltip.js"
import * as d3 from "d3"
import {
    useChartDimensions,
    useScreenDimensions,
} from "../../../../hooks/useDimensions"
import { Bounds, getRelativeMouse, isTouchDevice } from "@ourworldindata/utils"

import { getGroupForRow } from "../helpers/PovertyData.js"
import { PovertyTreemapTile } from "./PovertyTreemapTile.js"
import { PovertyTreemapTooltip } from "./PovertyTreemapTooltip.js"
import { PovertyGroupAnnotations } from "./PovertyGroupAnnotations.js"
import {
    stackedSliceDiceTiling,
    TilingFunction,
} from "../helpers/stackedSliceDiceTiling.js"
import {
    WhereAreThePoorChartContext,
    useWhereAreThePoorChartContext,
} from "../helpers/PovertyTreemapContext.js"
import { placeExternalGroupAnnotations } from "../helpers/PovertyGroupAnnotationsHelpers.js"
import { PovertyLegend } from "./PovertyLegend.js"

const SMALL_BREAKPOINT = 550

export function ResponsivePovertyTreemap({
    data,
    timeSeriesData,
    povertyLine,
    groupBy,
    continent,
    year,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
    povertyLine: PovertyLine
    groupBy: GroupBy
    continent: string
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
            <WhereAreThePoorChartContext.Provider
                value={{ isMobile: isNarrow }}
            >
                {isNarrow && <PovertyLegend data={data} groupBy={groupBy} />}

                {hasValidDimensions && (
                    <PovertyTreemap
                        data={data}
                        timeSeriesData={timeSeriesData}
                        povertyLine={povertyLine}
                        groupBy={groupBy}
                        continent={continent}
                        year={year}
                        width={dimensions.width}
                        height={height}
                    />
                )}
            </WhereAreThePoorChartContext.Provider>
        </div>
    )
}

function PovertyTreemap({
    data,
    timeSeriesData,
    povertyLine,
    groupBy,
    continent,
    year,
    width,
    height,
}: {
    data: DataRow[]
    timeSeriesData: DataRow[]
    povertyLine: PovertyLine
    groupBy: GroupBy
    continent: string
    year: Time
    width: number
    height: number
}) {
    const svgRef = useRef<SVGSVGElement>(null)
    const timerRef = useRef<number | null>(null)

    const { isMobile } = useWhereAreThePoorChartContext()

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

    const numTotalPoor = d3.sum(data, (d) => d.headcount) || 0
    const groupNames = R.unique(data.map((row) => getGroupForRow(row, groupBy)))
    const enrichedData: EnrichedDataItem[] = [
        // Root node
        { id: "All" },

        // Group nodes (continents or World Bank regions)
        ...groupNames.map((group) => ({
            id: group,
            group,
            parentId: "All", // points to the root node
        })),

        // Country nodes
        ...data
            .filter((row) => row.headcount > 0)
            .map((row) => ({
                id: row.countryName,
                countryName: row.countryName,
                group: getGroupForRow(row, groupBy),
                parentId: getGroupForRow(row, groupBy),
                value: row.headcount,
                share: row.headcount / numTotalPoor,
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

    const treemapBounds = new Bounds(0, 0, width, height)

    // External group annotations. Skip them when there's only one group
    // (e.g. a single continent is selected), where they'd just say "100%".
    const annotationHeight = 30
    const placedAnnotations =
        !isMobile && groupNames.length > 1
            ? placeExternalGroupAnnotations({
                  data,
                  groupBy,
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
        <div ref={chartRef}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${containerBounds.width} ${containerBounds.height}`}
                width={containerBounds.width}
                height={containerBounds.height}
                onMouseMove={onTileMouseMove}
            >
                {leaves.map((node) => (
                    <PovertyTreemapTile
                        key={node.data.id}
                        node={node}
                        translateY={containerPadding.top}
                        treemapBounds={treemapBounds}
                        onMouseEnter={onTileMouseEnter}
                        onMouseLeave={onTileMouseLeave}
                    />
                ))}

                <PovertyGroupAnnotations
                    placedAnnotations={placedAnnotations}
                />
            </svg>

            {tooltipState.target && (
                <PovertyTreemapTooltip
                    state={tooltipState}
                    shouldPinTooltipToBottom={shouldPinTooltipToBottom}
                    containerBounds={containerBounds}
                    timeSeriesData={timeSeriesData}
                    povertyLine={povertyLine}
                    continent={continent}
                    year={year}
                />
            )}
        </div>
    )
}
