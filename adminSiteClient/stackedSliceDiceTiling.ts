import * as d3 from "d3"
import * as R from "remeda"

/**
 * Configuration options for the tiling algorithm
 */
interface TilingOptions {
    /** Minimum width in primary slice direction before items are moved to thin band */
    minColumnWidth?: number
    /** Minimum height for vertically stacked items before they're moved to horizontal row */
    minRowHeight?: number
}

interface LayoutChild<T> {
    /** The D3 hierarchy node being positioned */
    node: d3.HierarchyRectangularNode<T>
    /** The node's value (used for proportional sizing) */
    value: number
    /** The node's calculated thickness in primary direction */
    layoutSize: number
}

/**
 * Type definition for D3 treemap tiling functions
 * Takes a node and its bounding rectangle, positions all children within it
 */
export type TilingFunction<T> = (
    node: d3.HierarchyRectangularNode<T>,
    x0: number,
    y0: number,
    x1: number,
    y1: number
) => void

/**
 * Creates a stacked slice-dice tiling function with smart stacking for thin rectangles.
 *
 * This algorithm combines alternating slice-dice orientation with intelligent stacking:
 * 1. Children are sorted by value (largest first) and laid out in alternating directions
 *    (vertical strips at even depth, horizontal at odd depth)
 * 2. Children that would be too narrow/short (below minColumnWidth/minRowHeight) are
 *    identified and separated into a "stacked" group
 * 3. The last normal child is expanded to include the space for stacked children
 * 4. Stacked children are positioned within that expanded space, perpendicular to the
 *    primary layout direction
 *
 * This prevents thin slivers that are hard to read or click, while maintaining
 * proportional area representation.
 */
export function stackedSliceDiceTiling<T>({
    minColumnWidth = 0,
    minRowHeight = 0,
}: TilingOptions = {}): TilingFunction<T> {
    /**
     * The actual tiling function that D3 will call for each node
     *
     * @param node - The parent node whose children need to be positioned
     * @param x0,y0,x1,y1 - Bounding rectangle (top-left and bottom-right corners)
     *
     * EXAMPLE: If node has value=100 and 3 children with values [30,50,20]
     * and we're in vertical mode with rectangle (0,0,100,50):
     * - Child 1 gets width: (30/100) * 100 = 30px
     * - Child 2 gets width: (50/100) * 100 = 50px
     * - Child 3 gets width: (20/100) * 100 = 20px
     */
    return function tile(
        node: d3.HierarchyRectangularNode<T>,
        x0: number,
        y0: number,
        x1: number,
        y1: number
    ): void {
        // TODO: Remove debug code
        // @ts-expect-error ignore
        const debug =
            node.data.id === "Maternal, neonatal and nutritional diseases"
        if (debug) console.log(node.data)

        // console.log(node.data.id)

        // Alternating slice/dice:
        // - even depth = columns (vertical strips)
        // - odd depth = rows (horizontal strips)
        const vertical = node.depth % 2 === 0
        const minWidth = vertical ? minColumnWidth : minRowHeight

        // Sort children by value descending (larger children are laid out first)
        const children = R.sortBy(node.children ?? [], [
            (child) => child.value || 0,
            "desc",
        ])

        // No children to layout
        if (!children || !children.length) return

        // Calculate available width and height
        const width = x1 - x0
        const height = y1 - y0

        // No space to work with
        if (width <= 0 || height <= 0) return

        // Determine primary span based on orientation
        const primarySpan = vertical ? width : height
        const secondarySpan = vertical ? height : width
        if (debug) console.log("vertical?", vertical)
        if (debug) console.log("primary span", primarySpan)

        // Extract numeric values from each child node (ensuring non-negative values)
        const values = children.map((c) => Math.max(0, c.value || 0))
        const total = R.sum(values)

        // No values to work with
        if (total === 0) return

        if (debug) console.log("values", values, total)

        // Helper: Convert value to proportional layout size
        // Example: If primarySpan=100px, total value=200, child value=50, then layout size=25px
        const toLayoutSize = (v: number): number => (v / total) * primarySpan

        // keepChildren are laid out normally (unless deemed "too thin")
        const keepChildren: LayoutChild<T>[] = children.map((child, i) => ({
            node: child,
            value: values[i],
            // Calculate the size each child would take in the primary direction
            layoutSize: toLayoutSize(values[i]),
        }))

        // Find children that are too thin with laid out normally
        let cumulativeSize = 0
        const stackedChildren: LayoutChild<T>[] = []
        while (keepChildren.length > 0) {
            const lastKeepChild = keepChildren[keepChildren.length - 1]

            cumulativeSize += lastKeepChild.layoutSize
            if (cumulativeSize >= minWidth) break

            stackedChildren.unshift(keepChildren.pop()!)
        }

        const stackedChildrenSum = R.sumBy(
            stackedChildren,
            (child) => child.value
        )

        if (debug) console.log("keep", keepChildren)
        if (debug) console.log("thin", stackedChildren)

        // Add the values of the children to be stacked to the last keep entry
        let adjustedKeepChildren = undefined
        if (stackedChildren.length > 0) {
            // First, add stacked values to the last keep entry
            const lastIndex = keepChildren.length - 1
            keepChildren[lastIndex] = {
                ...keepChildren[lastIndex],
                value: keepChildren[lastIndex].value + stackedChildrenSum,
            }

            // Then recalculate layout sizes for all entries
            adjustedKeepChildren = keepChildren.map((k) => ({
                ...k,
                layoutSize: toLayoutSize(k.value),
            }))
        }

        if (debug) console.log("adjusted keep", keepChildren)

        // Layout the keep children normally
        const layoutChildren = adjustedKeepChildren ?? keepChildren
        const keepSpan = R.sum(layoutChildren.map((d) => d.layoutSize))
        if (keepSpan > 0) {
            layoutChildrenSequentially(
                layoutChildren,
                { x0, y0, x1, y1 },
                vertical
            )
        }

        // If the last keep node includes the stacked children,
        // then we need to adjust its rectangle to account for that,
        // and lay out the stacked children within that space
        if (stackedChildren.length > 0) {
            if (debug) console.log("tmp keep", adjustedKeepChildren)

            const lastKeepChild = keepChildren[keepChildren.length - 1].node
            const lastKeepChildValue = lastKeepChild.value ?? 0
            const totalValue = lastKeepChildValue + stackedChildrenSum
            const keepFrac = lastKeepChildValue / totalValue
            const keepSize = keepFrac * secondarySpan

            // Update the last keep child's rectangle to only take its proportional space
            setRect(
                lastKeepChild,
                vertical
                    ? { y1: lastKeepChild.y0 + keepSize }
                    : { x1: lastKeepChild.x0 + keepSize }
            )

            // Layout stacked children in the remaining space
            layoutChildrenSequentially(
                stackedChildren,
                vertical
                    ? {
                          x0: lastKeepChild.x0,
                          y0: lastKeepChild.y1,
                          x1: lastKeepChild.x1,
                          y1: y1,
                      }
                    : {
                          x0: lastKeepChild.x1,
                          y0: lastKeepChild.y0,
                          x1: x1,
                          y1: lastKeepChild.y1,
                      },
                !vertical // Stacked children use perpendicular orientation
            )
        }
    }
}

/**
 * Layout children in a linear sequence
 *
 * Arranges a list of children proportionally within a rectangle,
 * either as vertical columns or horizontal rows.
 *
 * EXAMPLE: If vertical=true, rectangle is (0,0,60,100), and we have 2 children
 * with values [30,20] (total=50):
 * - Child 1: gets width (30/50)*60=36px, positioned at (0,0,36,100)
 * - Child 2: gets width (20/50)*60=24px, positioned at (36,0,60,100)
 */
function layoutChildrenSequentially<T>(
    list: LayoutChild<T>[],
    rect: { x0: number; y0: number; x1: number; y1: number },
    vertical: boolean
): void {
    const { x0, y0, x1, y1 } = rect

    const primarySpan = vertical ? x1 - x0 : y1 - y0
    const total = R.sum(list.map((d) => d.value))
    if (!total || primarySpan <= 0) return

    let off = 0 // Running offset as we place each child
    for (const d of list) {
        const t = (d.value / total) * primarySpan // This child's thickness (proportional to its value)
        if (vertical) {
            // Vertical mode: children are columns (vary in x, span full y)
            setRect(d.node, { x0: x0 + off, y0: y0, x1: x0 + off + t, y1: y1 })
        } else {
            // Horizontal mode: children are rows (vary in y, span full x)
            setRect(d.node, { x0: x0, y0: y0 + off, x1: x1, y1: y0 + off + t })
        }
        off += t // Move offset for next child
    }
}

/** Set rectangle coordinates on a D3 hierarchy node */
function setRect<T>(
    node: d3.HierarchyRectangularNode<T>,
    rect: { x0?: number; y0?: number; x1?: number; y1?: number }
): void {
    if (rect.x0 !== undefined) node.x0 = rect.x0 // Left edge
    if (rect.y0 !== undefined) node.y0 = rect.y0 // Top edge
    if (rect.x1 !== undefined) node.x1 = rect.x1 // Right edge
    if (rect.y1 !== undefined) node.y1 = rect.y1 // Bottom edge
}
