import { Bounds } from "@ourworldindata/utils"
import { getCategoryColor, TreeNode } from "./CausesOfDeathConstants"

import { CausesOfDeathTreemapTileLabels } from "./CausesOfDeathTreemapTileLabels"

export function CausesOfDeathTreemapTile({
    node,
    treemapBounds,
    translateY,
    isLargestTile,
    onMouseEnter,
    onMouseLeave,
}: {
    node: TreeNode
    treemapBounds: Bounds
    translateY: number
    isLargestTile: boolean
    onMouseEnter: (node: TreeNode, event: React.MouseEvent) => void
    onMouseLeave: () => void
}): React.ReactElement | null {
    const { value, share, category } = node.data.data

    if (value === undefined || share === undefined) return null

    const width = node.x1 - node.x0
    const height = node.y1 - node.y0

    const color = getCategoryColor(category)

    return (
        <g
            transform={`translate(${node.x0},${node.y0 + translateY})`}
            onMouseEnter={(event) => onMouseEnter(node, event)}
            onMouseLeave={onMouseLeave}
        >
            <rect fill={color} width={width} height={height} rx={2} />

            <CausesOfDeathTreemapTileLabels
                node={node}
                width={width}
                height={height}
                color={color}
                isLargestTile={isLargestTile}
                treemapBounds={treemapBounds}
            />
        </g>
    )
}
