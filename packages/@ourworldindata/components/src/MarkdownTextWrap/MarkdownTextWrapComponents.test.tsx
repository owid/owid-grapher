/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { MarkdownTextWrap } from "./MarkdownTextWrap.js"
import { AbstractTokenTextWrap } from "./AbstractTokenTextWrap.js"
import {
    FIGMA_TEXT_NODE_BREAK_DY,
    MarkdownTextWrapSvg,
} from "./MarkdownTextWrapComponents.js"

function renderLines(
    textWrap: AbstractTokenTextWrap,
    textAnchor?: "start" | "middle"
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

function nudgedRuns(line: Element): string[] {
    return Array.from(
        line.querySelectorAll(`tspan[dy="${FIGMA_TEXT_NODE_BREAK_DY}"]`)
    ).map((tspan) => tspan.textContent ?? "")
}

const markdown = (text: string): MarkdownTextWrap =>
    new MarkdownTextWrap({ text, fontSize: 13, maxWidth: 1000 })

describe(MarkdownTextWrapSvg, () => {
    it("positions a line's leading tspan at the line's position", () => {
        const [firstLine, secondLine] = renderLines(
            markdown("Plain line\n**Bold** start")
        )

        expect(firstLine.firstElementChild).toBeNull()

        const leadingTspan = secondLine.firstElementChild!
        expect(leadingTspan.textContent).toBe("Bold")
        expect(leadingTspan.getAttribute("x")).toBe(
            secondLine.getAttribute("x")
        )
        expect(leadingTspan.getAttribute("y")).toBe(
            secondLine.getAttribute("y")
        )
    })

    it("moves the text after a leading bold run to its own baseline", () => {
        const [line] = renderLines(markdown("**Data source:** UN WPP"))

        expect(line.textContent).toBe("Data source: UN WPP")
        expect(nudgedRuns(line)).toEqual([" UN WPP"])
    })

    it("keeps lines that start with plain text on one baseline", () => {
        const [line] = renderLines(markdown("Plain **bold** plain"))

        expect(nudgedRuns(line)).toEqual([])
    })

    it("keeps centred text on one baseline", () => {
        const [line] = renderLines(
            markdown("**Data source:** UN WPP"),
            "middle"
        )

        expect(nudgedRuns(line)).toEqual([])
    })
})
