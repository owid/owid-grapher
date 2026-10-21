import { describe, expect, it } from "vitest"
import type { docs_v1 } from "@googleapis/docs"
import { archieMlTextToRequests } from "./archieToGdoc.js"

// The formatting overrides, in execution order: text-style requests other
// than the base and fragment ones.
const overrides = (text: string): docs_v1.Schema$UpdateTextStyleRequest[] =>
    archieMlTextToRequests(text)
        .map((request) => request.updateTextStyle)
        .filter(
            (request): request is docs_v1.Schema$UpdateTextStyleRequest =>
                request !== undefined &&
                !request.fields?.includes("weightedFontFamily") &&
                !request.fields?.includes("bold")
        )

describe(archieMlTextToRequests, () => {
    it("indents each paragraph by 10 pt per level", () => {
        const indents = archieMlTextToRequests(
            ["[+body]", "x", "{.chart}", "url: u", "{}", "[]"].join("\n")
        )
            .map((request) => request.updateParagraphStyle)
            .filter((request) => request !== undefined)
            .map((request) => request.paragraphStyle?.indentStart?.magnitude)
        // Requests execute bottom-up, so the last line comes first.
        expect(indents.toReversed()).toEqual([0, 10, 10, 20, 10, 0])
    })

    it("gives an empty line no text-style override", () => {
        expect(overrides(["[+body]", "", "[]"].join("\n"))).toEqual([
            expect.objectContaining({ range: { startIndex: 1, endIndex: 3 } }),
            expect.objectContaining({ range: { startIndex: 1, endIndex: 8 } }),
        ])
    })

    it("applies a ref's style before the mismatch colours", () => {
        // Only the `{}` line has both a ref range and line colours.
        const closer = overrides(
            ["{ref}a", "[+x]", "{}", "b{/ref}"].join("\n")
        ).filter((request) => request.range?.endIndex === 3)
        expect(closer.map((request) => request.fields)).toEqual([
            "foregroundColor,fontSize",
            "foregroundColor,backgroundColor",
        ])
    })
})
