import { expect, it, describe } from "vitest"
import { findLastMapColorScaleEdit, type Log } from "./adminChartApi.js"

const log = (
    userName: string,
    createdAt: string,
    colorScale: Record<string, unknown> | undefined
): Log => ({
    userId: 1,
    userName,
    createdAt,
    config: { map: { colorScale } },
})

describe(findLastMapColorScaleEdit, () => {
    it("reports the revision that changed the color scale", () => {
        const edit = findLastMapColorScaleEdit([
            log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
            log("Grace", "2026-02-11", { baseColorScheme: "Blues" }),
            log("Grace", "2026-02-10", { baseColorScheme: "Reds" }),
        ])

        // Ada's revision left the scale alone, so Grace is still the answer.
        expect(edit).toEqual({ userName: "Grace", createdAt: "2026-02-11" })
    })

    it("returns nothing when the scale was never touched", () => {
        expect(
            findLastMapColorScaleEdit([
                log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
                log("Grace", "2026-02-11", { baseColorScheme: "Blues" }),
            ])
        ).toBeUndefined()
    })

    it("returns nothing for a chart with no history to compare", () => {
        expect(findLastMapColorScaleEdit([])).toBeUndefined()
        expect(
            findLastMapColorScaleEdit([log("Ada", "2026-03-02", undefined)])
        ).toBeUndefined()
    })

    it("counts adding a color scale to a chart that had none", () => {
        const edit = findLastMapColorScaleEdit([
            log("Ada", "2026-03-02", { baseColorScheme: "Blues" }),
            log("Ada", "2026-03-01", undefined),
        ])

        expect(edit).toEqual({ userName: "Ada", createdAt: "2026-03-02" })
    })
})
