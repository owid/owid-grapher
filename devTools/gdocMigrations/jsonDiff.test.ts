import { describe, expect, it } from "vitest"
import { describeJsonDiff, diffShape } from "./engine/jsonDiff.js"

describe("describeJsonDiff", () => {
    it("reports renames, removals, additions and value changes with paths", () => {
        const before = {
            body: [
                {
                    type: "chart",
                    caption: [{ spanType: "span-simple-text", text: "Hi" }],
                    url: "a",
                },
                { type: "text", value: "unchanged" },
            ],
            title: "T",
        }
        const after = {
            body: [
                {
                    type: "chart",
                    subtitle: [{ spanType: "span-simple-text", text: "Hi" }],
                    url: "b",
                    size: "wide",
                },
                { type: "text", value: "unchanged" },
            ],
        }
        const diff = describeJsonDiff(before, after)
        expect(diff.map((line) => line.detail)).toEqual([
            '$.title: removed (was "T")',
            '$.body[0]: "caption" → "subtitle" (renamed)',
            '$.body[0].size: added "wide"',
            '$.body[0].url: "a" → "b"',
        ])
        expect(diff.map((line) => line.shape)).toEqual([
            "$.title: removed",
            '$.body[]: "caption" → "subtitle" (renamed)',
            "$.body[].size: added",
            "$.body[].url: changed",
        ])
    })

    it("renders span arrays as plain text and truncates long values", () => {
        const spans = (text: string) => [{ spanType: "span-simple-text", text }]
        const [line] = describeJsonDiff(
            { caption: spans("short") },
            { caption: spans("x".repeat(100)) }
        )
        expect(line.detail).toMatch(/^\$\.caption: "short" → "x{58}…$/)
    })

    it("summarizes arrays that change length", () => {
        expect(
            describeJsonDiff({ body: [1, 2] }, { body: [1] }).map(
                (l) => l.detail
            )
        ).toEqual(["$.body: array of 2 → 1 item(s)"])
    })

    it("returns nothing for equal values", () => {
        expect(describeJsonDiff({ a: [1] }, { a: [1] })).toEqual([])
    })
})

describe("diffShape", () => {
    it("dedupes and sorts shapes so equivalent diffs group together", () => {
        const diff = describeJsonDiff(
            { body: [{ x: 1 }, { x: 1 }], a: 0 },
            { body: [{ x: 2 }, { x: 3 }], a: 1 }
        )
        expect(diffShape(diff)).toEqual(["$.a: changed", "$.body[].x: changed"])
    })
})
