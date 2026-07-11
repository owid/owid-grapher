import { expect, it, describe } from "vitest"
import {
    decorateArchieMlLines,
    type ArchieMlLineDecoration,
} from "./archieToGdoc.js"

const foregroundHex = (decoration: ArchieMlLineDecoration): string | null => {
    const rgb =
        decoration.styleRanges[0]?.textStyle.foregroundColor?.color?.rgbColor
    if (!rgb) return null
    const toHex = (channel?: number | null): string =>
        Math.round((channel ?? 0) * 255)
            .toString(16)
            .padStart(2, "0")
    return `#${toHex(rgb.red)}${toHex(rgb.green)}${toHex(rgb.blue)}`
}

describe(decorateArchieMlLines, () => {
    it("colors property keys (incl. colon) and leaves the value unstyled", () => {
        const [decoration] = decorateArchieMlLines(["title: A fine title"])
        expect(decoration.indentLevel).toBe(0)
        expect(decoration.styleRanges).toHaveLength(1)
        expect(decoration.styleRanges[0]).toMatchObject({
            start: 0,
            end: "title:".length,
            fields: "foregroundColor",
        })
        expect(foregroundHex(decoration)).toBe("#0094ff")
    })

    it("indents nested content and cycles delimiter colors by depth", () => {
        const decorations = decorateArchieMlLines([
            "[+body]",
            "Some prose",
            "{.chart}",
            "url: https://example.org",
            "{}",
            "[]",
        ])
        expect(decorations.map((d) => d.indentLevel)).toEqual([
            0, 1, 1, 2, 1, 0,
        ])
        // depth-0 delimiters orange, depth-1 delimiters green
        expect(foregroundHex(decorations[0])).toBe("#f47835")
        expect(foregroundHex(decorations[2])).toBe("#23974a")
        // closers get the same color as their opener
        expect(foregroundHex(decorations[4])).toBe("#23974a")
        expect(foregroundHex(decorations[5])).toBe("#f47835")
        // prose is unstyled, delimiter ranges cover the whole line
        expect(decorations[1].styleRanges).toEqual([])
        expect(decorations[2].styleRanges[0]).toMatchObject({
            start: 0,
            end: "{.chart}".length,
        })
    })

    it("handles doubly nested frontmatter blocks like [.refs] > [.+content]", () => {
        const decorations = decorateArchieMlLines([
            "[.refs]",
            "id: my-ref",
            "[.+content]",
            "Ref text",
            "[]",
            "[]",
        ])
        expect(decorations.map((d) => d.indentLevel)).toEqual([
            0, 1, 1, 2, 1, 0,
        ])
        expect(foregroundHex(decorations[1])).toBe("#0094ff")
    })

    it("leaves html:…:end blocks verbatim, keeping the running indent", () => {
        const decorations = decorateArchieMlLines([
            "[+body]",
            "html: <div>",
            "title: not a property",
            "[]",
            ":end",
            "After the block",
            "[]",
        ])
        // everything from html: through :end is unstyled — including lines
        // that look like properties or delimiters
        for (const decoration of decorations.slice(1, 5)) {
            expect(decoration.styleRanges).toEqual([])
        }
        // the fake "[]" inside the block does not change the nesting level
        expect(decorations.map((d) => d.indentLevel)).toEqual([
            0, 1, 1, 1, 1, 1, 0,
        ])
    })

    it("leaves :skip/:endskip and :ignore segments verbatim", () => {
        const decorations = decorateArchieMlLines([
            ":skip",
            "draft: notes",
            ":endskip",
            "title: Real",
            ":ignore",
            "url: nope",
        ])
        expect(decorations[1].styleRanges).toEqual([])
        expect(foregroundHex(decorations[3])).toBe("#0094ff")
        expect(decorations[5].styleRanges).toEqual([])
    })

    it("styles inline {ref}…{/ref} spans including the tags", () => {
        const [decoration] = decorateArchieMlLines([
            "Some text {ref}a source{/ref} and {ref}another{/ref}.",
        ])
        expect(decoration.styleRanges).toHaveLength(2)
        expect(decoration.styleRanges[0]).toMatchObject({
            start: "Some text ".length,
            end: "Some text {ref}a source{/ref}".length,
            fields: "foregroundColor,fontSize,weightedFontFamily",
        })
        expect(decoration.styleRanges[0].textStyle).toMatchObject({
            fontSize: { magnitude: 8, unit: "PT" },
            weightedFontFamily: { fontFamily: "Courier New" },
        })
    })
})
