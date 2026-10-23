/**
 * @vitest-environment happy-dom
 */

import * as React from "react"
import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CategoricalBin } from "../color/ColorScaleBin"
import { HorizontalOrdinalColorLegend } from "./HorizontalOrdinalColorLegend"
import { HorizontalOrdinalColorLegendState } from "./HorizontalOrdinalColorLegendState"
import { OrdinalLabel } from "./HorizontalColorLegendTypes"
import {
    BIN_MAX_WIDTH_EM,
    BIN_LABEL_PADDING,
} from "./HorizontalColorLegendConstants"

const MARRIAGE_CATEGORIES = [
    "Legal",
    "Civil union or other partnership",
    "Foreign same-sex marriages recognized only",
    "Unregistered cohabitation",
    "Varies by region",
    "Ambiguous",
    "Unrecognized",
    "Banned",
]

function makeBin(
    index: number,
    label: string,
    isHidden = false
): CategoricalBin {
    return new CategoricalBin({
        index,
        value: label,
        label,
        color: "#888",
        isHidden,
    })
}

function makeState({
    categories,
    maxWidth,
    baseFontSize,
    noData = true,
}: {
    categories: string[]
    maxWidth: number
    baseFontSize: number
    noData?: boolean
}): HorizontalOrdinalColorLegendState {
    return new HorizontalOrdinalColorLegendState(
        [
            ...(noData ? [makeBin(-1, "No data")] : []),
            ...categories.map((label, index) => makeBin(index, label)),
        ],
        { maxWidth, baseFontSize }
    )
}

function boxesIntersect(a: OrdinalLabel, b: OrdinalLabel): boolean {
    return (
        a.left < b.left + b.textWrap.width &&
        b.left < a.left + a.textWrap.width &&
        a.top < b.top + b.textWrap.height &&
        b.top < a.top + a.textWrap.height
    )
}

describe(HorizontalOrdinalColorLegendState, () => {
    it("labels each visible category once, in order, on equally wide bins", () => {
        const hiddenBin = makeBin(99, "Hidden", true)
        const state = new HorizontalOrdinalColorLegendState(
            [
                makeBin(-1, "No data"),
                ...MARRIAGE_CATEGORIES.slice(0, 3).map((label, index) =>
                    makeBin(index, label)
                ),
                hiddenBin,
                ...MARRIAGE_CATEGORIES.slice(3).map((label, index) =>
                    makeBin(index + 3, label)
                ),
            ],
            { maxWidth: 830, baseFontSize: 16 }
        )

        const labelTexts = state.labels.map((label) => label.bin.text)
        expect(labelTexts).toEqual(["No data", ...MARRIAGE_CATEGORIES])
        expect(state.labels.map((label) => label.bin)).not.toContain(hiddenBin)

        const categoryWidths = state.positionedBins
            .filter(({ bin }) => bin.text !== "No data")
            .map(({ width }) => width)
        expect(categoryWidths).toHaveLength(MARRIAGE_CATEGORIES.length)
        for (const width of categoryWidths) {
            expect(width).toBeCloseTo(categoryWidths[0], 6)
        }
    })

    it("keeps the No data label clear of the category labels on its side at mobile width", () => {
        const state = makeState({
            categories: MARRIAGE_CATEGORIES,
            maxWidth: 355,
            baseFontSize: 14,
        })

        const { labels } = state
        const noDataLabel = labels.find(
            (label) => label.bin.text === "No data"
        )!
        const sameSideLabels = labels.filter(
            (label) => label !== noDataLabel && label.side === noDataLabel.side
        )

        for (const label of sameSideLabels) {
            expect(
                boxesIntersect(noDataLabel, label),
                `"No data" overlaps "${label.bin.text}"`
            ).toBe(false)
        }
    })

    it("includes the labels below the bins in the height when there are any", () => {
        const state = makeState({
            categories: MARRIAGE_CATEGORIES,
            maxWidth: 355,
            baseFontSize: 14,
        })

        const belowLabels = state.labels.filter(
            (label) => label.side === "below"
        )
        expect(belowLabels.length).toBeGreaterThan(0)

        const tallestBelowHeight = Math.max(
            ...belowLabels.map((label) => label.textWrap.height)
        )
        expect(state.height).toBeCloseTo(
            state.binY +
                state.binHeight +
                BIN_LABEL_PADDING +
                tallestBelowHeight,
            6
        )
    })

    it("ends at the bins when every label sits above it", () => {
        const state = makeState({
            categories: ["Low", "Medium", "High"],
            maxWidth: 1000,
            baseFontSize: 16,
            noData: false,
        })

        expect(state.labels.every((label) => label.side === "above")).toBe(true)
        expect(state.height).toBeCloseTo(state.binY + state.binHeight, 6)
    })

    it("wraps a long label instead of widening every bin past the maximum", () => {
        const longLabel =
            "Only those who both have symptoms and meet specific criteria"
        const state = makeState({
            categories: ["No testing policy", longLabel, "Open public testing"],
            maxWidth: 1000,
            baseFontSize: 13,
            noData: false,
        })

        const maxBinWidth = 13 * BIN_MAX_WIDTH_EM
        for (const { width } of state.positionedBins) {
            expect(width).toBeCloseTo(maxBinWidth, 6)
        }
        expect(state.width).toBeLessThan(1000)

        const longLabelWrap = state.labels.find(
            (label) => label.bin.text === longLabel
        )!.textWrap
        expect(longLabelWrap.lineCount).toBeGreaterThan(1)
    })

    it("wraps a long custom No data label instead of squeezing the category bins", () => {
        const noDataBin = new CategoricalBin({
            index: -1,
            value: "No data",
            label: "Data not available because the country did not take part in the survey",
            color: "#eee",
        })
        const state = new HorizontalOrdinalColorLegendState(
            [
                noDataBin,
                ...MARRIAGE_CATEGORIES.map((label, index) =>
                    makeBin(index, label)
                ),
            ],
            { maxWidth: 345, baseFontSize: 13 }
        )

        const [noDataPositioned, ...categoryPositioned] = state.positionedBins
        for (const { width } of categoryPositioned) {
            expect(width).toBeGreaterThanOrEqual(noDataPositioned.width)
        }
        expect(state.width).toBeLessThanOrEqual(345)

        const noDataLabel = state.labels.find(
            (label) => label.bin === noDataBin
        )!
        expect(noDataLabel.textWrap.lineCount).toBeGreaterThan(1)
    })
})

describe(HorizontalOrdinalColorLegend, () => {
    function renderLegend(): {
        container: HTMLElement
        state: HorizontalOrdinalColorLegendState
        onMouseOver: ReturnType<typeof vi.fn>
    } {
        const state = makeState({
            categories: MARRIAGE_CATEGORIES,
            maxWidth: 355,
            baseFontSize: 14,
        })
        const onMouseOver = vi.fn()
        const { container } = render(
            React.createElement(
                "svg",
                undefined,
                React.createElement(HorizontalOrdinalColorLegend, {
                    state,
                    x: 0,
                    y: 10,
                    onMouseOver,
                })
            )
        )
        return { container, state, onMouseOver }
    }

    function getHoverRects(container: HTMLElement): SVGRectElement[] {
        const group = container.querySelector("g[aria-hidden='true']")!
        return Array.from(group.querySelectorAll("rect"))
    }

    it("covers the full legend column of each bin, labels included", () => {
        const { container, state } = renderLegend()

        const hoverRects = getHoverRects(container)
        expect(hoverRects).toHaveLength(state.positionedBins.length)
        for (const [index, rect] of hoverRects.entries()) {
            expect(Number(rect.getAttribute("x"))).toBeCloseTo(
                state.positionedBins[index].x,
                1
            )
            expect(Number(rect.getAttribute("y"))).toBeCloseTo(10, 1)
            expect(Number(rect.getAttribute("height"))).toBeCloseTo(
                state.height,
                1
            )
        }
    })

    it("reports the bin under a mouse pointer", () => {
        const { container, state, onMouseOver } = renderLegend()
        const index = 3

        fireEvent.pointerEnter(getHoverRects(container)[index], {
            pointerType: "mouse",
        })

        expect(onMouseOver).toHaveBeenCalledOnce()
        expect(onMouseOver).toHaveBeenCalledWith(
            state.positionedBins[index].bin
        )
    })

    it("reports the bin on a touch tap but not on touch pointer enter", () => {
        const { container, state, onMouseOver } = renderLegend()
        const index = 5
        const rect = getHoverRects(container)[index]

        fireEvent.pointerEnter(rect, { pointerType: "touch" })
        expect(onMouseOver).not.toHaveBeenCalled()

        fireEvent.pointerUp(rect, { pointerType: "touch" })
        expect(onMouseOver).toHaveBeenCalledWith(
            state.positionedBins[index].bin
        )
    })
})
