import { describe, expect, it } from "vitest"
import { formatArchieMlLines, MISMATCH_COLORS } from "./archieMlFormatting.js"

const ORANGE = { foreground: "#f47835", background: "#FFFFFF" }
const GREEN = { foreground: "#23974a", background: "#FFFFFF" }
const MAGENTA = { foreground: "#FF00FF", background: "#FFFFFF" }

const indents = (lines: string[]): number[] =>
    formatArchieMlLines(lines).map((format) => format.indentLevel)
const colors = (lines: string[]): unknown[] =>
    formatArchieMlLines(lines).map((format) => format.lineColors)
const refs = (lines: string[]): unknown[] =>
    formatArchieMlLines(lines).map((format) => format.refRanges)

describe(formatArchieMlLines, () => {
    describe("keys", () => {
        it("colours the key and its colon", () => {
            expect(formatArchieMlLines(["title: Hi"])).toEqual([
                { indentLevel: 0, keyRange: [0, 6], refRanges: [] },
            ])
        })

        it("covers the key from its first letter to the colon when spaced", () => {
            // "  title :  Hi": `t` is at 2, `:` at 8.
            expect(formatArchieMlLines(["  title :  Hi"])[0].keyRange).toEqual([
                2, 9,
            ])
        })
    })

    describe("brackets", () => {
        it("indents nested blocks and colours brackets by depth", () => {
            const lines = ["[+body]", "x", "{.chart}", "url: u", "{}", "[]"]
            expect(indents(lines)).toEqual([0, 1, 1, 2, 1, 0])
            expect(colors(lines)).toEqual([
                ORANGE,
                undefined,
                GREEN,
                undefined,
                GREEN,
                ORANGE,
            ])
        })

        it("flags a closer that doesn't match its opener", () => {
            const lines = ["[+body]", "{}"]
            expect(indents(lines)).toEqual([0, 0])
            expect(colors(lines)[1]).toEqual(MISMATCH_COLORS)
        })

        it("flags a closer with no opener and keeps the indent at 0", () => {
            expect(formatArchieMlLines(["[]"])).toEqual([
                { indentLevel: 0, lineColors: MISMATCH_COLORS, refRanges: [] },
            ])
        })

        it("cycles the colours from depth 3 on", () => {
            expect(colors(["[+a]", "{.b}", "[.c]", "{.d}"])).toEqual([
                ORANGE,
                GREEN,
                MAGENTA,
                ORANGE,
            ])
        })

        it("indents after an opener that follows a stray closer", () => {
            const lines = ["[]", "[+x]", "y"]
            expect(indents(lines)).toEqual([0, 0, 1])
            expect(colors(lines)[0]).toEqual(MISMATCH_COLORS)
        })
    })

    describe("refs", () => {
        it("styles a ref within one line, tags included", () => {
            expect(refs(["a {ref}note{/ref} b"])).toEqual([[[2, 17]]])
        })

        it("clips a ref across lines to each line and skips empty lines", () => {
            expect(refs(["a {ref}x", "", "y{/ref} b"])).toEqual([
                [[2, 8]],
                [],
                [[0, 7]],
            ])
        })

        it("leaves an unclosed ref unstyled", () => {
            expect(refs(["a {ref}x"])).toEqual([[]])
        })

        it("runs an unclosed ref to the next {/ref}, like the site", () => {
            expect(refs(["a {ref}x", "b {ref}y{/ref}"])).toEqual([
                [[2, 8]],
                [[0, 14]],
            ])
        })

        it("stops a nested ref at the first {/ref}", () => {
            // "{ref}a {ref}b{/ref}" is 19 characters; " c{/ref}" stays plain.
            expect(refs(["{ref}a {ref}b{/ref} c{/ref}"])).toEqual([[[0, 19]]])
        })

        it("ignores refs inside a :skip block", () => {
            expect(refs([":skip", "{ref}x", ":endskip", "y{/ref}"])).toEqual([
                [],
                [],
                [],
                [],
            ])
        })

        it("ignores refs after :ignore", () => {
            expect(refs(["a", ":ignore", "{ref}x{/ref}"])).toEqual([[], [], []])
        })

        it("doesn't treat {ref} alone on a line as a block opener", () => {
            const lines = ["{ref}", "note", "{/ref}", "[]"]
            expect(indents(lines)).toEqual([0, 0, 0, 0])
            expect(refs(lines)).toEqual([[[0, 5]], [[0, 4]], [[0, 6]], []])
            expect(colors(lines)).toEqual([
                undefined,
                undefined,
                undefined,
                MISMATCH_COLORS,
            ])
        })

        it("keeps the mismatch colours on a closer inside a ref", () => {
            const [, , closer] = formatArchieMlLines([
                "{ref}a",
                "[+x]",
                "{}",
                "b{/ref}",
            ])
            // The writer applies the ref first, then the line colours.
            expect(closer).toEqual({
                indentLevel: 0,
                lineColors: MISMATCH_COLORS,
                refRanges: [[0, 2]],
            })
        })

        it("uses plain-text offsets for a line that had styled runs", () => {
            // The writer passes "a <b>{ref}b{/ref}</b>" as its plain text.
            expect(refs(["a {ref}b{/ref}"])).toEqual([[[2, 14]]])
        })
    })

    it("gives an empty line only its indent", () => {
        expect(formatArchieMlLines(["[+body]", ""])[1]).toEqual({
            indentLevel: 1,
            refRanges: [],
        })
    })

    it("formats a small mixed doc", () => {
        expect(
            formatArchieMlLines([
                "title: Forests",
                "[+body]",
                "Text with a {ref}note{/ref}.",
                "{.chart}",
                "url: https://ourworldindata.org/grapher/x",
                "{}",
                "[]",
            ])
        ).toEqual([
            { indentLevel: 0, keyRange: [0, 6], refRanges: [] },
            { indentLevel: 0, lineColors: ORANGE, refRanges: [] },
            { indentLevel: 1, refRanges: [[12, 27]] },
            { indentLevel: 1, lineColors: GREEN, refRanges: [] },
            { indentLevel: 2, keyRange: [0, 4], refRanges: [] },
            { indentLevel: 1, lineColors: GREEN, refRanges: [] },
            { indentLevel: 0, lineColors: ORANGE, refRanges: [] },
        ])
    })
})
