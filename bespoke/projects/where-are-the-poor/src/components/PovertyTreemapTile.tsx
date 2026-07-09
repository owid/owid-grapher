import { Bounds } from "@ourworldindata/utils"
import { getGroupColor, TreeNode } from "../helpers/PovertyConstants.js"

import { PovertyTreemapTileLabels } from "./PovertyTreemapTileLabels.js"

export function PovertyTreemapTile({
    node,
    treemapBounds,
    translateY,
    onMouseEnter,
    onMouseLeave,
}: {
    node: TreeNode
    treemapBounds: Bounds
    translateY: number
    onMouseEnter: (node: TreeNode, event: React.MouseEvent) => void
    onMouseLeave: () => void
}): React.ReactElement | null {
    const { value, share, group } = node.data.data

    if (value === undefined || share === undefined) return null

    const width = node.x1 - node.x0
    const height = node.y1 - node.y0

    if (!Number.isFinite(width) || !Number.isFinite(height)) return null

    const color = getGroupColor(group)

    return (
        <g
            transform={`translate(${node.x0},${node.y0 + translateY})`}
            onMouseEnter={(event) => onMouseEnter(node, event)}
            onMouseLeave={onMouseLeave}
        >
            <rect fill={color} width={width} height={height} rx={2} />

            <PovertyTreemapTileLabels
                node={node}
                width={width}
                height={height}
                color={color}
                treemapBounds={treemapBounds}
            />
        </g>
    )
}
