/**
 * @vitest-environment happy-dom
 */

import * as React from "react"
import { fireEvent, render } from "@testing-library/react"
import { expect, it, describe, vi } from "vitest"

import { CategoricalBin, NumericBin } from "../color/ColorScaleBin"
import {
    HorizontalCategoricalColorLegend,
    HorizontalNumericColorLegend,
    PositionedBin,
} from "./HorizontalColorLegends"
import { Emphasis } from "../interaction/Emphasis"

describe(HorizontalNumericColorLegend, () => {
    it("can create one", () => {
        const bin = new NumericBin({
            isFirst: false,
            isOpenLeft: false,
            isOpenRight: true,
            min: 0,
            max: 100,
            displayMin: "Zero",
            displayMax: "One hundred",
            color: "blue",
        })

        const legend = new HorizontalNumericColorLegend({
            manager: { numericLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })

    it("adds margins between categorical but not numeric bins", () => {
        const legend = new HorizontalNumericColorLegend({
            manager: {
                numericLegendData: [
                    new CategoricalBin({
                        index: 0,
                        value: "a",
                        label: "a",
                        color: "#fff",
                    }),
                    new CategoricalBin({
                        index: 0,
                        value: "b",
                        label: "b",
                        color: "#fff",
                    }),
                    new NumericBin({
                        isFirst: true,
                        isOpenLeft: false,
                        isOpenRight: false,
                        min: 0,
                        max: 1,
                        displayMin: "0",
                        displayMax: "1",
                        color: "#fff",
                    }),
                    new NumericBin({
                        isFirst: false,
                        isOpenLeft: false,
                        isOpenRight: false,
                        min: 1,
                        max: 2,
                        displayMin: "1",
                        displayMax: "2",
                        color: "#fff",
                    }),
                    new CategoricalBin({
                        index: 0,
                        value: "c",
                        label: "c",
                        color: "#fff",
                    }),
                ],
            },
        })

        const margin = legend["itemMargin"]
        const bins = legend["positionedBins"]

        function marginBetween(
            binA: PositionedBin,
            binB: PositionedBin
        ): number {
            return binB.x - (binA.x + binA.width)
        }

        expect(bins).toHaveLength(5)
        expect(marginBetween(bins[0], bins[1])).toEqual(margin)
        expect(marginBetween(bins[1], bins[2])).toEqual(margin)
        expect(marginBetween(bins[2], bins[3])).toEqual(0)
        expect(marginBetween(bins[3], bins[4])).toEqual(margin)
    })

    it("clears legend hover when the pointer leaves a bin", () => {
        const bin = new NumericBin({
            isFirst: true,
            isOpenLeft: false,
            isOpenRight: false,
            min: 0,
            max: 1,
            displayMin: "0",
            displayMax: "1",
            color: "#fff",
        })
        const onLegendMouseOver = vi.fn()
        const onLegendMouseLeave = vi.fn()
        const onLegendTouchSelect = vi.fn()

        const { container } = render(
            React.createElement(
                "svg",
                undefined,
                React.createElement(HorizontalNumericColorLegend, {
                    manager: {
                        numericLegendData: [bin],
                        onLegendMouseOver,
                        onLegendMouseLeave,
                        onLegendTouchSelect,
                    },
                })
            )
        )
        const swatch = container.querySelector("#swatches > *")
        const hitArea = container.querySelector("#swatch-hit-areas > rect")

        expect(swatch).not.toBeNull()
        expect(hitArea).not.toBeNull()
        expect(Number(hitArea!.getAttribute("y"))).toBeLessThan(
            Number(swatch!.getAttribute("y"))
        )
        expect(
            Number(hitArea!.getAttribute("y")) +
                Number(hitArea!.getAttribute("height"))
        ).toBe(Number(swatch!.getAttribute("y")))

        fireEvent.pointerEnter(hitArea!, { pointerType: "mouse" })
        fireEvent.pointerLeave(hitArea!, { pointerType: "mouse" })
        fireEvent.pointerUp(hitArea!, { pointerType: "mouse" })

        expect(onLegendMouseOver).not.toHaveBeenCalled()
        expect(onLegendMouseLeave).not.toHaveBeenCalled()
        expect(onLegendTouchSelect).not.toHaveBeenCalled()

        fireEvent.pointerEnter(swatch!, { pointerType: "mouse" })
        fireEvent.pointerLeave(swatch!, { pointerType: "mouse" })
        fireEvent.pointerUp(swatch!, { pointerType: "mouse" })

        expect(onLegendMouseOver).toHaveBeenCalledWith(bin)
        expect(onLegendMouseLeave).toHaveBeenCalledOnce()
        expect(onLegendTouchSelect).not.toHaveBeenCalled()

        fireEvent.pointerEnter(hitArea!, { pointerType: "touch" })

        expect(onLegendMouseOver).toHaveBeenCalledOnce()

        fireEvent.pointerUp(hitArea!, { pointerType: "touch" })

        expect(onLegendTouchSelect).toHaveBeenCalledWith(bin)

        fireEvent.pointerEnter(swatch!, { pointerType: "touch" })

        expect(onLegendMouseOver).toHaveBeenCalledOnce()

        fireEvent.pointerUp(swatch!, { pointerType: "touch" })

        expect(onLegendTouchSelect).toHaveBeenCalledTimes(2)
    })

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

        const { container } = render(
            React.createElement(
                "svg",
                undefined,
                React.createElement(HorizontalNumericColorLegend, {
                    manager: {
                        numericLegendData: [highlightedBin, otherBin],
                        resolveLegendBinEmphasis: (bin) =>
                            bin === highlightedBin
                                ? Emphasis.Highlighted
                                : Emphasis.Default,
                    },
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

describe(HorizontalCategoricalColorLegend, () => {
    it("can create one", () => {
        const bin = new CategoricalBin({
            index: 1,
            value: "North America",
            label: "100",
            color: "red",
        })

        const legend = new HorizontalCategoricalColorLegend({
            manager: { categoricalLegendData: [bin] },
        })
        expect(legend.height).toBeGreaterThan(0)
    })
})
