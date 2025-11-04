import {
    CauseOfDeathCategory,
    CAUSE_OF_DEATH_CATEGORY_COLORS,
    TreeNode,
} from "./CausesOfDeathConstants"

import { CausesOfDeathTreemapTileLabels } from "./CausesOfDeathTreemapTileLabels"

import { stackedSliceDiceTiling as _stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

export function CausesOfDeathTreemapTile({
    node,
    description,
    numAllDeaths, // for percentage calculation
    isLargestTile,
    annotationHeight,
    isNarrow,
    treemapWidth,
    treemapHeight,
    debug = false,
    onMouseEnter,
    onMouseLeave,
}: {
    node: TreeNode
    description: string
    treemapWidth: number
    treemapHeight: number
    // remove all props here?
    numAllDeaths: number
    isLargestTile: boolean
    annotationHeight: number
    isNarrow: boolean
    debug: boolean
    onMouseEnter?: (node: TreeNode, event: React.MouseEvent) => void
    onMouseLeave?: () => void
}) {
    if (!node.value) return null

    const value = node.value
    const data = node.data.data

    const idBase = slugify(data.variable)
    const leafId = `leaf-${idBase}`
    const parentKey = data.parentId || ""

    const width = node.x1 - node.x0
    const height = node.y1 - node.y0

    const color =
        CAUSE_OF_DEATH_CATEGORY_COLORS[parentKey as CauseOfDeathCategory] ||
        "#cccccc"

    return (
        <g
            key={idBase}
            transform={`translate(${node.x0},${node.y0 + annotationHeight})`}
            onMouseEnter={
                onMouseEnter ? (event) => onMouseEnter(node, event) : undefined
            }
            onMouseLeave={onMouseLeave}
            style={{ cursor: onMouseEnter ? "pointer" : undefined }}
        >
            {/* Colored rect */}
            <rect
                id={leafId}
                fill={color}
                fillOpacity={0.9}
                width={width}
                height={height}
                rx={2}
            />

            {/* Labels rendered by the extracted component */}
            <CausesOfDeathTreemapTileLabels
                width={width}
                height={height}
                color={color}
                variable={data.variable}
                value={value}
                numAllDeaths={numAllDeaths}
                description={description}
                isLargestTile={isLargestTile}
                treemapWidth={treemapWidth}
                treemapHeight={treemapHeight}
                isNarrow={isNarrow}
                debug={debug}
            />
        </g>
    )
}

function slugify(s: string): string {
    return s.replace(/[^a-zA-Z0-9_-]+/g, "-")
}
