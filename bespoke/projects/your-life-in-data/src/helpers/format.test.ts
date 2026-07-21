import { describe, it, expect } from "vitest"
import { changePhrase } from "./format.js"

describe("changePhrase", () => {
    it("reports the point difference for a tiny move on a bounded score, instead of a misleading ratio", () => {
        // Germany's political corruption index, 2026-07-21 Slack feedback (Bastian):
        // 0.01 -> 0.02 rendered as "≈ doubled", which overstates a move this small.
        expect(changePhrase("relative", "number", 0.01, 0.02)).toBe("+0.01")
    })

    it("still reports a real doubling for a large-enough score move", () => {
        expect(changePhrase("relative", "number", 0.2, 0.42)).toBe("≈ doubled")
    })

    it("keeps ratio framing for a rate/pct metric even off a small base (e.g. mortality)", () => {
        expect(changePhrase("relative", "pct", 0.9, 0.45)).toBe("≈ halved")
    })

    it("keeps ratio framing for a large-scale count metric", () => {
        expect(changePhrase("relative", "number", 500, 1000)).toBe("≈ doubled")
    })

    it("still reports a real multiple for a bounded score", () => {
        expect(changePhrase("relative", "number", 0.1, 0.4)).toBe("×4")
    })
})
