#! /usr/bin/env jest

import { FontFamily } from "../../clientUtils/Bounds.js"
import {
    IRText,
    IRBold,
    MarkdownTextWrap,
    getLineWidth,
} from "./MarkdownTextWrap.js"

describe("MarkdownTextWrap", () => {
    it("IRBold should be wider than IRText", () => {
        const string = "abcdefghijklmnopqrstuvwxyz"

        const text = new IRText(string)
        const bold = new IRBold([new IRText(string)])

        expect(text.width).toBeLessThan(bold.width)
    })

    it("MarkdownTextWrap should render bold and calculate that it is wider", () => {
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

        const plainWidth = getLineWidth(plainMarkdownTextWrap.lines[0])
        const boldWidth = getLineWidth(boldMarkdownTextWrap.lines[0])
        expect(plainWidth).toBeLessThan(boldWidth)
    })

    it("MarkdownTextWrap should apply style props to HTML output", () => {
        const HTMLElement = new MarkdownTextWrap({
            text: "abcdefghijklmnopqrstuvwxyz",
            fontSize: 14,
            maxWidth: 200,
            style: {
                color: "red",
            },
        })

        const output = HTMLElement.render()

        expect(output?.props.style.color).toEqual("red")
    })

    it("MarkdownTextWrap should apply style props to SVG output", () => {
        const SVGElement = new MarkdownTextWrap({
            text: "abcdefghijklmnopqrstuvwxyz",
            fontSize: 14,
            maxWidth: 200,
            isSVG: true,
            x: 0,
            y: 0,
            style: {
                color: "red",
            },
        })

        const output = SVGElement.render()

        expect(output?.props.style.color).toEqual("red")
    })

    it("MarkdownTextWrap should accept and apply fontParams", () => {
        const element = new MarkdownTextWrap({
            text: "abcdefghijklmnopqrstuvwxyz",
            fontSize: 14,
            maxWidth: 200,
            fontFamily: FontFamily["comic sans ms"],
            fontWeight: 800,
        })

        const output = element.render()

        expect(output?.props.style).toMatchObject({
            fontFamily: FontFamily["comic sans ms"],
            fontWeight: 800,
            fontSize: 14,
        })
    })
})
