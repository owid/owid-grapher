import { describe, expect, it } from "vitest"

import { parseRichText, richTextToPlain } from "./richText.js"

describe(parseRichText, () => {
    it("splits a sentence into bold, italic and plain runs", () => {
        expect(
            parseRichText("The **global distribution**, a *poverty line*.")
        ).toEqual([
            { text: "The " },
            { text: "global distribution", bold: true },
            { text: ", a " },
            { text: "poverty line", italic: true },
            { text: "." },
        ])
    })

    it("marks the entities a sentence names, also inside emphasis", () => {
        expect(
            parseRichText("In **[[Sweden]]** and [[United States]]")
        ).toEqual([
            { text: "In " },
            { text: "Sweden", bold: true, entity: "Sweden" },
            { text: " and " },
            { text: "United States", entity: "United States" },
        ])
    })

    it("keeps an unclosed entity bracket as text", () => {
        expect(parseRichText("a [[b")).toEqual([{ text: "a [[b" }])
    })
})

describe(richTextToPlain, () => {
    it("drops the markers", () => {
        expect(richTextToPlain("In **[[Sweden]]**, *roughly*")).toBe(
            "In Sweden, roughly"
        )
    })
})
