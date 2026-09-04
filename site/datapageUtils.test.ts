import { expect, it, describe } from "vitest"

import {
    splitDescriptionKey,
    splitDescriptionKeyAfterFirstBlock,
} from "./datapageUtils.js"

describe(splitDescriptionKey, () => {
    it("returns empty strings for empty input", () => {
        expect(splitDescriptionKey("")).toEqual({ preview: "", remainder: "" })
    })

    it("shows a short text in full", () => {
        const text = "A single paragraph."
        expect(splitDescriptionKey(text)).toEqual({
            preview: text,
            remainder: "",
        })
    })

    it("splits a bulleted list after the third bullet", () => {
        const text = ["- one", "- two", "- three", "- four", "- five"].join(
            "\n"
        )
        expect(splitDescriptionKey(text)).toEqual({
            preview: "- one\n- two\n- three",
            remainder: "- four\n- five",
        })
    })

    it("shows a list of three or fewer bullets in full", () => {
        const text = "- one\n- two\n- three"
        expect(splitDescriptionKey(text)).toEqual({
            preview: text,
            remainder: "",
        })
    })

    it("keeps nested bullets attached to their parent bullet", () => {
        const text = [
            "- one",
            "- two",
            "- three",
            "  - three a",
            "  - three b",
            "- four",
        ].join("\n")
        expect(splitDescriptionKey(text)).toEqual({
            preview: "- one\n- two\n- three\n  - three a\n  - three b",
            remainder: "- four",
        })
    })

    it("includes intro paragraphs before a list in the preview", () => {
        const text = [
            "Some intro.",
            "",
            "- one",
            "- two",
            "- three",
            "- four",
        ].join("\n")
        expect(splitDescriptionKey(text)).toEqual({
            preview: "Some intro.\n\n- one\n- two\n- three",
            remainder: "- four",
        })
    })

    it("splits plain paragraphs after the second one", () => {
        const text = ["First paragraph.", "", "Second one.", "", "Third."].join(
            "\n"
        )
        expect(splitDescriptionKey(text)).toEqual({
            preview: "First paragraph.\n\nSecond one.",
            remainder: "Third.",
        })
    })

    it("keeps multi-line paragraphs together", () => {
        const text = [
            "First line",
            "continues here.",
            "",
            "Second.",
            "",
            "Third.",
        ].join("\n")
        expect(splitDescriptionKey(text)).toEqual({
            preview: "First line\ncontinues here.\n\nSecond.",
            remainder: "Third.",
        })
    })

    it("shows the first heading's section when the text has headings", () => {
        const text = [
            "# What it measures",
            "Some explanation.",
            "",
            "More of it.",
            "",
            "# Caveats",
            "A caveat.",
        ].join("\n")
        expect(splitDescriptionKey(text)).toEqual({
            preview: "# What it measures\n\nSome explanation.\n\nMore of it.",
            remainder: "# Caveats\n\nA caveat.",
        })
    })

    it("shows a text with a single heading in full", () => {
        const text = "# Heading\nSome explanation."
        expect(splitDescriptionKey(text)).toEqual({
            preview: "# Heading\n\nSome explanation.",
            remainder: "",
        })
    })

    it("never splits inside a fenced code block", () => {
        const text = [
            "# Heading one",
            "body one",
            "",
            "```",
            "# fake heading in code",
            "more code",
            "```",
            "",
            "# Heading two",
            "body two",
        ].join("\n")
        const { preview, remainder } = splitDescriptionKey(text)
        expect(preview).toContain("# fake heading in code")
        expect(preview).toMatch(/```[\s\S]*```/)
        expect(remainder).toBe("# Heading two\n\nbody two")
    })

    it("cuts a preview of few but very long bullets down to the budget", () => {
        // three bullets à ~700 chars — block-count rules alone would show all
        const bullet = `- Rationale: ${"lorem ipsum ".repeat(60)}`
        const text = [bullet, bullet, bullet].join("\n")
        const { preview, remainder } = splitDescriptionKey(text)
        expect(preview).toBe(bullet)
        expect(remainder).toBe([bullet, bullet].join("\n"))
    })

    it("doesn't count link URLs toward the preview budget", () => {
        // three bullets of ~330 visible chars each, plus a long link URL in
        // every bullet — visible text fits the budget, raw markdown wouldn't
        const url = `https://example.org/${"very-long-path/".repeat(10)}`
        const bullet = `- ${"lorem ipsum ".repeat(26)}[read more](${url})`
        const text = [bullet, bullet, bullet].join("\n")
        expect(splitDescriptionKey(text)).toEqual({
            preview: text,
            remainder: "",
        })
    })

    it("keeps a single over-budget block intact in the preview", () => {
        const long = "word ".repeat(500).trim()
        expect(splitDescriptionKey(long)).toEqual({
            preview: long,
            remainder: "",
        })
    })
})

describe(splitDescriptionKeyAfterFirstBlock, () => {
    it("shows only the first bullet of a list", () => {
        const text = ["- one", "- two", "- three", "- four", "- five"].join(
            "\n"
        )
        expect(splitDescriptionKeyAfterFirstBlock(text)).toEqual({
            preview: "- one",
            remainder: "- two\n- three\n- four\n- five",
        })
    })

    it("shows only the intro paragraph of a list with one", () => {
        const text = ["Some intro.", "", "- one", "- two", "- three"].join("\n")
        expect(splitDescriptionKeyAfterFirstBlock(text)).toEqual({
            preview: "Some intro.",
            remainder: "- one\n- two\n- three",
        })
    })

    it("shows only the first paragraph of plain paragraphs", () => {
        const text = ["First paragraph.", "", "Second one.", "", "Third."].join(
            "\n"
        )
        expect(splitDescriptionKeyAfterFirstBlock(text)).toEqual({
            preview: "First paragraph.",
            remainder: "Second one.\n\nThird.",
        })
    })

    it("shows the heading plus the block under it", () => {
        const text = [
            "# What it measures",
            "Some explanation.",
            "",
            "More of it.",
            "",
            "# Caveats",
            "A caveat.",
        ].join("\n")
        expect(splitDescriptionKeyAfterFirstBlock(text)).toEqual({
            preview: "# What it measures\n\nSome explanation.",
            remainder: "More of it.\n\n# Caveats\n\nA caveat.",
        })
    })

    it("keeps a text that is nothing but headings whole", () => {
        const text = "# One\n\n# Two"
        expect(splitDescriptionKeyAfterFirstBlock(text)).toEqual({
            preview: text,
            remainder: "",
        })
    })

    it("returns empty strings for empty input", () => {
        expect(splitDescriptionKeyAfterFirstBlock("")).toEqual({
            preview: "",
            remainder: "",
        })
    })
})
