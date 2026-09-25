import { expect, it, describe } from "vitest"
import { sha1Hex } from "./sha1.js"

// Reference digests generated with node:crypto's
// createHash("sha1").update(input).digest("hex"), which this function
// replaces.
describe(sha1Hex, () => {
    it("matches node:crypto digests", () => {
        expect(sha1Hex("")).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709")
        expect(sha1Hex("abc")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d")
        expect(sha1Hex("The quick brown fox jumps over the lazy dog")).toBe(
            "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"
        )
        // multi-byte UTF-8 input
        expect(sha1Hex("Höhe über dem Meeresspiegel — 100 μg/m³")).toBe(
            "82a048121d0fc2a932b5cb256929651d252e62de"
        )
        // exercise the block boundary (55/56/64 byte messages pad differently)
        expect(sha1Hex("a".repeat(55))).toBe(
            "c1c8bbdc22796e28c0e15163d20899b65621d65a"
        )
        expect(sha1Hex("a".repeat(56))).toBe(
            "c2db330f6083854c99d4b5bfb6e8f29f201be699"
        )
        expect(sha1Hex("a".repeat(64))).toBe(
            "0098ba824b5c16427bd7a1122a5a442a25ec644d"
        )
    })
})
