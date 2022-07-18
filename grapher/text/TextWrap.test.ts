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

    it("calculates correct height for multiple newlines", () => {
        const lineHeight = renderedHeight("test")
        expect(renderedHeight("test\n\ntest")).toBeGreaterThanOrEqual(
            renderedHeight("test\ntest") + lineHeight
        )
    })

    it("calculates correct height with custom lineHeight", () => {
        const textwrap = new TextWrap({
            maxWidth: Infinity,
            fontSize: 10,
            lineHeight: 1.5,
            text: "line\nline\nline",
        })
        // line (10) + space (5) + line (10) + space (5) + line (10)
        // NOTE: no specing after the bottom line
        expect(textwrap.height).toEqual(40)
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

describe("lines()", () => {
    it("should not contain any newline characters", () => {
        const text = "a very very very very long line\n\nshort one"
        const wrap = new TextWrap({
            text,
            maxWidth: 100,
            fontSize: FONT_SIZE,
        })
        expect(wrap.lines.map((l) => l.text)).toEqual([
            "a very very",
            "very very long",
            "line",
            "",
            "short one",
        ])
    })

    it("should work in rawHtml mode", () => {
        // the HTML version of this string won't fit into a width of 150, but it will once the HTML tags are stripped
        // - that's what the rawHtml mode is for.
        const text =
            "an <strong>important</strong> <a href='https://youtu.be/dQw4w9WgXcQ'>line</a>"
        const wrap = new TextWrap({
            text,
            maxWidth: 150,
            fontSize: FONT_SIZE,
            rawHtml: true,
        })
        expect(wrap.lines.map((l) => l.text)).toEqual([
            "an <strong>important</strong> <a href='https://youtu.be/dQw4w9WgXcQ'>line</a>",
        ])
    })
})
