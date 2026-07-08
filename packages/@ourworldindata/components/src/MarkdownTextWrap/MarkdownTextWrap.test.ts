import { expect, it, describe } from "vitest"

import { cssFontFamily, FontFamily, VerticalAlign } from "@ourworldindata/utils"
import {
    IRText,
    getLineWidth,
    lineToPlaintext,
    recursiveMergeTextTokens,
    IRWhitespace,
    IRBold,
    IRLink,
    IRLineBreak,
} from "./IRTokens.js"
import { MarkdownTextWrap } from "./MarkdownTextWrap.js"

describe(MarkdownTextWrap, () => {
    it("heavier fontWeight should be wider than plain IRText", () => {
        const string = "abcdefghijklmnopqrstuvwxyz"

        const text = new IRText(string)
        const bold = new IRText(string, { fontWeight: 700 })

        expect(text.width).toBeLessThan(bold.width)
    })

    it("should render bold and calculate that it is wider", () => {
        const plainString = "abcdefghijklmnopqrstuvwxyz"
        const boldString = "**abcdefghijklmnopqrstuvwxyz**"

        const plainMarkdownTextWrap = new MarkdownTextWrap({
            text: plainString,
            fontSize: 14,
            maxWidth: 200,
        })
        const boldMarkdownTextWrap = new MarkdownTextWrap({
            text: boldString,
            fontSize: 14,
            maxWidth: 200,
        })

        const plainWidth = getLineWidth(plainMarkdownTextWrap.htmlLines[0])
        const boldWidth = getLineWidth(boldMarkdownTextWrap.htmlLines[0])
        expect(plainWidth).toBeLessThan(boldWidth)
    })

    it("should accept and apply fontParams", () => {
        const element = new MarkdownTextWrap({
            text: "abcdefghijklmnopqrstuvwxyz",
            fontSize: 14,
            maxWidth: 200,
            fontFamily: FontFamily.Lato,
            fontWeight: 800,
        })

        expect(element.style).toMatchObject({
            fontFamily: cssFontFamily(FontFamily.Lato),
            fontWeight: 800,
            fontSize: 14,
        })
    })

    it("should calculate height correctly", () => {
        const element = new MarkdownTextWrap({
            text: "a\nb\nc",
            fontSize: 10,
            lineHeight: 1.5,
        })

        // 10 fontSize * 1.5 lineHeight * 3 lines = 45px
        expect(element.height).toEqual(45)
    })

    it("should return zero height for empty string", () => {
        const element = new MarkdownTextWrap({
            text: "",
            fontSize: 16,
        })

        expect(element.height).toEqual(0)
    })

    it("should default to bottom verticalAlign", () => {
        const defaultAligned = new MarkdownTextWrap({
            text: "a\nb",
            fontSize: 12,
            lineHeight: 1.3,
        })
        const bottomAligned = new MarkdownTextWrap({
            text: "a\nb",
            fontSize: 12,
            lineHeight: 1.3,
            verticalAlign: VerticalAlign.bottom,
        })

        const [, defaultY] = defaultAligned.getPositionForSvgRendering(0, 100)
        const [, bottomY] = bottomAligned.getPositionForSvgRendering(0, 100)

        expect(defaultY).toEqual(bottomY)
    })

    it("should adjust SVG y-position based on verticalAlign", () => {
        const topAligned = new MarkdownTextWrap({
            text: "a\nb\nc",
            fontSize: 10,
            lineHeight: 1.2,
            verticalAlign: VerticalAlign.top,
        })
        const middleAligned = new MarkdownTextWrap({
            text: "a\nb\nc",
            fontSize: 10,
            lineHeight: 1.2,
            verticalAlign: VerticalAlign.middle,
        })
        const bottomAligned = new MarkdownTextWrap({
            text: "a\nb\nc",
            fontSize: 10,
            lineHeight: 1.2,
            verticalAlign: VerticalAlign.bottom,
        })

        const [, topY] = topAligned.getPositionForSvgRendering(0, 50)
        const [, middleY] = middleAligned.getPositionForSvgRendering(0, 50)
        const [, bottomY] = bottomAligned.getPositionForSvgRendering(0, 50)

        expect(bottomY - topY).toBeCloseTo(topAligned.height)
        expect(bottomY - middleY).toBeCloseTo(topAligned.height / 2)
        expect(middleY - topY).toBeCloseTo(topAligned.height / 2)
    })

    it("should split on newline", () => {
        const element = new MarkdownTextWrap({
            text: "_test\n**\nnewlineyarn \n**_test",
            fontSize: 10,
            lineHeight: 1,
        })

        expect(element.height).toEqual(40)
    })

    it("should convert to plaintext", () => {
        const element = new MarkdownTextWrap({
            text: "I am some _bold_ text with a [really really really long detail on demand](#dod:test) and because I am so long you would think that I **span multiple lines** but when you transform me into plaintext I actually just stay as one line",
            fontSize: 10,
            lineHeight: 1,
        })

        expect(element.htmlLines.map(lineToPlaintext)).toEqual([
            "I am some bold text with a really really really long detail on demand and because I am so long you would think that I span multiple lines but when you transform me into plaintext I actually just stay as one line",
        ])
    })

    describe(recursiveMergeTextTokens, () => {
        it("should merge adjacent text tokens", () => {
            const tokens = [
                new IRText("one"),
                new IRWhitespace(),
                new IRText("two"),
            ]

            const merged = recursiveMergeTextTokens(tokens)

            expect(merged).toEqual([new IRText("one two")])
        })

        it("should merge inside complicated tokens", () => {
            const tokens = [
                new IRBold([
                    new IRText("one"),
                    new IRWhitespace(),
                    new IRText("two"),
                ]),
                new IRText("three"),
                new IRText("four"),
            ]

            const merged = recursiveMergeTextTokens(tokens)

            expect(merged).toEqual([
                new IRBold([new IRText("one two")]),
                new IRText("threefour"),
            ])
        })

        it("should merge multi-level tokens", () => {
            const tokens = [
                new IRBold([
                    new IRText("one"),
                    new IRLink("https://example.com", [
                        new IRText("two"),
                        new IRWhitespace(),
                        new IRLineBreak(),
                    ]),
                    new IRText("three"),
                ]),
                new IRText("four"),
                new IRText("five"),
            ]

            const merged = recursiveMergeTextTokens(tokens)

            expect(merged).toEqual([
                new IRBold([
                    new IRText("one"),
                    new IRLink("https://example.com", [
                        new IRText("two "),
                        new IRLineBreak(),
                    ]),
                    new IRText("three"),
                ]),
                new IRText("fourfive"),
            ])
        })
    })
})
