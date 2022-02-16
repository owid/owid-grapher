#! /usr/bin/env jest

import { TextWrap, shortenForTargetWidth } from "./TextWrap.js"
import { Bounds } from "../../clientUtils/Bounds.js"

const FONT_SIZE = 14

describe("width()", () => {
    const stringWidth = (text: string): number =>
        Bounds.forText(text, { fontSize: FONT_SIZE }).width

    const renderedWidth = (text: string, raw?: boolean): number => {
        const textwrap = new TextWrap({
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            text,
            rawHtml: raw,
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

describe("height()", () => {
    const renderedHeight = (text: string, raw?: boolean): number => {
        const textwrap = new TextWrap({
            maxWidth: Infinity,
            fontSize: FONT_SIZE,
            text,
            rawHtml: raw,
        })
        return textwrap.height
    }

    it("calculates a height of zero for an empty string", () => {
        const text = ""
        expect(renderedHeight(text)).toEqual(0)
    })
})

describe(shortenForTargetWidth, () => {
    it("should not shorten if text fits", () => {
        const text = "a short string"
        expect(shortenForTargetWidth(text, 10000)).toEqual(text)
    })

    it("should return empty string if there's no space at all", () => {
        const text = "a short string"
        expect(shortenForTargetWidth(text, 1)).toEqual("")
    })
})
