import { expect, it, describe } from "vitest"
import { OwidEnrichedGdocBlock } from "@ourworldindata/utils"
import { buildSocialText } from "./socialText.js"

function textBlock(text: string): OwidEnrichedGdocBlock {
    return {
        type: "text",
        value: [{ spanType: "span-simple-text", text }],
        parseErrors: [],
    }
}

function ctaBlock(text: string, url: string): OwidEnrichedGdocBlock {
    return { type: "cta", text, url, parseErrors: [] }
}

function build(
    title: string,
    body: OwidEnrichedGdocBlock[] = [],
    authorsNote?: string
): string {
    return buildSocialText({
        title,
        body,
        authorsNote,
        linkedDocuments: {},
    })
}

describe("buildSocialText", () => {
    it("ends the title with a period when it has none", () => {
        expect(build("Life expectancy has doubled")).toBe(
            "Life expectancy has doubled."
        )
    })

    it("leaves sentence-ending punctuation alone", () => {
        expect(build("Is the world getting better?")).toBe(
            "Is the world getting better?"
        )
        expect(build("It doubled since 1900.")).toBe("It doubled since 1900.")
    })

    it("looks past closing quotes and brackets", () => {
        expect(build("“Is the world getting better?”")).toBe(
            "“Is the world getting better?”"
        )
        expect(build("Emissions are falling (for now)")).toBe(
            "Emissions are falling (for now)."
        )
    })

    it("joins the title, paragraphs, authors note and cta", () => {
        const text = build(
            "Land use has changed",
            [
                textBlock("Cropland covers a tenth of the world."),
                textBlock("Pasture covers a quarter."),
                ctaBlock(
                    "Explore the updated data:",
                    "https://ourworldindata.org/land-use"
                ),
            ],
            "This data update was led by Lucas Rodés-Guirao."
        )
        expect(text).toBe(
            [
                "Land use has changed.",
                "Cropland covers a tenth of the world.\n\nPasture covers a quarter.",
                "This data update was led by Lucas Rodés-Guirao.",
                "Explore the updated data: https://ourworldindata.org/land-use",
            ].join("\n\n")
        )
    })

    it("omits the authors note when there is none", () => {
        expect(build("A title", [textBlock("Some text.")])).toBe(
            "A title.\n\nSome text."
        )
    })
})
