import * as R from "remeda"
import { Bounds } from "@ourworldindata/utils"
import {
    DataRow,
    getCategoryColor,
    TreeNode,
} from "./CausesOfDeathConstants.js"
import { formatShare, maxBy, minBy } from "./CausesOfDeathHelpers.js"
import { match } from "ts-pattern"
import { MarkdownTextWrap } from "@ourworldindata/components"

export interface Category {
    name: string
    total: number
    share: number
}

export interface TextFragment {
    text: string
    style?: { fontWeight?: number; fill?: string }
}

export interface PlacedCategory extends Category {
    textFragments: TextFragment[]
    bounds: Bounds
    placement: "top" | "bottom"
    arrowAnchor: "left" | "right"
    textAnchor: "start" | "end"
    fontSize: number
}

export function placeExternalCategoryAnnotations({
    data,
    treemapBounds,
    treemapNodes,
    annotationHeight,
}: {
    data: DataRow[]
    treemapBounds: Bounds
    treemapNodes: TreeNode[]
    annotationHeight: number
}): PlacedCategory[] {
    // Calculate deaths per category and sort by totals
    const numAllDeaths = R.sumBy(data, (d) => d.value)
    const sortedCategories: Category[] = R.pipe(
        data,
        R.map((row) => ({ name: row.category, total: row.value ?? 0 })),
        R.filter((category) => category.name !== undefined),
        R.groupBy((category) => category.name),
        R.mapValues((categories) =>
            R.sumBy(categories, (category) => category.total)
        ),
        Object.entries,
        R.map(([name, total]) => ({
            name,
            total,
            share: total / numAllDeaths,
        })),
        R.sortBy((category) => -category.share)
    )

    const placedCategories: PlacedCategory[] = []
    for (const category of sortedCategories) {
        for (const placement of ["top", "bottom"] as const) {
            const placedCategory = placeExternalCategoryAnnotation({
                category,
                placement,
                annotationHeight,
                context: { placedCategories, treemapBounds, treemapNodes },
            })
            if (placedCategory) {
                placedCategories.push(placedCategory)
                break
            }
        }
    }

    return placedCategories
}

function placeExternalCategoryAnnotation({
    category,
    placement,
    annotationHeight,
    context: { placedCategories, treemapBounds, treemapNodes },
}: {
    category: Category
    placement: "top" | "bottom"
    annotationHeight: number
    context: {
        placedCategories: PlacedCategory[]
        treemapBounds: Bounds
        treemapNodes: TreeNode[]
    }
}): PlacedCategory | undefined {
    const getY = match(placement)
        .with("top", () => (node: TreeNode) => node.y0)
        .with("bottom", () => (node: TreeNode) => node.y1)
        .exhaustive()

    const treemapY = match(placement)
        .with("top", () => minBy(treemapNodes, getY))
        .with("bottom", () => maxBy(treemapNodes, getY))
        .exhaustive()

    // Check if there are any nodes that align with the top/bottom of the treemap
    const categoryNodes = getNodesForCategory(treemapNodes, category.name)
    const relevantNodes = categoryNodes.filter(
        (node) => getY(node) === treemapY
    )
    if (relevantNodes.length === 0) return undefined

    const left = minBy(relevantNodes, (node) => node.x0)
    const right = maxBy(relevantNodes, (node) => node.x1)
    const nodesWidth = right - left

    const fontSize = Math.min(18, Math.max(12, treemapBounds.width / 50))
    const fontWeight = 500
    const arrowWidth = 75 // space for the arrow and a bit of padding

    // Construct label
    const categoryColor = getCategoryColor(category.name)
    const textFragments = [
        {
            text: formatShare(category.share),
            style: { fontWeight: 700 },
        },
        { text: " died from " },
        {
            text: category.name.toLowerCase(),
            style: { fontWeight: 700, fill: categoryColor },
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
    const relevantPlacedCategories = placedCategories.filter(
        (c) => c.placement === placement
    )
    const placedBounds = combineBounds(
        relevantPlacedCategories.map((c) => c.bounds)
    )

    const y = placement === "top" ? treemapY : treemapY + annotationHeight
    const annotationWidth = arrowWidth + textWidth
    const padding = R.clamp(0.33 * nodesWidth, { max: 30, min: 20 }) // TODO: something is off with the padding

    const candidates: {
        x: number
        arrowAnchor: PlacedCategory["arrowAnchor"]
        textAnchor: PlacedCategory["textAnchor"]
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
                ...category,
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

function getNodesForCategory(treeNodes: TreeNode[], categoryName: string) {
    return treeNodes.filter((leaf) => {
        const nodeData = leaf.data.data
        const category = nodeData.category
        return category === categoryName
    })
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
