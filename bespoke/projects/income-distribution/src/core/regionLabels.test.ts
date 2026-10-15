import * as R from "remeda"
import { describe, expect, it } from "vitest"

import { placeRegionLabels, type RegionBandPixels } from "./regionLabels.js"

/** A flat band from x = 0 to `width`, between `top` and `top + height` */
function rectangle(
    width: number,
    top: number,
    height: number
): RegionBandPixels {
    return {
        region: "South Asia",
        points: R.range(0, 51).map((i) => ({
            x: (i / 50) * width,
            top,
            bottom: top + height,
        })),
    }
}

describe(placeRegionLabels, () => {
    it("centres the label in a roomy band at the largest font size", () => {
        const [label] = placeRegionLabels([rectangle(400, 100, 100)])
        expect(label.region).toBe("South Asia")
        expect(label.fontSize).toBe(13)
        expect(label.x).toBeCloseTo(200, -1)
        expect(label.y).toBeCloseTo(150, -1)
    })

    it("picks a font size no taller than the band allows", () => {
        const [label] = placeRegionLabels([rectangle(400, 0, 16)])
        expect(label.fontSize).toBeLessThan(13)
        expect(label.fontSize).toBeLessThanOrEqual(16 * 0.65)
    })

    it("shrinks the label to fit a narrow band", () => {
        // "South Asia" at 13px is ~80px wide, which with the comfort margin
        // needs a band ~110px wide
        const [label] = placeRegionLabels([rectangle(80, 0, 100)])
        expect(label.fontSize).toBe(9)
    })

    it("leaves out a band too thin to label", () => {
        expect(placeRegionLabels([rectangle(400, 0, 8)])).toEqual([])
    })

    it("labels each band that fits, in input order", () => {
        const labels = placeRegionLabels([
            { ...rectangle(400, 0, 100), region: "Sub-Saharan Africa" },
            rectangle(400, 100, 4),
            { ...rectangle(400, 104, 100), region: "North America" },
        ])
        expect(labels.map((l) => l.region)).toEqual([
            "Sub-Saharan Africa",
            "North America",
        ])
    })

    it("respects custom font sizes", () => {
        const [label] = placeRegionLabels([rectangle(400, 0, 100)], {
            fontSizes: [20, 30],
        })
        expect(label.fontSize).toBe(30)
    })
})
