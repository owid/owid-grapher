/**
 * The sentence each empty corner makes, wrapped into its triangle.
 *
 * The wedge is a right-isosceles triangle with its right angle at the bottom-right of the plot. Lines
 * are right-aligned against the panel's edge and numbered from the top; line i's glyphs sit around
 * height pad + (n-1-i)*lh + 0.65*lh above the baseline, and its room is the wedge's width at that
 * height, less the padding and an inset from the hypotenuse -- so the top line is the shortest and
 * the bottom line the longest. The smallest number of lines whose greedy fill takes every word wins,
 * at the largest size that manages it.
 */

export const WEDGE_LABEL_SIZES = [10, 9, 8]
export const WEDGE_LABEL_SIZES_SMALL = [7, 6.5]
export const WEDGE_LABEL_PAD = 5
export const WEDGE_LABEL_WEIGHT = 400
/** Clear of the hypotenuse */
export const WEDGE_LABEL_INSET = 4

const FONT_STACK = 'Lato, "Helvetica Neue", Helvetica, Arial, sans-serif'

let measureContext: CanvasRenderingContext2D | null | undefined

export function textWidth(
    text: string,
    px: number,
    weight: number = WEDGE_LABEL_WEIGHT
): number {
    if (measureContext === undefined)
        measureContext =
            typeof document === "undefined"
                ? null
                : document.createElement("canvas").getContext("2d")
    // No canvas (server, tests): a conservative average glyph width
    if (!measureContext) return text.length * px * 0.55
    measureContext.font = `${weight} ${px}px ${FONT_STACK}`
    return measureContext.measureText(text).width
}

export interface WrappedLabel {
    lines: string[]
    px: number
    lh: number
}

/** Wrap `text` into the wedge with legs `aW` x `aH`; null if it fits at none of the sizes */
export function wrapIntoWedge(
    text: string,
    aW: number,
    aH: number,
    sizes: number[] = WEDGE_LABEL_SIZES
): WrappedLabel | null {
    const words = text.split(" ")
    for (const px of sizes) {
        const lh = Math.round(px * 1.15 * 10) / 10
        for (let n = 1; n <= 8; n++) {
            // Line i's baseline sits PAD + (n-1-i)*lh + 0.2*lh above the bottom; its cap line 0.72*px higher.
            const limits = Array.from(
                { length: n },
                (_, i) =>
                    aW *
                        (1 -
                            (WEDGE_LABEL_PAD +
                                (n - 1 - i) * lh +
                                0.2 * lh +
                                0.72 * px) /
                                aH) -
                    WEDGE_LABEL_PAD -
                    WEDGE_LABEL_INSET
            )
            if (limits.some((l) => l < 10)) continue
            const lines: string[] = []
            let w = 0
            for (let i = 0; i < n; i++) {
                let cur = ""
                while (w < words.length) {
                    const cand = cur ? cur + " " + words[w] : words[w]
                    if (textWidth(cand, px) <= limits[i]) {
                        cur = cand
                        w++
                    } else break
                }
                if (!cur) break
                lines.push(cur)
            }
            if (w === words.length && lines.length === n)
                return { lines, px, lh }
        }
    }
    return null
}
