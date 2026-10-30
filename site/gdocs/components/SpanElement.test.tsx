import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Span } from "@ourworldindata/types"
import SpanElement from "./SpanElement.js"

const text = (text: string): Span => ({ spanType: "span-simple-text", text })

describe("superscript and subscript spans", () => {
    it("leaves text the font has superscript glyphs for to the font", () => {
        const html = renderToStaticMarkup(
            <SpanElement
                span={{ spanType: "span-superscript", children: [text("12")] }}
            />
        )
        expect(html).toBe('<sup><span class="">12</span></sup>')
    })

    it("marks the whole superscript if any nested character lacks a glyph", () => {
        // Lato has no superscript glyph for "." or ",", so the digits are
        // drawn without the font's glyphs too, to keep the run consistent
        const html = renderToStaticMarkup(
            <SpanElement
                span={{
                    spanType: "span-superscript",
                    children: [
                        {
                            spanType: "span-bold",
                            children: [text("1.585, 2")],
                        },
                    ],
                }}
            />
        )
        expect(html).toBe(
            '<sup class="span-superscript-fallback"><strong><span class="">1.585, 2</span></strong></sup>'
        )
    })

    it("uses the font's subscript coverage for subscripts", () => {
        // Lato has subscript glyphs for "." but not for "i"
        const covered = renderToStaticMarkup(
            <SpanElement
                span={{ spanType: "span-subscript", children: [text("1.5")] }}
            />
        )
        const uncovered = renderToStaticMarkup(
            <SpanElement
                span={{ spanType: "span-subscript", children: [text("1.5i")] }}
            />
        )
        expect(covered).toBe('<sub><span class="">1.5</span></sub>')
        expect(uncovered).toBe(
            '<sub class="span-subscript-fallback"><span class="">1.5i</span></sub>'
        )
    })
})
