import * as R from "remeda"
import { match } from "ts-pattern"

import { Bounds } from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components/src/MarkdownTextWrap/MarkdownTextWrap.js"

import { DataRow, getRegionColor, TreeNode } from "./ConflictDeathsConstants.js"
import {
    formatShare,
    maxBy,
    minBy,
    regionArticle,
} from "./ConflictDeathsHelpers.js"

export interface Region {
    name: string
    total: number
    share: number
    nodes: TreeNode[]
}

export interface TextFragment {
    text: string
    style?: { fontWeight?: number; fill?: string }
}

export interface PlacedRegion extends Region {
    textFragments: TextFragment[]
    bounds: Bounds
    placement: "top" | "bottom"
    arrowAnchor: "left" | "right"
    textAnchor: "start" | "end"
    fontSize: number
}

export function placeExternalRegionAnnotations({
    data,
    treemapBounds,
    treemapNodes,
    annotationHeight,
}: {
    data: DataRow[]
    treemapBounds: Bounds
    treemapNodes: TreeNode[]
    annotationHeight: number
}): PlacedRegion[] {
    // Calculate deaths per region and sort by totals
    const numAllDeaths = R.sumBy(data, (d) => d.value)
    const sortedRegions: Region[] = R.pipe(
        data,
        R.map((row) => ({ name: row.region, total: row.value ?? 0 })),
        R.filter((region) => region.name !== undefined),
        R.groupBy((region) => region.name),
        R.mapValues((regions) => R.sumBy(regions, (region) => region.total)),
        Object.entries,
        R.map(([name, total]) => ({
            name,
            total,
            share: total / numAllDeaths,
            nodes: getNodesForRegion(treemapNodes, name),
        })),
        R.sortBy((region) => -region.share)
    )

    const placedRegions: PlacedRegion[] = []
    for (const region of sortedRegions) {
        for (const placement of ["top", "bottom"] as const) {
            const placedRegion = placeExternalRegionAnnotation({
                region,
                placement,
                annotationHeight,
                context: { placedRegions, treemapBounds, treemapNodes },
            })
            if (placedRegion) {
                placedRegions.push(placedRegion)
                break
            }
        }
    }

    return placedRegions
}

function placeExternalRegionAnnotation({
    region,
    placement,
    annotationHeight,
    context: { placedRegions, treemapBounds, treemapNodes },
}: {
    region: Region
    placement: "top" | "bottom"
    annotationHeight: number
    context: {
        placedRegions: PlacedRegion[]
        treemapBounds: Bounds
        treemapNodes: TreeNode[]
    }
}): PlacedRegion | undefined {
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
    const visibleNodes = region.nodes.filter(isVisible)
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
    const regionColor = getRegionColor(region.name)
    const textFragments = [
        {
            text: formatShare(region.share),
            style: { fontWeight: 700 },
        },
        { text: ` died in ${regionArticle(region.name)}` },
        {
            text: region.name,
            style: { fontWeight: 700, fill: regionColor },
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
    const relevantPlacedRegions = placedRegions.filter(
        (c) => c.placement === placement
    )
    const placedBounds = combineBounds(
        relevantPlacedRegions.map((c) => c.bounds)
    )

    const y = placement === "top" ? treemapY : treemapY + annotationHeight
    const annotationWidth = arrowWidth + textWidth
    const padding = R.clamp(0.33 * nodesWidth, { max: 30, min: 20 })

    const candidates: {
        x: number
        arrowAnchor: PlacedRegion["arrowAnchor"]
        textAnchor: PlacedRegion["textAnchor"]
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
                ...region,
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

function getNodesForRegion(treeNodes: TreeNode[], regionName: string) {
    return treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const region = nodeData.region
        return region === regionName
    })
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
