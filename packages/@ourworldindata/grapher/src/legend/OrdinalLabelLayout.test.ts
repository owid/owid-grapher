import { describe, expect, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import { CategoricalBin } from "../color/ColorScaleBin"
import { MINIMUM_BIN_LABEL_DISTANCE } from "./HorizontalColorLegendConstants"
import { PositionedBin } from "./HorizontalColorLegendTypes"
import {
    layOutOrdinalLabels,
    PlacedBinLabel,
    findMaxLabelHeight,
} from "./OrdinalLabelLayout"

const FONT_SIZE = 12
const TOLERANCE = 1e-9

function textWidth(text: string): number {
    return Bounds.forText(text, { fontSize: FONT_SIZE }).width
}

function longestWordWidth(text: string): number {
    return Math.max(...text.split(" ").map(textWidth))
}

function binned(texts: string[], binWidth: number): PositionedBin[] {
    return texts.map((text, index) => ({
        x: index * binWidth,
        width: binWidth,
        bin: new CategoricalBin({
            index,
            value: text,
            label: text,
            color: "#888",
        }),
    }))
}

function findRightEdge({ x, width }: PositionedBin): number {
    return x + width
}

function expectCleanLayout(
    bins: PositionedBin[],
    placed: PlacedBinLabel[],
    maxWidth = Infinity
): void {
    placed.forEach((label, index) => {
        const { x: left, bin } = bins[index]
        const binRight = bins[index + 1]
            ? bins[index + 1].x - MINIMUM_BIN_LABEL_DISTANCE
            : findRightEdge(bins[index])
        const right = label.left + label.textWrap.width
        const isAtBinStart = label.left === left
        const isAtLegendEdge =
            Math.abs(label.left + label.textWrap.width - maxWidth) < TOLERANCE
        expect(isAtBinStart || isAtLegendEdge).toBe(true)
        expect(right).toBeLessThanOrEqual(
            Math.max(binRight, left + longestWordWidth(bin.text)) + TOLERANCE
        )
        expect(label.overflow).toBe(0)
    })

    for (const side of ["above", "below"] as const) {
        const onSide = placed.filter((label) => label.side === side)
        onSide.slice(1).forEach((label, position) => {
            const previous = onSide[position]
            const gap = label.left - (previous.left + previous.textWrap.width)
            expect(gap).toBeGreaterThanOrEqual(
                MINIMUM_BIN_LABEL_DISTANCE - TOLERANCE
            )
        })
    }
}

function findBest(
    bins: PositionedBin[],
    maxWidth = Infinity
): PlacedBinLabel[] {
    return layOutOrdinalLabels({ bins, maxWidth, fontSize: FONT_SIZE })
}

const LONG = "A considerably longer label than its neighbors need to be"
const LONGER = "Another considerably longer label than its neighbors need"
const MEDIUM = "Civil union or other partnership"
const UNBREAKABLE = "Antidisestablishmentarianism"

describe("wrapping", () => {
    it("wraps each label to the space before the next bin", () => {
        const bins = binned([LONG, MEDIUM, LONGER], 100)
        const placed = findBest(bins)

        placed.forEach(({ textWrap }, index) => {
            const isLast = index === bins.length - 1
            expect(textWrap.width).toBeLessThanOrEqual(
                isLast ? 100 : 100 - MINIMUM_BIN_LABEL_DISTANCE
            )
        })
        expectCleanLayout(bins, placed)
    })

    it("keeps a label whose words all fit inside its bin", () => {
        const bins = binned(["Legal", MEDIUM, "Legal"], 100)
        const placed = findBest(bins)

        expect(countBelow(placed)).toBe(0)
        expect(placed[1].textWrap.lineCount).toBeGreaterThan(1)
        expectCleanLayout(bins, placed)
    })
})

describe("overflow", () => {
    it("reports overflow for a word wider than the space left, and only there", () => {
        const bins = binned(["Legal", UNBREAKABLE], 60)
        const placed = findBest(bins)

        expect(placed[1].overflow).toBeCloseTo(
            bins[1].x + textWidth(UNBREAKABLE) - findRightEdge(bins[1]),
            9
        )
        expect(placed[0].overflow).toBe(0)
    })
})

const MARRIAGE = [
    "Legal",
    "Civil union or other partnership",
    "Foreign same-sex marriages recognized only",
    "Unregistered cohabitation",
    "Varies by region",
    "Ambiguous",
    "Unrecognized",
    "Banned",
]
const BLOOD = [
    "Legal",
    "Legal with restrictions",
    "Varies by region",
    "Ambiguous",
    "Banned (less than 6-month deferral)",
    "Banned (6-month deferral)",
    "Banned (1-year deferral)",
    "Banned (5-year deferral)",
    "Banned (indefinite deferral)",
]

function binsFor(texts: string[], binsWidth: number): PositionedBin[] {
    const widestLabelWidth = Math.max(
        ...texts.map(
            (text) => Bounds.forText(text, { fontSize: FONT_SIZE }).width
        )
    )
    const binWidth = Math.min(
        binsWidth / texts.length,
        widestLabelWidth + MINIMUM_BIN_LABEL_DISTANCE
    )
    return binned(texts, binWidth)
}

function totalOverflow(placed: PlacedBinLabel[]): number {
    return placed.reduce((sum, label) => sum + label.overflow, 0)
}

function countBelow(placed: PlacedBinLabel[]): number {
    return placed.filter((label) => label.side === "below").length
}

function expectNoNeighborsBelow(placed: PlacedBinLabel[]): void {
    placed.slice(1).forEach((label, position) => {
        expect(
            label.side === "below" && placed[position].side === "below"
        ).toBe(false)
    })
}

describe("legend edge", () => {
    const unbreakableWidth = textWidth(UNBREAKABLE)

    it("ends a last label whose word would pass the legend edge exactly at the edge", () => {
        const bins = binned(["Legal", UNBREAKABLE], 60)
        const maxWidth = bins[1].x + unbreakableWidth / 2
        const [, last] = findBest(bins, maxWidth)

        expect(last.left).toBeLessThan(bins[1].x)
        expect(last.left + last.textWrap.width).toBeCloseTo(maxWidth, 9)
    })

    it("keeps a label at its bin start when it fits before the legend edge, even past the right edge of the bins", () => {
        const bins = binned(["Legal", UNBREAKABLE], 60)
        const [, last] = findBest(bins, bins[1].x + unbreakableWidth + 10)

        expect(last.left).toBe(bins[1].x)
        expect(last.left + last.textWrap.width).toBeGreaterThan(
            findRightEdge(bins[1])
        )
    })

    it("moves the previous label to the other side when the shifted label would collide with it", () => {
        const [legal, banned, unbreakable] = binned(
            ["Legal", "Banned", UNBREAKABLE],
            60
        )
        const lastBin = { ...unbreakable, width: unbreakableWidth * 0.7 }
        const best = findBest([legal, banned, lastBin], findRightEdge(lastBin))

        expect(best[1].side).not.toBe(best[2].side)
        expect(totalOverflow(best)).toBe(0)
    })
})

describe(layOutOrdinalLabels, () => {
    it("keeps labels that fit in one row above the bins", () => {
        const placed = findBest(binsFor(MARRIAGE, 1080))

        expect(countBelow(placed)).toBe(0)
        expect(findMaxLabelHeight(placed, "below")).toBe(0)
        expect(totalOverflow(placed)).toBe(0)
    })

    it("moves the next label below the bins to make room for an unbreakable word", () => {
        const [legal, unbreakable, lastLegal] = binned(
            ["Legal", UNBREAKABLE, "Legal"],
            60
        )
        const best = findBest([
            legal,
            unbreakable,
            { ...lastLegal, width: 400 - lastLegal.x },
        ])

        expect(best.map((label) => label.side)).toEqual([
            "above",
            "above",
            "below",
        ])
        expect(totalOverflow(best)).toBe(0)
    })

    it("finds a layout without overlap when one row would overlap", () => {
        const bins = binsFor(MARRIAGE, 490)
        const best = findBest(bins)

        expect(totalOverflow(best)).toBe(0)
        expect(countBelow(best)).toBeGreaterThan(0)
        expect(countBelow(best)).toBeLessThan(bins.length)
        expectCleanLayout(bins, best)
    })

    it("never puts two neighboring labels below the bins", () => {
        for (const [texts, binsWidth] of [
            [MARRIAGE, 270],
            [BLOOD, 490],
            [BLOOD, 270],
        ] as const) {
            const best = findBest(binsFor([...texts], binsWidth))

            expectNoNeighborsBelow(best)
        }
    })

    it("keeps more than twelve labels above the bins when they fit", () => {
        const texts = Array.from({ length: 13 }, (_, index) => `L${index}`)
        const best = findBest(binsFor(texts, 880))

        expect(countBelow(best)).toBe(0)
        expect(totalOverflow(best)).toBeCloseTo(0)
    })

    it("alternates sides for more than twelve labels and places every label", () => {
        const texts = Array.from({ length: 22 }, (_, index) => `Label ${index}`)
        const best = findBest(binsFor(texts, 400))

        expect(best).toHaveLength(22)
        expect(best.map((label) => label.side)).toEqual(
            texts.map((_, index) => (index % 2 === 0 ? "above" : "below"))
        )
        best.forEach((label, index) => {
            expect(label.textWrap.text).toBe(texts[index])
        })
    })
})
