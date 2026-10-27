/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { MarkdownTextWrap } from "./MarkdownTextWrap.js"
import { AbstractTokenTextWrap } from "./AbstractTokenTextWrap.js"
import { TextWrapGroup } from "./TextWrapGroup.js"
import { FIGMA_TEXT_NODE_BREAK_DY } from "./IRTokens.js"
import { MarkdownTextWrapSvg } from "./MarkdownTextWrapComponents.js"
import { FontFamily } from "@ourworldindata/utils"

function renderLines(
    textWrap: AbstractTokenTextWrap,
    textAnchor?: "start" | "middle" | "end"
): Element[] {
    const { container } = render(
        <svg>
            <MarkdownTextWrapSvg
                textWrap={textWrap}
                x={10}
                y={20}
                textAnchor={textAnchor}
            />
        </svg>
    )
    return Array.from(container.querySelectorAll("text > tspan"))
}

function nudgedRuns(line: Element): Element[] {
    return Array.from(
        line.querySelectorAll(`tspan[dy="${FIGMA_TEXT_NODE_BREAK_DY}"]`)
    )
}

const markdown = (text: string): MarkdownTextWrap =>
    new MarkdownTextWrap({ text, fontSize: 13, maxWidth: 1000 })

describe(MarkdownTextWrapSvg, () => {
    it.each([
        { start: "bold", text: "Plain line\n**Bold** start", leading: "Bold" },
        {
            start: "a detail on demand",
            text: "Plain line\n[term](#dod:term) start",
            leading: "term",
        },
    ])(
        "positions a line's leading tspan at the line's position when it starts with $start",
        ({ text, leading }) => {
            const [firstLine, secondLine] = renderLines(markdown(text))

            expect(firstLine.firstElementChild).toBeNull()

            const leadingTspan = secondLine.firstElementChild!
            expect(leadingTspan.textContent).toBe(leading)
            expect(leadingTspan.getAttribute("x")).toBe(
                secondLine.getAttribute("x")
            )
            expect(leadingTspan.getAttribute("y")).toBe(
                secondLine.getAttribute("y")
            )
        }
    )

    it.each([
        {
            start: "bold",
            text: "**Data source:** UN WPP",
            plaintext: "Data source: UN WPP",
        },
        {
            start: "a link",
            text: "[Data source:](https://un.org) UN WPP",
            plaintext: "Data source: UN WPP",
        },
    ])(
        "moves the text after a leading $start run to its own baseline",
        ({ text, plaintext }) => {
            const [line] = renderLines(markdown(text))

            expect(line.textContent).toBe(plaintext)
            const runs = nudgedRuns(line)
            expect(runs.map((run) => run.textContent)).toEqual([" UN WPP"])
            expect(runs[0].getAttribute("xml:space")).toBe("preserve")
        }
    )

    it.each([
        { case: "starts with plain text", text: "Plain **bold** plain" },
        {
            case: "starts with a detail on demand",
            text: "[term](#dod:term) rest",
        },
        { case: "is a single bold run", text: "**Only bold**" },
        {
            case: "is centred",
            text: "**Data source:** UN WPP",
            textAnchor: "middle" as const,
        },
        {
            case: "is right-aligned",
            text: "**Data source:** UN WPP",
            textAnchor: "end" as const,
        },
    ])("keeps a line that $case on one baseline", ({ text, textAnchor }) => {
        const [line] = renderLines(markdown(text), textAnchor)

        expect(nudgedRuns(line)).toEqual([])
    })

    it("moves a fragment with its own font family or gap onto its own baseline", () => {
        const title = new TextWrapGroup({
            fragments: [
                { text: "Population" },
                {
                    text: "2024",
                    fontFamily: FontFamily.Lato,
                    fontWeight: 700,
                    inlineGap: 6,
                },
            ],
            fontFamily: FontFamily.PlayfairDisplay,
            fontSize: 24,
            maxWidth: 1000,
        })

        const [line] = renderLines(title)

        const suffix = Array.from(line.querySelectorAll("tspan")).find(
            (tspan) => tspan.textContent === "2024"
        )!
        expect(suffix.getAttribute("dx")).toBe("6")
        expect(suffix.getAttribute("dy")).toBe(String(FIGMA_TEXT_NODE_BREAK_DY))
    })
})
