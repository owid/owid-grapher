/**
 * @vitest-environment happy-dom
 */

import * as React from "react"
import { render } from "@testing-library/react"
import { expect, it, describe } from "vitest"

import { NumericBin } from "../color/ColorScaleBin"
import { HorizontalNumericColorLegend } from "./HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendState } from "./HorizontalNumericColorLegendState"
import { Emphasis } from "../interaction/Emphasis"

describe(HorizontalNumericColorLegend, () => {
    it("renders highlighted bins as non-interactive overlays", () => {
        const highlightedBin = new NumericBin({
            isFirst: true,
            isOpenLeft: false,
            isOpenRight: false,
            min: 0,
            max: 1,
            displayMin: "0",
            displayMax: "1",
            color: "#fff",
        })
        const otherBin = new NumericBin({
            isFirst: false,
            isOpenLeft: false,
            isOpenRight: false,
            min: 1,
            max: 2,
            displayMin: "1",
            displayMax: "2",
            color: "#000",
        })

        const state = new HorizontalNumericColorLegendState(
            [highlightedBin, otherBin],
            {
                maxWidth: 200,
                resolveBinEmphasis: (bin) =>
                    bin === highlightedBin
                        ? Emphasis.Highlighted
                        : Emphasis.Default,
            }
        )

        const { container } = render(
            React.createElement(
                "svg",
                undefined,
                React.createElement(HorizontalNumericColorLegend, {
                    state,
                    x: 0,
                    y: 0,
                })
            )
        )

        const swatches = container.querySelector("#swatches")!
        const [firstBin, , highlightOverlay] = Array.from(swatches.children)

        expect(swatches.children).toHaveLength(3)
        expect(highlightOverlay.getAttribute("x")).toBe(
            firstBin.getAttribute("x")
        )
        expect(highlightOverlay.getAttribute("pointer-events")).toBe("none")
    })
})
