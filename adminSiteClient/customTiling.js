// Hybrid slice–dice with smart in-column stacking.
// 1) As usual, lay out children in primary orientation (columns at even depth, rows at odd).
// 2) Group primary-direction "too-thin" children into a trailing band.
// 3) Inside that band, stack items vertically (below each other).
// 4) BUT: if some stacked items would be too short (< innerMinThickness), group those few
//    into a small horizontal sub-row at the bottom (placed next to each other).
//
// Usage:
//   d3.treemap().tile(hybridSliceDiceSmartStack({ minThickness: 12, innerMinThickness: 12 }))
function hybridSliceDiceSmartStack({
    minThickness = 12,
    innerMinThickness = 12,
} = {}) {
    return function tile(node, x0, y0, x1, y1) {
        const children = node.children
        if (!children || !children.length) return

        const W = x1 - x0,
            H = y1 - y0
        if (W <= 0 || H <= 0) return

        // Flipped alternation: even depth => dice (columns), odd => slice (rows)
        const vertical = (node.depth & 1) === 0 // true => columns, false => rows
        const primarySpan = vertical ? W : H
        const secondarySpan = vertical ? H : W

        const vals = children.map((c) => Math.max(0, c.value || 0))
        const total = vals.reduce((s, v) => s + v, 0)
        if (total === 0) return

        // Primary thickness each child would get (column width or row height)
        const thick = vals.map((v) => (primarySpan * v) / total)

        // Split into keep vs thin (by primary thickness)
        const keep = [],
            thin = []
        for (let i = 0; i < children.length; i++) {
            const entry = { node: children[i], v: vals[i], t: thick[i] }
            ;(entry.t >= minThickness ? keep : thin).push(entry)
        }

        // Helper: lay out a list linearly in the primary direction (no recursion)
        function layoutPrimary(list, X0, Y0, X1, Y1) {
            const span = vertical ? X1 - X0 : Y1 - Y0
            const tot = list.reduce((s, d) => s + d.v, 0)
            if (!tot || span <= 0) return
            let off = 0
            for (const d of list) {
                const t = (span * d.v) / tot
                if (vertical) {
                    setRect(d.node, X0 + off, Y0, X0 + off + t, Y1)
                } else {
                    setRect(d.node, X0, Y0 + off, X1, Y0 + off + t)
                }
                off += t
            }
        }

        // 1) Lay out "keep" in primary orientation
        const keepSpan = keep.reduce((s, d) => s + d.t, 0)
        if (keepSpan > 0) {
            if (vertical) layoutPrimary(keep, x0, y0, x0 + keepSpan, y1)
            else layoutPrimary(keep, x0, y0, x1, y0 + keepSpan)
        }

        // 2) Thin band: allocate its natural combined span
        const thinSpan = thin.reduce((s, d) => s + d.t, 0)
        if (thinSpan > 0) {
            let bx0 = x0,
                by0 = y0,
                bx1 = x1,
                by1 = y1
            if (vertical) {
                bx0 = x0 + keepSpan
                bx1 = x0 + keepSpan + thinSpan
            } else {
                by0 = y0 + keepSpan
                by1 = y0 + keepSpan + thinSpan
            }

            // 3) Inside the thin band, default = vertical stacking (below each other)
            const totalThinV = thin.reduce((s, d) => s + d.v, 0)
            if (!totalThinV) return

            // Compute each item's *stacked height* to see who's too short
            const tall = [],
                short = []
            for (const d of thin) {
                const stackedHeight = (d.v / totalThinV) * (by1 - by0) // height if stacked vertically
                ;(stackedHeight >= innerMinThickness ? tall : short).push(d)
            }

            // 3a) Lay out tall items stacked vertically from the top
            let yOff = 0
            const tallTotal = tall.reduce((s, d) => s + d.v, 0)
            if (tallTotal > 0) {
                for (const d of tall) {
                    const h = (d.v / totalThinV) * (by1 - by0)
                    setRect(d.node, bx0, by0 + yOff, bx1, by0 + yOff + h)
                    yOff += h
                }
            }

            // 4) Short items go into a single bottom row (placed next to each other).
            const shortTotal = short.reduce((s, d) => s + d.v, 0)
            if (shortTotal > 0) {
                const rowHeight = (shortTotal / totalThinV) * (by1 - by0) // preserve total area
                const ry0 = by1 - rowHeight,
                    ry1 = by1
                let xOff = 0
                for (const d of short) {
                    const wFrac = (d.v / shortTotal) * (bx1 - bx0)
                    setRect(d.node, bx0 + xOff, ry0, bx0 + xOff + wFrac, ry1)
                    xOff += wFrac
                }
            }
        }

        function setRect(n, X0, Y0, X1, Y1) {
            n.x0 = X0
            n.y0 = Y0
            n.x1 = X1
            n.y1 = Y1
        }
    }
}

export { hybridSliceDiceSmartStack }
