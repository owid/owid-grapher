import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Span } from "@ourworldindata/types"
import SpanElement from "./SpanElement.js"

const text = (text: string): Span => ({ spanType: "span-simple-text", text })

describe("superscript and subscript spans", () => {
    it("leaves text the font has superscript glyphs for untouched", () => {
        const html = renderToStaticMarkup(
            <SpanElement
                span={{ spanType: "span-superscript", children: [text("12")] }}
            />
        )
        expect(html).toBe('<sup><span class="">12</span></sup>')
    })

    it("wraps characters without a superscript glyph so CSS can raise them", () => {
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
            '<sup><strong><span class="">1' +
                '<span class="span-superscript-fallback">.</span>585' +
                '<span class="span-superscript-fallback">,</span> 2' +
                "</span></strong></sup>"
        )
    })

    it("uses the font's subscript coverage for subscripts", () => {
        // Lato has subscript glyphs for "." but not for "i"
        const html = renderToStaticMarkup(
            <SpanElement
                span={{ spanType: "span-subscript", children: [text("1.5i")] }}
            />
        )
        expect(html).toBe(
            '<sub><span class="">1.5<span class="span-subscript-fallback">i</span></span></sub>'
        )
    })

    it("doesn't affect text outside superscripts", () => {
        const html = renderToStaticMarkup(<SpanElement span={text("1.585")} />)
        expect(html).toBe('<span class="">1.585</span>')
    })
})
