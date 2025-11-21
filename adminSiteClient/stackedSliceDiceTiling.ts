import * as d3 from "d3"
import { sum } from "remeda"

/**
 * HYBRID SLICE-DICE WITH SMART IN-COLUMN STACKING
 *
 * This is a custom treemap tiling algorithm that combines the slice-dice approach
 * with intelligent stacking to handle thin rectangles more elegantly.
 *
 * ALGORITHM OVERVIEW:
 * 1) Layout children in alternating orientations (columns at even depth, rows at odd)
 * 2) Identify "too-thin" children and group them into a trailing band
 * 3) Stack thin items vertically within that band
 * 4) If stacked items are still too short, group them into a horizontal sub-row
 *
 * VISUAL EXAMPLE:
 * Given a rectangle 120x60px at depth 0 (vertical mode) with children [A:60, B:30, C:20, D:10]
 * and minSliceWidth=15, minStackHeight=12:
 *
 * Normal proportional widths would be: A=60px, B=30px, C=20px, D=10px
 * But C(20px) and D(10px) are > 15px, so only A and B go to "thin band"
 *
 * Result layout:
 * ┌─────A─────┐┌────B────┐┌thin─band┐
 * │           ││         ││  ┌─C─┐  │
 * │   (60px)  ││ (30px)  ││  │20 │  │  ← C gets full width, stacked vertically
 * │           ││         ││  └───┘  │
 * │           ││         ││ ┌─D──┐  │  ← D too short (8px), goes to horizontal row
 * └───────────┘└─────────┘└ │ 10 │ ─┘
 *                          └────┘
 *
 * EXAMPLE USAGE:
 *   const customTiler = stackedSliceDiceTiling({
 *     minSliceWidth: 12,    // Min width in primary slice direction
 *     minStackHeight: 12    // Min height for stacked items
 *   })
 *   d3.treemap().tile(customTiler)
 */

/**
 * Configuration options for the tiling algorithm
 */
interface TilingOptions {
    /** Minimum width in primary slice direction before items are moved to thin band */
    minSliceWidth?: number
    /** Minimum height for vertically stacked items before they're moved to horizontal row */
    minStackHeight?: number
}

/**
 * Internal data structure for tracking child nodes during layout
 */
interface ChildEntry<T> {
    /** The D3 hierarchy node being positioned */
    node: d3.HierarchyRectangularNode<T>
    /** The node's value (used for proportional sizing) */
    v: number
    /** The node's calculated thickness in primary direction */
    t: number
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
 * Creates a stacked slice-dice tiling function with smart stacking for thin rectangles
 *
 * @param options Configuration options for thickness thresholds
 * @returns A tiling function compatible with D3's treemap.tile()
 */
export function stackedSliceDiceTiling<T>({
    minSliceWidth = 100,
    minStackHeight = 40,
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
        // @ts-expect-error ignore
        const debug = node.data.id === "All"
        if (debug) console.log(node.data)

        // @ts-expect-error ignore
        const thinEnabled = node.data.id === "All"

        // STEP 1: BASIC SETUP AND VALIDATION
        const children = node.children
        if (!children || !children.length) return // No children to layout

        // Sort children by value (largest first)
        const sortedChildren = [...children].sort((a, b) => {
            const aVal = a.value || 0
            const bVal = b.value || 0
            return bVal - aVal // Descending order
        })

        if (debug) console.log(`Laying out ${children.length} children`)

        // Calculate available width and height
        const W = x1 - x0,
            H = y1 - y0
        if (W <= 0 || H <= 0) return // No space to work with

        if (debug) console.log(`Available space: w=${W} / h=${H}`)

        // STEP 2: DETERMINE LAYOUT ORIENTATION
        // Alternating slice/dice: even depth = columns (vertical strips), odd depth = rows (horizontal strips)
        // Example: Root (depth 0) uses columns, its children (depth 1) use rows, etc.
        const vertical = node.depth % 2 === 0 // true => columns, false => rows
        const primarySpan = vertical ? W : H
        // Note: secondarySpan would be vertical ? H : W, but it's not used in current logic

        if (debug) console.log("vertical?", vertical)
        if (debug) console.log("primary span", primarySpan)

        // STEP 3: EXTRACT VALUES AND CALCULATE PROPORTIONAL SIZES
        // Extract numeric values from each child node, ensuring non-negative values
        const vals = sortedChildren.map((c) => Math.max(0, c.value || 0))
        const total = sum(vals)
        if (total === 0) return // No values to work with

        if (debug) console.log("values", vals, total)

        // Calculate how thick each child would be in the primary direction
        // Example: If primarySpan=100px, total value=200, child value=50, then thickness=25px
        const thick = vals.map((v) => (v / total) * primarySpan)

        if (debug) console.log("thicknesses", thick)

        // STEP 4: CATEGORIZE CHILDREN BY THICKNESS
        // Since children are sorted by value (largest first), thin children must be at end (smallest)
        const keep: ChildEntry<T>[] = [] // Children thick enough for normal layout
        const thin: ChildEntry<T>[] = [] // Thin children (at the end)

        for (let i = 0; i < sortedChildren.length; i++) {
            const entry: ChildEntry<T> = {
                node: sortedChildren[i],
                v: vals[i], // original value
                t: thick[i], // calculated thickness
            }
            keep.push(entry)
        }

        // Check from the end - move thin children from keep to thin array
        // Only consider children thin if their cumulative thickness is below threshold
        if (thinEnabled && vertical) {
            let cumulativeThickness = 0
            const potentialThin: ChildEntry<T>[] = []

            // Collect children from the end while cumulative thickness is below threshold
            while (keep.length > 0) {
                const lastEntry = keep[keep.length - 1]
                const newCumulative = cumulativeThickness + lastEntry.t

                if (newCumulative < minSliceWidth) {
                    cumulativeThickness = newCumulative
                    potentialThin.unshift(keep.pop()!)
                } else {
                    break
                }
            }

            // Move all collected thin children to thin array
            thin.push(...potentialThin)
        }

        if (debug) console.log("keep", keep)
        if (debug) console.log("thin", thin)

        /**
         * HELPER FUNCTION: Layout children in a linear sequence
         *
         * Arranges a list of children proportionally within a rectangle,
         * either as vertical columns or horizontal rows.
         *
         * @param list - Array of child entries to position
         * @param X0,Y0,X1,Y1 - Bounding rectangle for this group
         *
         * EXAMPLE: If vertical=true, rectangle is (0,0,60,100), and we have 2 children
         * with values [30,20] (total=50):
         * - Child 1: gets width (30/50)*60=36px, positioned at (0,0,36,100)
         * - Child 2: gets width (20/50)*60=24px, positioned at (36,0,60,100)
         */
        function layoutPrimary(
            list: ChildEntry<T>[],
            X0: number,
            Y0: number,
            X1: number,
            Y1: number
        ): void {
            const span = vertical ? X1 - X0 : Y1 - Y0 // Available space in primary direction
            const total = sum(list.map((d) => d.v))
            if (!total || span <= 0) return

            let off = 0 // Running offset as we place each child
            for (const d of list) {
                const t = (d.v / total) * span // This child's thickness (proportional to its value)
                if (vertical) {
                    // Vertical mode: children are columns (vary in x, span full y)
                    setRect(d.node, X0 + off, Y0, X0 + off + t, Y1)
                } else {
                    // Horizontal mode: children are rows (vary in y, span full x)
                    setRect(d.node, X0, Y0 + off, X1, Y0 + off + t)
                }
                off += t // Move offset for next child
            }
        }

        // Add the thin values to the last keep entry
        let tmpKeep = undefined
        if (thin.length > 0) {
            tmpKeep = keep.map((k, i) => {
                if (i === keep.length - 1) {
                    const v = k.v + sum(thin.map((d) => d.v))
                    return {
                        ...k,
                        v: v,
                        t: (v / total) * primarySpan,
                    }
                } else {
                    return {
                        ...k,
                        t: (k.v / total) * primarySpan,
                    }
                }
            })
        }

        if (debug) console.log("adjusted keep", keep)

        // STEP 5: LAYOUT THICK-ENOUGH CHILDREN NORMALLY
        // Calculate total space needed for all "keep" children
        if (tmpKeep) {
            const tmpKeepSpan = sum(tmpKeep.map((d) => d.t))
            if (tmpKeepSpan > 0) {
                if (vertical) {
                    layoutPrimary(tmpKeep, x0, y0, x1, y1)
                } else {
                    layoutPrimary(tmpKeep, x0, y0, x1, y1)
                }
            }
        } else {
            const keepSpan = sum(keep.map((d) => d.t))
            if (keepSpan > 0) {
                if (vertical) {
                    layoutPrimary(keep, x0, y0, x1, y1)
                } else {
                    layoutPrimary(keep, x0, y0, x1, y1)
                }
            }
        }

        // The last keep node now includes the thin children,
        // so we need to adjust its rectangle to account for that
        if (thin.length > 0 && tmpKeep && tmpKeep.length > 0) {
            if (debug) console.log("tmp keep", tmpKeep)
            const lastKeep = keep[keep.length - 1].node

            const keepValue = lastKeep.value
            const thinValue = sum(thin.map((d) => d.v))
            const totalValue = keepValue! + thinValue

            if (vertical) {
                const height = H
                const keepFrac = keepValue! / totalValue
                const keepHeight = keepFrac * height
                setRect(
                    lastKeep,
                    lastKeep.x0,
                    lastKeep.y0,
                    lastKeep.x1,
                    lastKeep.y0 + keepHeight
                )

                // Position thin children stacked below the last keep
                let offset = 0
                for (const thinChild of thin) {
                    const childHeight = (thinChild.v / totalValue) * H
                    setRect(
                        thinChild.node,
                        lastKeep.x0,
                        lastKeep.y1 + offset,
                        lastKeep.x1,
                        lastKeep.y1 + offset + childHeight
                    )
                    offset += childHeight
                }
            } else {
                const width = W
                const keepFrac = keepValue! / totalValue
                const keepWidth = keepFrac * width
                setRect(
                    lastKeep,
                    lastKeep.x0,
                    lastKeep.y0,
                    lastKeep.x0 + keepWidth,
                    lastKeep.y1
                )

                // Position thin children stacked to the right of the last keep
                let offset = 0
                for (const thinChild of thin) {
                    const childWidth = (thinChild.v / totalValue) * W
                    setRect(
                        thinChild.node,
                        lastKeep.x1 + offset,
                        lastKeep.y0,
                        lastKeep.x1 + offset + childWidth,
                        lastKeep.y1
                    )
                    offset += childWidth
                }
            }

            // Skip the old STEP 6 logic since we've already handled thin children
            // return
        }

        // return

        // // STEP 6: CREATE "THIN BAND" FOR TOO-THIN CHILDREN
        // // Calculate total space needed for all "thin" children
        // const thinSpan = sum(thin.map((d) => d.t))
        // const keepSpan = sum(keep.map((d) => d.t))
        // if (thinSpan > 0) {
        //     // Define the bounding rectangle for the thin band
        //     let bx0 = x0, // band left
        //         by0 = y0, // band top
        //         bx1 = x1, // band right
        //         by1 = y1 // band bottom

        //     if (vertical) {
        //         // Vertical mode: thin band is to the right of "keep" children
        //         // Example: If keepSpan=60px, thinSpan=20px, band occupies (60, y0, 80, y1)
        //         bx0 = x0 + keepSpan
        //         bx1 = x0 + keepSpan + thinSpan
        //     } else {
        //         // Horizontal mode: thin band is below "keep" children
        //         // Example: If keepSpan=40px, thinSpan=15px, band occupies (x0, 40, x1, 55)
        //         by0 = y0 + keepSpan
        //         by1 = y0 + keepSpan + thinSpan
        //     }

        //     // STEP 7: WITHIN THIN BAND, STACK VERTICALLY BY DEFAULT
        //     // Get total value of all thin children for proportional calculations
        //     const totalThinV = sum(thin.map((d) => d.v))
        //     if (!totalThinV) return

        //     // STEP 8: SEPARATE STACKED ITEMS BY HEIGHT
        //     // Calculate how tall each thin child would be if stacked vertically,
        //     // then separate into "tall enough" vs "too short"
        //     const tall: ChildEntry<T>[] = [], // Items that are tall enough when stacked
        //         short: ChildEntry<T>[] = [] // Items too short, need horizontal layout

        //     for (const d of thin) {
        //         // Calculate height this item would get if all thin items were stacked vertically
        //         // Example: Band height=100px, totalThinV=200, this item value=30
        //         // → stackedHeight = (30/200) * 100 = 15px
        //         const stackedHeight = (d.v / totalThinV) * (by1 - by0)
        //         ;(stackedHeight >= minStackHeight ? tall : short).push(d)
        //     }

        //     // STEP 9: LAYOUT TALL ITEMS VERTICALLY FROM TOP
        //     let yOff = 0 // Running y-offset as we stack items vertically
        //     const tallTotal = sum(tall.map((d) => d.v))
        //     if (tallTotal > 0) {
        //         for (const d of tall) {
        //             // Calculate this item's height based on its proportion of total thin value
        //             // Example: totalThinV=200, item value=50, band height=100px → height=25px
        //             const h = (d.v / totalThinV) * (by1 - by0)
        //             setRect(d.node, bx0, by0 + yOff, bx1, by0 + yOff + h)
        //             yOff += h // Move down for next item
        //         }
        //     }

        //     // STEP 10: LAYOUT SHORT ITEMS HORIZONTALLY AT BOTTOM
        //     // Items too short for vertical stacking get placed side-by-side in a bottom row
        //     const shortTotal = sum(short.map((d) => d.v))
        //     if (shortTotal > 0) {
        //         // Calculate row height to preserve total area of short items
        //         // Example: shortTotal=60, totalThinV=200, band height=100px → rowHeight=30px
        //         const rowHeight = (shortTotal / totalThinV) * (by1 - by0)
        //         const ry0 = by1 - rowHeight, // Row starts this far from bottom
        //             ry1 = by1 // Row extends to bottom

        //         let xOff = 0 // Running x-offset as we place items side-by-side
        //         for (const d of short) {
        //             // Calculate this item's width based on its proportion of short items total
        //             // Example: shortTotal=60, item value=20, band width=80px → width≈26.7px
        //             const wFrac = (d.v / shortTotal) * (bx1 - bx0)
        //             setRect(d.node, bx0 + xOff, ry0, bx0 + xOff + wFrac, ry1)
        //             xOff += wFrac // Move right for next item
        //         }
        //     }
        // }

        /**
         * HELPER FUNCTION: Set rectangle coordinates on a D3 hierarchy node
         *
         * D3 treemap nodes store their position as x0,y0,x1,y1 properties
         * representing the top-left and bottom-right corners.
         *
         * @param n - The D3 node to position
         * @param X0,Y0 - Top-left corner coordinates
         * @param X1,Y1 - Bottom-right corner coordinates
         *
         * EXAMPLE: setRect(node, 10, 20, 50, 80) positions the node
         * at rectangle (10,20) to (50,80) → width=40px, height=60px
         */
        function setRect(
            n: d3.HierarchyRectangularNode<T>,
            X0: number,
            Y0: number,
            X1: number,
            Y1: number
        ): void {
            n.x0 = X0 // Left edge
            n.y0 = Y0 // Top edge
            n.x1 = X1 // Right edge
            n.y1 = Y1 // Bottom edge
        }
    }
}
