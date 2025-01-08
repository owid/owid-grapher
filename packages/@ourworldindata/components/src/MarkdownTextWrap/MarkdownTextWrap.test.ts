#! /usr/bin/env jest

import { FontFamily } from "@ourworldindata/utils"
import {
    IRText,
    MarkdownTextWrap,
    getLineWidth,
    lineToPlaintext,
    recursiveMergeTextTokens,
    IRWhitespace,
    IRBold,
    IRLink,
    IRLineBreak,
} from "./MarkdownTextWrap.js"

describe("MarkdownTextWrap", () => {
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
            fontFamily: FontFamily["comic sans ms"],
            fontWeight: 800,
        })

        const output = element.renderHTML()

        expect(output?.props.style).toMatchObject({
            fontFamily: FontFamily["comic sans ms"],
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

describe("fromFragments", () => {
    const fontSize = 14

    it("should place fragments in-line by default", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "Lower middle-income countries" },
            secondary: { text: "30 million" },
            textWrapProps: {
                maxWidth: 500,
                fontSize,
            },
        })
        expect(textWrap.svgLines.length).toEqual(1)
        expect(textWrap.htmlLines.length).toEqual(1)
    })

    it("should place the secondary text in a new line if requested", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "Lower middle-income countries" },
            secondary: { text: "30 million" },
            newLine: "always",
            textWrapProps: {
                maxWidth: 1000,
                fontSize,
            },
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
    })

    it("should place the secondary text in a new line if line breaks should be avoided", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "Lower middle-income countries" },
            secondary: { text: "30 million" },
            newLine: "avoid-wrap",
            textWrapProps: {
                maxWidth: 250,
                fontSize,
            },
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
    })

    it("should place the secondary text in the same line if possible", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "Lower middle-income countries" },
            secondary: { text: "30 million" },
            newLine: "avoid-wrap",
            textWrapProps: {
                maxWidth: 1000,
                fontSize,
            },
        })
        expect(textWrap.svgLines.length).toEqual(1)
        expect(textWrap.htmlLines.length).toEqual(1)
    })

    it("should use all available space when one fragment exceeds the given max width", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "Long-word-that-can't-be-broken-up more words" },
            secondary: { text: "30 million" },
            textWrapProps: {
                maxWidth: 150,
                fontSize,
            },
        })
        expect(textWrap.width).toBeGreaterThan(150)
    })

    it("should place very long words in a separate line", () => {
        const textWrap = MarkdownTextWrap.fromFragments({
            main: { text: "30 million" },
            secondary: { text: "Long-word-that-can't-be-broken-up" },
            textWrapProps: {
                maxWidth: 150,
                fontSize,
            },
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
    })
})
