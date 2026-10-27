/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { SeriesLabel } from "./SeriesLabel"
import { SeriesLabelState } from "./SeriesLabelState"

function renderSpans(state: SeriesLabelState): Element[] {
    const { container } = render(
        <svg>
            <SeriesLabel state={state} x={500} y={20} />
        </svg>
    )
    return Array.from(container.querySelectorAll("text > tspan"))
}

/** "Africa (WHO)" on the first line, "72%" on the second, 12px apart */
const labelWithSuffixAndValue = ({
    fontWeight,
    textAnchor,
}: {
    fontWeight: number
    textAnchor: "start" | "end"
}): SeriesLabelState =>
    new SeriesLabelState({
        text: "Africa (WHO)",
        formattedValue: "72%",
        fontSize: 10,
        lineHeight: 1.2,
        fontWeight,
        maxWidth: Infinity,
        textAnchor,
    })

describe(SeriesLabel, () => {
    it("preserves the space at the start of a span", () => {
        const spans = renderSpans(
            new SeriesLabelState({
                text: "Sub-Saharan Africa (WB)",
                fontSize: 14,
                fontWeight: 700,
                maxWidth: Infinity,
                textAnchor: "end",
            })
        )

        expect(spans.map((span) => span.getAttribute("xml:space"))).toEqual([
            null,
            "preserve",
        ])
    })

    it("moves the text after a bold name to its own baseline and moves back on the next line", () => {
        const spans = renderSpans(
            labelWithSuffixAndValue({ fontWeight: 700, textAnchor: "start" })
        )

        expect(spans.map((span) => span.textContent)).toEqual([
            "Africa",
            " (WHO)",
            "72%",
        ])
        expect(spans.map((span) => span.getAttribute("dy"))).toEqual([
            null,
            "0.01",
            "11.99",
        ])
    })

    it.each([
        { case: "right-aligned", fontWeight: 700, textAnchor: "end" as const },
        {
            case: "in a single weight",
            fontWeight: 400,
            textAnchor: "start" as const,
        },
    ])("keeps a label $case on one baseline per line", (options) => {
        const spans = renderSpans(labelWithSuffixAndValue(options))

        expect(spans.map((span) => span.getAttribute("dy"))).toEqual([
            null,
            null,
            "12",
        ])
    })
})
