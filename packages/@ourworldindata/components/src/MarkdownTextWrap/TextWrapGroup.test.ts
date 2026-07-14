import { expect, it, describe } from "vitest"

import * as React from "react"
import {
    getDodUnderlineSegments,
    getLineWidth,
    lineToPlaintext,
    IRFragment,
    IRDetailOnDemand,
    IRSuperscript,
    type IRToken,
} from "./IRTokens.js"
import { TextWrapGroup } from "./TextWrapGroup.js"

const linesWithFragment = (wrap: TextWrapGroup, index: number): IRToken[][] =>
    wrap.svgLines.filter((line) =>
        line.some(
            (token) =>
                token instanceof IRFragment && token.fragmentIndex === index
        )
    )

/**
 * How each fragment was placed relative to the preceding content, derived
 * from the rendered lines: a fragment was placed on a new line iff its
 * first occurrence is the first token of its line.
 */
const fragmentPlacements = (
    wrap: TextWrapGroup
): ("first" | "inline" | "new-line")[] =>
    wrap.fragments.map((_, index) => {
        if (index === 0) return "first"
        const firstToken = linesWithFragment(wrap, index)[0][0]
        return firstToken instanceof IRFragment &&
            firstToken.fragmentIndex === index
            ? "new-line"
            : "inline"
    })

describe(TextWrapGroup, () => {
    const fontSize = 14

    it("should place fragments in one line if they fit", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                { text: "30 million" },
            ],
            maxWidth: 500,
            fontSize,
        })
        expect(textWrap.svgLines.length).toEqual(1)
        expect(textWrap.htmlLines.length).toEqual(1)
        expect(fragmentPlacements(textWrap)).toEqual(["first", "inline"])
    })

    it("should place a fragment in a new line if requested", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                { text: "30 million", newLine: "always" },
            ],
            maxWidth: 1000,
            fontSize,
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
        expect(fragmentPlacements(textWrap)).toEqual(["first", "new-line"])
    })

    it("should let a continue-line fragment wrap freely instead of moving it to a new line", () => {
        const makeGroup = (
            newLine: "continue-line" | "avoid-wrap"
        ): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "25%" },
                    { text: "died from cardiovascular diseases", newLine },
                ],
                maxWidth: 150,
                fontSize,
            })
        // with avoid-wrap, the fragment moves to a new line as a whole,
        // where it wraps internally since it exceeds a full line
        const avoided = makeGroup("avoid-wrap")
        expect(avoided.svgLines.length).toEqual(3)
        expect(fragmentPlacements(avoided)).toEqual(["first", "new-line"])
        expect(avoided.fragmentLineCounts).toEqual([1, 2])
        // with continue-line, the fragment continues on the first line
        const continued = makeGroup("continue-line")
        expect(continued.svgLines.length).toEqual(2)
        expect(lineToPlaintext(continued.svgLines[0])).toEqual("25% died from")
    })

    it("should wrap a continue-line fragment to the next line if the current line is full", () => {
        const firstFragmentWidth = new TextWrapGroup({
            fragments: [{ text: "Lower middle-income countries" }],
            fontSize,
        }).width
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                {
                    text: "cardiovascular",
                    newLine: "continue-line",
                    newLineGap: 10,
                },
            ],
            // no room for the second fragment on the first line
            maxWidth: firstFragmentWidth + 5,
            fontSize,
        })
        expect(textWrap.svgLines.map(lineToPlaintext)).toEqual([
            "Lower middle-income countries",
            "cardiovascular",
        ])
        // the new-line gap doesn't apply: the fragment flowed onto a new
        // line through wrapping, it wasn't placed there
        expect(textWrap.lineGaps).toEqual([0, 0])
    })

    it("should break before a continue-line fragment with an inline gap", () => {
        const makeGroup = (inlineGap?: number): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Lower middle-income countries" },
                    {
                        text: "cardiovascular",
                        newLine: "continue-line",
                        inlineGap,
                    },
                ],
                maxWidth: 200,
                fontSize,
            })
        // the gap provides the same break opportunity as a space: both
        // versions break between the fragments
        const expectedLines = [
            "Lower middle-income countries",
            "cardiovascular",
        ]
        expect(makeGroup().svgLines.map(lineToPlaintext)).toEqual(expectedLines)
        expect(makeGroup(4).svgLines.map(lineToPlaintext)).toEqual(
            expectedLines
        )
        // the gap is dropped when the fragment starts the new line
        const fragment = makeGroup(4).svgLines.at(-1)![0] as IRFragment
        expect(fragment.inlineGap).toEqual(0)
    })

    it("should move a fragment to a new line as a whole if it doesn't fit", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                { text: "30 million" },
            ],
            maxWidth: 250,
            fontSize,
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
        expect(fragmentPlacements(textWrap)).toEqual(["first", "new-line"])
    })

    it("should use all available space when one fragment exceeds the given max width", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Long-word-that-can't-be-broken-up more words" },
                { text: "30 million" },
            ],
            maxWidth: 150,
            fontSize,
        })
        expect(textWrap.width).toBeGreaterThan(150)
    })

    it("should place very long words in a separate line", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "30 million" },
                { text: "Long-word-that-can't-be-broken-up" },
            ],
            maxWidth: 150,
            fontSize,
        })
        expect(textWrap.svgLines.length).toEqual(2)
        expect(textWrap.htmlLines.length).toEqual(2)
    })

    it("should drop fragments with empty text", () => {
        const textWrap = new TextWrapGroup({
            fragments: [{ text: "Some text" }, { text: "  " }],
            fontSize,
        })
        expect(textWrap.fragments).toHaveLength(1)
        expect(fragmentPlacements(textWrap)).toEqual(["first"])
        expect(textWrap.plaintext).toEqual("Some text")
    })

    it("should handle a group with no non-empty fragments", () => {
        const textWrap = new TextWrapGroup({
            fragments: [{ text: "  " }],
            fontSize,
        })
        expect(textWrap.fragments).toEqual([])
        expect(textWrap.svgLines).toEqual([])
        expect(textWrap.htmlLines).toEqual([])
        expect(textWrap.plaintext).toEqual("")
        expect(textWrap.width).toEqual(0)
        expect(textWrap.height).toEqual(0)
    })

    it("should ignore placement options on the first fragment", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Some text", newLine: "always", newLineGap: 10 },
            ],
            fontSize,
            lineHeight: 1,
        })
        expect(textWrap.svgLines.length).toEqual(1)
        expect(textWrap.lineGaps).toEqual([0])
        expect(textWrap.height).toEqual(fontSize)
    })

    it("should treat the first non-empty fragment as the first fragment", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: " " },
                { text: "Some text", newLine: "always", newLineGap: 10 },
            ],
            fontSize,
            lineHeight: 1,
        })
        expect(textWrap.svgLines.length).toEqual(1)
        expect(textWrap.lineGaps).toEqual([0])
        expect(textWrap.plaintext).toEqual("Some text")
    })

    it("should honor hard line breaks within fragments", () => {
        const makeGroup = (markdown: boolean): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "first line\nsecond line", markdown },
                    { text: "annotation" },
                ],
                fontSize,
            })
        for (const textWrap of [makeGroup(false), makeGroup(true)]) {
            expect(textWrap.svgLines.map(lineToPlaintext)).toEqual([
                "first line",
                "second line annotation",
            ])
        }
    })

    it("should not parse markdown in plain-text fragments", () => {
        const textWrap = new TextWrapGroup({
            fragments: [{ text: "A **literal** asterisk" }],
            fontSize,
        })
        expect(textWrap.plaintext).toEqual("A **literal** asterisk")
    })

    it("should parse markdown in markdown fragments", () => {
        const textWrap = new TextWrapGroup({
            fragments: [{ text: "A **bold** word", markdown: true }],
            fontSize,
        })
        expect(textWrap.plaintext).toEqual("A bold word")
    })

    it("should measure fragments at their own font size", () => {
        const makeGroup = (annotationFontSize: number): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Some text" },
                    { text: "annotation", fontSize: annotationFontSize },
                ],
                fontSize: 20,
            })
        const small = makeGroup(10)
        const large = makeGroup(20)
        expect(small.width).toBeLessThan(large.width)
        expect(small.lastLineWidth).toBeLessThan(large.lastLineWidth)
    })

    it("should measure fragments at their own font weight", () => {
        const measure = (props: {
            fontWeight?: number
            groupFontWeight?: number
        }): number =>
            new TextWrapGroup({
                fragments: [
                    { text: "Some text", fontWeight: props.fontWeight },
                ],
                fontSize,
                fontWeight: props.groupFontWeight,
            }).width
        // bold text measures wider than regular text
        expect(measure({ fontWeight: 700 })).toBeGreaterThan(measure({}))
        // fragments fall back to the group-level font weight
        expect(measure({ groupFontWeight: 700 })).toEqual(
            measure({ fontWeight: 700 })
        )
    })

    it("should measure the fit against the last line of a wrapped fragment", () => {
        const makeGroup = (secondText: string): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Lower middle-income countries" },
                    { text: secondText },
                ],
                maxWidth: 100,
                fontSize,
            })
        // the first fragment wraps; a short second fragment still fits
        // inline on its last line
        const withShortFragment = makeGroup("30")
        expect(withShortFragment.fragmentLineCounts).toEqual([3, 1])
        expect(fragmentPlacements(withShortFragment)).toEqual([
            "first",
            "inline",
        ])
        // a longer second fragment moves to a new line
        const withLongFragment = makeGroup("30 million")
        expect(withLongFragment.fragmentLineCounts).toEqual([3, 1])
        expect(fragmentPlacements(withLongFragment)).toEqual([
            "first",
            "new-line",
        ])
    })

    it("should use tighter line heights for lines with smaller fragments", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                { text: "30 million", fontSize: 7, newLine: "always" },
            ],
            fontSize,
            lineHeight: 1,
        })
        expect(fragmentPlacements(textWrap)).toEqual(["first", "new-line"])
        expect(textWrap.lineHeights).toEqual([fontSize, 7])
        expect(textWrap.height).toEqual(fontSize + 7)
    })

    it("should apply the line gap only when the fragment starts a new line", () => {
        const makeGroup = (
            newLine: "always" | "avoid-wrap",
            maxWidth = Infinity
        ): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Lower middle-income countries" },
                    {
                        text: "30 million",
                        fontSize: 7,
                        newLineGap: 10,
                        newLine,
                    },
                ],
                maxWidth,
                fontSize,
                lineHeight: 1,
            })
        // on its own line, the gap is added above the fragment's line
        const withNewLine = makeGroup("always")
        expect(withNewLine.lineGaps).toEqual([0, 10])
        expect(withNewLine.height).toEqual(fontSize + 10 + 7)
        // inline, the gap is ignored
        const inline = makeGroup("avoid-wrap")
        expect(inline.lineGaps).toEqual([0])
        expect(inline.height).toEqual(fontSize)
        // an avoid-wrap fragment that is moved to a new line gets the gap
        const bumped = makeGroup("avoid-wrap", 220)
        expect(fragmentPlacements(bumped)).toEqual(["first", "new-line"])
        expect(bumped.lineGaps).toEqual([0, 10])
    })

    it("should apply the line gap only once when the fragment wraps", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Long-run estimates of interpersonal trust" },
                {
                    text: "an annotation that is long enough to wrap across several lines",
                    fontSize: 7,
                    newLineGap: 10,
                    newLine: "always",
                },
            ],
            maxWidth: 100,
            fontSize,
            lineHeight: 1,
        })
        const annotationLineCount = textWrap.fragmentLineCounts[1]
        expect(annotationLineCount).toBeGreaterThan(1)
        // the gap precedes the fragment's first line only
        expect(textWrap.lineGaps.filter((gap) => gap > 0)).toEqual([10])
    })

    it("should use an explicit gap between fragments if given", () => {
        const makeGroup = (inlineGap: number): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Some text" },
                    { text: "annotation", inlineGap },
                ],
                fontSize,
            })
        const withSmallGap = makeGroup(4)
        const withLargeGap = makeGroup(24)
        expect(withLargeGap.width - withSmallGap.width).toEqual(20)
        expect(withLargeGap.lastLineWidth - withSmallGap.lastLineWidth).toEqual(
            20
        )

        // the total width is the sum of the fragment widths plus the gap
        const measureText = (text: string): number =>
            new TextWrapGroup({ fragments: [{ text }], fontSize }).width
        expect(withSmallGap.width).toEqual(
            measureText("Some text") + 4 + measureText("annotation")
        )

        // no separate whitespace token; the gap is baked into the fragment
        const line = withSmallGap.svgLines[0]
        expect(line).toHaveLength(2)
        const fragment = line[1] as IRFragment
        expect(fragment.inlineGap).toEqual(4)

        const svg = fragment.toSVG() as React.ReactElement<{ dx?: number }>
        expect(svg.type).toEqual("tspan")
        expect(svg.props.dx).toEqual(4)

        const html = fragment.toHTML() as React.ReactElement<{
            style: React.CSSProperties
        }>
        expect(html.type).toEqual("span")
        expect(html.props.style.marginLeft).toEqual(4)
        // atomic inline, so that a link underline doesn't continue
        // across the fragment
        expect(html.props.style.display).toEqual("inline-block")
    })

    it("should account for the inline gap when deciding if a fragment fits", () => {
        const makeGroup = (inlineGap: number): TextWrapGroup =>
            new TextWrapGroup({
                fragments: [
                    { text: "Lower middle-income countries" },
                    { text: "30 million", inlineGap },
                ],
                maxWidth: 300,
                fontSize,
            })
        // with a small gap the fragment fits inline; a large gap pushes it
        // to a new line even though the text alone would fit
        expect(fragmentPlacements(makeGroup(4))).toEqual(["first", "inline"])
        expect(fragmentPlacements(makeGroup(100))).toEqual([
            "first",
            "new-line",
        ])
    })

    it("should ignore the gap when the fragment starts a new line", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Lower middle-income countries" },
                { text: "30 million", inlineGap: 6 },
            ],
            maxWidth: 250,
            fontSize,
        })
        expect(fragmentPlacements(textWrap)).toEqual(["first", "new-line"])
        const fragment = textWrap.svgLines.at(-1)![0] as IRFragment
        expect(fragment.inlineGap).toEqual(0)
    })

    it("should render no wrapper element for fragments that match the group style", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "plain text" },
                // explicitly given, but identical to the group style
                { text: "same style", fontSize, fontWeight: 400 },
            ],
            fontSize,
            fontWeight: 400,
        })
        const fragments = textWrap.svgLines[0].filter(
            (token) => token instanceof IRFragment
        )
        expect(fragments).toHaveLength(2)
        for (const fragment of fragments) {
            expect(fragment.toSVG().type).toEqual(React.Fragment)
            expect(fragment.toHTML().type).toEqual(React.Fragment)
        }
    })

    it("should render a styled wrapper for fragments that differ from the group style", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "main" },
                {
                    text: "annotation",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#767676",
                },
            ],
            fontSize,
        })
        const fragment = textWrap.svgLines[0].at(-1) as IRFragment

        const svg = fragment.toSVG() as React.ReactElement<{
            style: React.CSSProperties
        }>
        expect(svg.type).toEqual("tspan")
        expect(svg.props.style).toMatchObject({
            fontSize: 10,
            fontWeight: 700,
            fill: "#767676",
        })

        const html = fragment.toHTML() as React.ReactElement<{
            style: React.CSSProperties
        }>
        expect(html.type).toEqual("span")
        expect(html.props.style).toMatchObject({
            // atomic inline, so that a link underline doesn't extend into
            // the fragment (relevant when it's placed on its own line)
            display: "inline-block",
            fontSize: 10,
            fontWeight: 700,
            color: "#767676",
        })
    })

    it("should append superscript reference numbers to details on demand", () => {
        const textWrap = new TextWrapGroup({
            fragments: [{ text: "A [dod](#dod:example) term", markdown: true }],
            fontSize,
            detailsOrderedByReference: ["example"],
        })
        const fragment = textWrap
            .svgLinesWithDodReferenceNumbers[0][0] as IRFragment
        const dod = fragment.children.find(
            (token) => token instanceof IRDetailOnDemand
        ) as IRDetailOnDemand
        expect(dod).toBeInstanceOf(IRDetailOnDemand)
        expect(dod.children.at(-1)).toBeInstanceOf(IRSuperscript)
    })

    it("should find underline segments for DoDs nested inside fragments", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                {
                    text: "Deaths from [malaria](#dod:malaria)",
                    fontWeight: 700,
                    markdown: true,
                },
                { text: "(per 100,000 people)" },
            ],
            maxWidth: 1000,
            fontSize,
        })
        const line = textWrap.svgLines[0]
        const fragment = line[0] as IRFragment
        const dodIndex = fragment.children.findIndex(
            (token) => token instanceof IRDetailOnDemand
        )

        expect(getDodUnderlineSegments(line)).toEqual([
            {
                x: getLineWidth(fragment.children.slice(0, dodIndex)),
                width: fragment.children[dodIndex].width,
            },
        ])
    })

    it("should offset underline segments by a fragment's inline gap", () => {
        const inlineGap = 10
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Deaths" },
                {
                    text: "[malaria](#dod:malaria)",
                    markdown: true,
                    newLine: "continue-line",
                    inlineGap,
                },
            ],
            maxWidth: 1000,
            fontSize,
        })
        const line = textWrap.svgLines[0]
        const dodFragment = line.at(-1) as IRFragment

        expect(dodFragment.inlineGap).toEqual(inlineGap)
        expect(getDodUnderlineSegments(line)).toEqual([
            {
                x: getLineWidth(line.slice(0, -1)) + inlineGap,
                width: dodFragment.width - inlineGap,
            },
        ])
    })

    it("should place a longer sequence of fragments with mixed modes", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Energy use" },
                { text: "(kilowatt-hours per person)", newLine: "always" },
                { text: "annotation" },
            ],
            maxWidth: 300,
            fontSize,
        })
        expect(fragmentPlacements(textWrap)).toEqual([
            "first",
            "new-line",
            "inline",
        ])
        expect(textWrap.svgLines.map(lineToPlaintext)).toEqual([
            "Energy use",
            "(kilowatt-hours per person) annotation",
        ])
    })

    it("should lay out axis-style labels (bold main label plus unit)", () => {
        const textWrap = new TextWrapGroup({
            fragments: [
                { text: "Energy use", fontWeight: 700, markdown: true },
                { text: "(kilowatt-hours per person)", markdown: true },
            ],
            maxWidth: 300,
            fontSize,
            lineHeight: 1,
        })
        expect(textWrap.plaintext).toEqual(
            "Energy use (kilowatt-hours per person)"
        )
        expect(textWrap.svgLines.length).toEqual(1)

        const mainFragment = textWrap.svgLines[0][0] as IRFragment
        const svg = mainFragment.toSVG() as React.ReactElement<{
            style: React.CSSProperties
        }>
        expect(svg.type).toEqual("tspan")
        expect(svg.props.style).toMatchObject({ fontWeight: 700 })
    })
})
