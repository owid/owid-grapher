import { expect, it, describe } from "vitest"

import * as React from "react"
import ReactDOMServer from "react-dom/server"
import { FontFamily } from "@ourworldindata/utils"
import { MarkdownTextWrapSvg } from "./MarkdownTextWrapComponents.js"
import { MarkdownTextWrap } from "./MarkdownTextWrap.js"
import { TextWrapGroup } from "./TextWrapGroup.js"

const renderSvg = (element: React.ReactElement): string =>
    ReactDOMServer.renderToStaticMarkup(element)

const textElements = (svg: string): string[] =>
    svg.match(/<text\b[^>]*>.*?<\/text>/g) ?? []

describe(MarkdownTextWrapSvg, () => {
    it("renders one <text> element per line, without tspans", () => {
        const textWrap = new MarkdownTextWrap({
            text: "one two three four",
            fontSize: 10,
            maxWidth: 40,
        })
        expect(textWrap.svgLines.length).toBeGreaterThan(1)

        const svg = renderSvg(
            <MarkdownTextWrapSvg textWrap={textWrap} x={16} y={16} />
        )
        expect(textElements(svg)).toHaveLength(textWrap.svgLines.length)
        expect(svg).not.toContain("<tspan")
    })

    // resvg drops a <text> element that mixes font families when the text
    // contains certain glyph pairs, which silently dropped chart titles
    it("gives a fragment that switches the font family its own <text>", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Estimated number of malaria cases" },
                {
                    text: "World, 2000 to 2024",
                    fontFamily: FontFamily.Lato,
                    inlineGap: 6,
                },
            ],
            fontFamily: FontFamily.PlayfairDisplay,
            fontSize: 25,
            maxWidth: 1000,
        })
        expect(textWrap.svgLines).toHaveLength(1)

        const svg = renderSvg(
            <MarkdownTextWrapSvg textWrap={textWrap} x={16} y={16} />
        )
        const [title, annotation] = textElements(svg)
        expect(textElements(svg)).toHaveLength(2)
        expect(title).toContain("Playfair Display")
        expect(title).not.toContain("Lato")
        expect(annotation).toContain("Lato")
        expect(annotation).not.toContain("Playfair Display")

        // The annotation starts after the title text plus the inline gap,
        // since a <text> element can't offset itself with dx
        const titleWidth = textWrap.svgLines[0][0].width
        expect(annotation).toContain(`x="${(16 + titleWidth + 6).toFixed(1)}"`)
    })
})
