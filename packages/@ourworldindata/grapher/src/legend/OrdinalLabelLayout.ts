import * as _ from "lodash-es"
import { TextWrap } from "@ourworldindata/components"
import { MINIMUM_BIN_LABEL_DISTANCE } from "./HorizontalColorLegendConstants"
import { LabelSide, PositionedBin } from "./HorizontalColorLegendTypes"

const MAX_SEARCHED_LABELS = 12
const MAX_OVERRUN_INTO_NEXT_BIN = 0.5
const LABEL_LINE_HEIGHT = 1.1

export interface PlacedBinLabel {
    side: LabelSide
    textWrap: TextWrap
    left: number
    overflow: number
}

export function layOutOrdinalLabels({
    bins,
    maxWidth,
    fontSize,
}: {
    bins: PositionedBin[]
    maxWidth: number
    fontSize: number
}): PlacedBinLabel[] {
    const lastBin = _.last(bins)
    const lastBinRight = lastBin ? lastBin.x + lastBin.width : 0
    const binLabelWraps = wrapBinLabels({ bins, lastBinRight, fontSize })

    // The number of side assignments grows exponentially with the number of
    // labels, so long legends only try all-above and alternating.
    const candidates =
        bins.length <= MAX_SEARCHED_LABELS
            ? listSideAssignmentsWithoutNeighborsBelow(bins.length)
            : [
                  bins.map((): LabelSide => "above"),
                  listAlternatingSides(bins.length),
              ]

    let best: { labels: PlacedBinLabel[]; score: LabelLayoutScore } | undefined
    for (const sides of candidates) {
        const textWraps = pickTextWraps({ binLabelWraps, sides })
        const placed = placeBinLabels({
            bins,
            textWraps,
            sides,
            lastBinRight,
            maxWidth,
        })
        const score = scoreBinLabelLayout(placed)
        if (!best || isScoreLower(score, best.score))
            best = { labels: placed, score }
    }
    return best!.labels
}

function placeBinLabels({
    bins,
    textWraps,
    sides,
    lastBinRight,
    maxWidth,
}: {
    bins: PositionedBin[]
    textWraps: TextWrap[]
    sides: LabelSide[]
    lastBinRight: number
    maxWidth: number
}): PlacedBinLabel[] {
    // A label that would overflow the legend's right edge is shifted left
    const lefts = bins.map(({ x }, index) =>
        Math.min(x, maxWidth - textWraps[index].width)
    )
    const rights = lefts.map((left, index) => left + textWraps[index].width)
    const { previousIndices, nextIndices } = findSameSideNeighbors(sides)

    return bins.map(({ x }, index) => {
        const left = lefts[index]

        const nextSameSideIndex = nextIndices[index]
        const nextSameSideBin =
            nextSameSideIndex >= 0 ? bins[nextSameSideIndex] : undefined
        const previousSameSideIndex = previousIndices[index]

        const canRunIntoPrevious = left < x && previousSameSideIndex >= 0
        const intrusionIntoPrevious = canRunIntoPrevious
            ? rights[previousSameSideIndex] + MINIMUM_BIN_LABEL_DISTANCE - left
            : 0

        const maxRight = findRightLimit(nextSameSideBin, lastBinRight)
        const overflow =
            Math.max(0, rights[index] - maxRight) +
            Math.max(0, intrusionIntoPrevious)

        return {
            side: sides[index],
            textWrap: textWraps[index],
            left,
            overflow,
        }
    })
}

function findSameSideNeighbors(sides: LabelSide[]): {
    previousIndices: number[]
    nextIndices: number[]
} {
    const previousIndices = new Array<number>(sides.length).fill(-1)
    const nextIndices = new Array<number>(sides.length).fill(-1)

    const lastIndexBySide: Partial<Record<LabelSide, number>> = {}
    for (let index = 0; index < sides.length; index++) {
        previousIndices[index] = lastIndexBySide[sides[index]] ?? -1
        lastIndexBySide[sides[index]] = index
    }

    const nextIndexBySide: Partial<Record<LabelSide, number>> = {}
    for (let index = sides.length - 1; index >= 0; index--) {
        nextIndices[index] = nextIndexBySide[sides[index]] ?? -1
        nextIndexBySide[sides[index]] = index
    }

    return { previousIndices, nextIndices }
}

type LabelLayoutScore = [
    overflow: number,
    labelsBelow: number,
    totalHeight: number,
]

export function findMaxLabelHeight(
    labels: PlacedBinLabel[],
    side: LabelSide
): number {
    const heights = labels
        .filter((label) => label.side === side)
        .map((label) => label.textWrap.height)
    return _.max(heights) ?? 0
}

function scoreBinLabelLayout(labels: PlacedBinLabel[]): LabelLayoutScore {
    return [
        // Total overflow
        Math.round(labels.reduce((sum, label) => sum + label.overflow, 0)),
        // Number of labels below the bins
        labels.filter((label) => label.side === "below").length,
        // Height of the tallest label above plus the tallest label below
        Math.round(
            findMaxLabelHeight(labels, "above") +
                findMaxLabelHeight(labels, "below")
        ),
    ]
}

/** Whether score a is lower than b, decided by the first entry that differs */
function isScoreLower(a: LabelLayoutScore, b: LabelLayoutScore): boolean {
    for (let index = 0; index < a.length; index++) {
        if (a[index] !== b[index]) return a[index] < b[index]
    }
    return false
}

function listAlternatingSides(count: number): LabelSide[] {
    return _.range(count).map((index) => (index % 2 === 0 ? "above" : "below"))
}

function listSideAssignmentsWithoutNeighborsBelow(
    count: number
): LabelSide[][] {
    if (count === 0) return [[]]
    if (count === 1) return [["above"], ["below"]]
    return [
        ...listSideAssignmentsWithoutNeighborsBelow(count - 1).map(
            (rest): LabelSide[] => ["above", ...rest]
        ),
        ...listSideAssignmentsWithoutNeighborsBelow(count - 2).map(
            (rest): LabelSide[] => ["below", "above", ...rest]
        ),
    ]
}

function findRightLimit(
    next: PositionedBin | undefined,
    lastBinRight: number
): number {
    return next ? next.x - MINIMUM_BIN_LABEL_DISTANCE : lastBinRight
}

function findWidenedRightLimit(
    bins: PositionedBin[],
    index: number,
    lastBinRight: number
): number {
    const next = bins[index + 1]
    if (!next) return lastBinRight
    const overrunLimit = next.x + MAX_OVERRUN_INTO_NEXT_BIN * next.width
    const binAfterNextLimit = findRightLimit(bins[index + 2], lastBinRight)
    return Math.min(overrunLimit, binAfterNextLimit)
}

interface BinLabelWraps {
    contained: TextWrap
    widened: TextWrap
}

function wrapBinLabels({
    bins,
    lastBinRight,
    fontSize,
}: {
    bins: PositionedBin[]
    lastBinRight: number
    fontSize: number
}): BinLabelWraps[] {
    return bins.map(({ x, bin }, index) => {
        const containedLimit = findRightLimit(bins[index + 1], lastBinRight)
        const widenedLimit = findWidenedRightLimit(bins, index, lastBinRight)

        const wrapTo = (maxWidth: number): TextWrap =>
            new TextWrap({
                text: bin.text,
                fontSize,
                maxWidth,
                lineHeight: LABEL_LINE_HEIGHT,
            })

        const containedWidth = Math.ceil(containedLimit - x)
        const widenedWidth = Math.ceil(widenedLimit - x)
        const contained = wrapTo(containedWidth)
        const widened =
            widenedWidth === containedWidth ? contained : wrapTo(widenedWidth)

        return { contained, widened }
    })
}

function pickTextWraps({
    binLabelWraps,
    sides,
}: {
    binLabelWraps: BinLabelWraps[]
    sides: LabelSide[]
}): TextWrap[] {
    return binLabelWraps.map(({ contained, widened }, index) =>
        index + 1 < sides.length && sides[index + 1] !== sides[index]
            ? widened
            : contained
    )
}
