import * as R from "remeda"
import { match } from "ts-pattern"

import { Bounds } from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrap.js"

import {
    DataRow,
    formatGroupLabel,
    getGroupColor,
    GroupBy,
    TreeNode,
} from "./PovertyConstants.js"
import { getGroupForRow } from "./PovertyData.js"
import { formatShare, maxBy, minBy } from "./PovertyHelpers.js"

export interface Group {
    name: string
    total: number
    share: number
    nodes: TreeNode[]
}

export interface TextFragment {
    text: string
    style?: { fontWeight?: number; fill?: string }
}

export interface PlacedGroup extends Group {
    textFragments: TextFragment[]
    bounds: Bounds
    placement: "top" | "bottom"
    arrowAnchor: "left" | "right"
    textAnchor: "start" | "end"
    fontSize: number
}

export function placeExternalGroupAnnotations({
    data,
    groupBy,
    treemapBounds,
    treemapNodes,
    annotationHeight,
}: {
    data: DataRow[]
    groupBy: GroupBy
    treemapBounds: Bounds
    treemapNodes: TreeNode[]
    annotationHeight: number
}): PlacedGroup[] {
    // Calculate the number of poor people per group and sort by totals
    const numTotalPoor = R.sumBy(data, (d) => d.headcount)
    const sortedGroups: Group[] = R.pipe(
        data,
        R.map((row) => ({
            name: getGroupForRow(row, groupBy),
            total: row.headcount ?? 0,
        })),
        R.groupBy((group) => group.name),
        R.mapValues((groups) => R.sumBy(groups, (group) => group.total)),
        Object.entries,
        R.map(([name, total]) => ({
            name,
            total,
            share: total / numTotalPoor,
            nodes: getNodesForGroup(treemapNodes, name),
        })),
        R.sortBy((group) => -group.share)
    )

    const placedGroups: PlacedGroup[] = []
    for (const group of sortedGroups) {
        for (const placement of ["top", "bottom"] as const) {
            const placedGroup = placeExternalGroupAnnotation({
                group,
                placement,
                annotationHeight,
                context: { placedGroups, treemapBounds, treemapNodes },
            })
            if (placedGroup) {
                placedGroups.push(placedGroup)
                break
            }
        }
    }

    return placedGroups
}

function placeExternalGroupAnnotation({
    group,
    placement,
    annotationHeight,
    context: { placedGroups, treemapBounds, treemapNodes },
}: {
    group: Group
    placement: "top" | "bottom"
    annotationHeight: number
    context: {
        placedGroups: PlacedGroup[]
        treemapBounds: Bounds
        treemapNodes: TreeNode[]
    }
}): PlacedGroup | undefined {
    const getY = match(placement)
        .with("top", () => (node: TreeNode) => node.y0)
        .with("bottom", () => (node: TreeNode) => node.y1)
        .exhaustive()

    const treemapY = match(placement)
        .with("top", () => minBy(treemapNodes, getY))
        .with("bottom", () => maxBy(treemapNodes, getY))
        .exhaustive()

    // Check if there are any visible nodes that align with the top/bottom
    // of the treemap
    const visibleNodes = group.nodes.filter(isVisible)
    const relevantNodes = visibleNodes.filter(
        (node) => Math.abs(getY(node) - treemapY) <= 3
    )
    if (relevantNodes.length === 0) return undefined

    const left = minBy(relevantNodes, (node) => node.x0)
    const right = maxBy(relevantNodes, (node) => node.x1)
    const nodesWidth = right - left

    const fontSize = Math.min(18, Math.max(12, treemapBounds.width / 50))
    const fontWeight = 500
    const arrowWidth = 75 // space for the arrow and a bit of padding

    // Construct label
    const groupColor = getGroupColor(group.name)
    const textFragments = [
        {
            text: formatShare(group.share),
            style: { fontWeight: 700 },
        },
        { text: " live in " },
        {
            text: formatGroupLabel(group.name),
            style: { fontWeight: 700, fill: groupColor },
        },
    ]
    const label = markdownFromFragments(textFragments)
    const textWrap = new MarkdownTextWrap({
        text: label,
        maxWidth: Infinity, // no wrapping
        fontSize,
        fontWeight,
    })
    const textWidth = textWrap.width

    // Bounds of already placed annotations
    const relevantPlacedGroups = placedGroups.filter(
        (g) => g.placement === placement
    )
    const placedBounds = combineBounds(
        relevantPlacedGroups.map((g) => g.bounds)
    )

    const y = placement === "top" ? treemapY : treemapY + annotationHeight
    const annotationWidth = arrowWidth + textWidth
    const padding = R.clamp(0.33 * nodesWidth, { max: 30, min: 20 })

    const candidates: {
        x: number
        arrowAnchor: PlacedGroup["arrowAnchor"]
        textAnchor: PlacedGroup["textAnchor"]
    }[] = [
        // arrow is on the left, annotation text to the right
        { x: left, arrowAnchor: "left", textAnchor: "start" },

        // arrow is on the left, annotation text to the left
        {
            x: left - annotationWidth + padding,
            arrowAnchor: "left",
            textAnchor: "end",
        },

        // arrow is on the right, annotation text to the left
        { x: right - annotationWidth, arrowAnchor: "right", textAnchor: "end" },

        // arrow is on the right, annotation text to the right
        { x: right - padding, arrowAnchor: "right", textAnchor: "start" },
    ]

    for (const { x, arrowAnchor, textAnchor } of candidates) {
        const bounds = new Bounds(x, y, annotationWidth, annotationHeight)

        // Check if within the treemap bounds
        const isContainedInTreemap =
            bounds.left >= treemapBounds.left &&
            bounds.right <= treemapBounds.right
        if (!isContainedInTreemap) continue

        // Check for overlap with previously placed annotations
        if (!placedBounds || !bounds.hasHorizontalOverlap(placedBounds))
            return {
                ...group,
                bounds,
                placement,
                arrowAnchor,
                textAnchor,
                textFragments,
                fontSize,
            }
    }

    return undefined
}

function getNodesForGroup(treeNodes: TreeNode[], groupName: string) {
    return treeNodes.filter((leaf) => leaf.data.data.group === groupName)
}

function isVisible(node: TreeNode) {
    return node.x1 - node.x0 > 0 && node.y1 - node.y0 > 0
}

function combineBounds(bounds: Bounds[]): Bounds | undefined {
    if (bounds.length === 0) return undefined
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

function markdownFromFragments(fragments: TextFragment[]) {
    return fragments
        .map((fragment) => {
            const { fontWeight = 400 } = fragment.style || {}
            return fontWeight > 400 ? `**${fragment.text}**` : fragment.text
        })
        .join("")
}
