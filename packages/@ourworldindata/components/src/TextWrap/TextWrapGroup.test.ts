#! /usr/bin/env jest

import { TextWrap } from "./TextWrap"
import { TextWrapGroup } from "./TextWrapGroup"

const FONT_SIZE = 14
const TEXT = "Lower middle-income countries"
const MAX_WIDTH = 150

const textWrap = new TextWrap({
    text: TEXT,
    maxWidth: MAX_WIDTH,
    fontSize: FONT_SIZE,
})

it("should work like TextWrap for a single fragment", () => {
    const textWrapGroup = new TextWrapGroup({
        fragments: [{ text: TEXT }],
        maxWidth: MAX_WIDTH,
        fontSize: FONT_SIZE,
    })

    const firstTextWrap = textWrapGroup.textWraps[0]
    expect(firstTextWrap.text).toEqual(textWrap.text)
    expect(firstTextWrap.width).toEqual(textWrap.width)
    expect(firstTextWrap.height).toEqual(textWrap.height)
    expect(firstTextWrap.lines).toEqual(textWrap.lines)
})

it("should place fragments in-line if there is space", () => {
    const textWrapGroup = new TextWrapGroup({
        fragments: [{ text: TEXT }, { text: "30 million" }],
        maxWidth: MAX_WIDTH,
        fontSize: FONT_SIZE,
    })

    expect(textWrapGroup.text).toEqual([TEXT, "30 million"].join(" "))
    expect(textWrapGroup.height).toEqual(textWrap.height)
})

it("should place the second segment in a new line if preferred", () => {
    const maxWidth = 250
    const textWrapGroup = new TextWrapGroup({
        fragments: [
            { text: TEXT },
            { text: "30 million", preferLineBreakOverWrapping: true },
        ],
        maxWidth,
        fontSize: FONT_SIZE,
    })

    // 30 million should be placed in a new line, thus the group's height
    // should be greater than the textWrap's height
    expect(textWrapGroup.height).toBeGreaterThan(
        new TextWrap({
            text: TEXT,
            maxWidth,
            fontSize: FONT_SIZE,
        }).height
    )
})

it("should place the second segment in the same line if possible", () => {
    const maxWidth = 1000
    const textWrapGroup = new TextWrapGroup({
        fragments: [
            { text: TEXT },
            { text: "30 million", preferLineBreakOverWrapping: true },
        ],
        maxWidth,
        fontSize: FONT_SIZE,
    })

    // since the max width is large, "30 million" fits into the same line
    // as the text of the first fragmemt
    expect(textWrapGroup.height).toEqual(
        new TextWrap({
            text: TEXT,
            maxWidth,
            fontSize: FONT_SIZE,
        }).height
    )
})

it("should use all available space when one fragment exceeds the given max width", () => {
    const maxWidth = 150
    const textWrap = new TextWrap({
        text: "Long-word-that-can't-be-broken-up more words",
        maxWidth,
        fontSize: FONT_SIZE,
    })
    const textWrapGroup = new TextWrapGroup({
        fragments: [
            { text: "Long-word-that-can't-be-broken-up more words" },
            { text: "30 million" },
        ],
        maxWidth,
        fontSize: FONT_SIZE,
    })
    expect(textWrap.width).toBeGreaterThan(maxWidth)
    expect(textWrapGroup.maxWidth).toEqual(textWrap.width)
})
