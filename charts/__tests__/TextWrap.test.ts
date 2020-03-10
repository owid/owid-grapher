#! /usr/bin/env jest

import { TextWrap } from "../TextWrap"
import { Bounds } from "../Bounds"

const FONT_SIZE = 14

describe(TextWrap, () => {
    describe("width()", () => {
        function stringWidth(text: string): number {
            return Bounds.forText(text, { fontSize: FONT_SIZE }).width
        }

        function renderedWidth(text: string, raw?: true): number {
            const textwrap = new TextWrap({
                maxWidth: Infinity,
                fontSize: FONT_SIZE,
                text,
                raw
            })
            return textwrap.width
        }

        it("correct for single line text", () => {
            const text = "an example line"
            expect(stringWidth(text)).toEqual(renderedWidth(text))
        })

        it("collapses congiguous spaces", () => {
            const text = "an example    spaced   out text"
            expect(stringWidth(text)).toEqual(renderedWidth(text))
        })

        it("strips HTML in raw strings", () => {
            const html = "<b>an example</b> line, <i> hopefully </i> it works"
            const text = "an example line, hopefully it works"
            expect(stringWidth(text)).toEqual(renderedWidth(html, true))
        })

        it("strips HTML when the first word token is an HTML tag", () => {
            const html = "<b>  test</b>"
            const text = " test"
            expect(stringWidth(text)).toEqual(renderedWidth(html, true))
        })

        it("doesn't naively strip '<' and '>' symbols", () => {
            const text = "text that contains <  and  > symbols that aren't HTML"
            expect(stringWidth(text)).toEqual(renderedWidth(text, true))
        })
    })
})
