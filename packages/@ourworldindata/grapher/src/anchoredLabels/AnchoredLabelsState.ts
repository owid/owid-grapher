import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import {
    Bounds,
    PadObject,
    RequiredBy,
    VerticalAlign,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    InitialAnchoredLabelSeries,
    SizedAnchoredLabelSeries,
    PlacedAnchoredLabelSeries,
} from "./AnchoredLabelsTypes.js"
import { Emphasis } from "../interaction/Emphasis.js"
import { placeColumn, VerticalRange } from "./AnchoredLabelsPacking.js"
import {
    EDGE_TOLERANCE_PX,
    FLOAT_TOLERANCE_PX,
    NUDGE_STEP_PX,
} from "./AnchoredLabelsConstants.js"

interface AnchoredLabelsOptions {
    /** Font size for the labels */
    fontSize: number

    /** Font weight for the labels */
    fontWeight?: number

    /** Line height multiplier for multi-line labels (defaults to 1) */
    lineHeight?: number

    /** Maximum width for labels (no restriction by default) */
    maxWidth?: number

    /** Horizontal extent of the plot */
    xRange: [number, number]

    /** Vertical ranges the labels must stay inside */
    yRanges?: {
        /** Labels anchored at the plot edge */
        edge: [number, number]
        /** Labels anchored inside the plot (defaults to edge) */
        inChart?: [number, number]
    }

    /** Minimum space between labels */
    minSpacing?: { horizontal: number; vertical: number }

    /** Controls how the label is aligned relative to the y-position */
    verticalAlign?: VerticalAlign

    /** Controls how labels are anchored at their x position */
    textAnchor?: "start" | "end"

    /** Horizontal gap between the anchor point and the text */
    labelPadding?: number

    /**
     * If set, reserves a circular zone of this radius around each anchor
     * point that other labels must not overlap
     */
    anchorCollisionRadius?: number

    /** Ranks labels after emphasis, highest priority first */
    compare?: (
        a: InitialAnchoredLabelSeries,
        b: InitialAnchoredLabelSeries
    ) => number
}

/**
 * Anchored labels are tied to a specific (x, y) position on the chart.
 * AnchoredLabelsState moves colliding labels up to one font size from their
 * anchors, hides labels that don't fit, and computes the final position for
 * each label.
 */
export class AnchoredLabelsState {
    private readonly initialSeries: InitialAnchoredLabelSeries[]
    private readonly initialOptions: AnchoredLabelsOptions

    private readonly defaultOptions = {
        lineHeight: 1,
        maxWidth: Infinity,
        minSpacing: { horizontal: 4, vertical: 2 },
        verticalAlign: VerticalAlign.middle,
        fontWeight: 400,
        textAnchor: "start",
        labelPadding: 4,
        anchorCollisionRadius: 0,
    } as const satisfies Partial<AnchoredLabelsOptions>

    constructor(
        series: InitialAnchoredLabelSeries[],
        options: AnchoredLabelsOptions
    ) {
        this.initialSeries = series
        this.initialOptions = options
        makeObservable(this)
    }

    @computed private get options(): RequiredBy<
        AnchoredLabelsOptions,
        keyof typeof this.defaultOptions
    > {
        return { ...this.defaultOptions, ...this.initialOptions }
    }

    @computed get fontSize(): number {
        return this.options.fontSize
    }

    @computed get textAnchor(): "start" | "end" {
        return this.options.textAnchor
    }

    @computed get labelPadding(): number {
        return this.options.labelPadding
    }

    /** Extra padding applied around labels for collision detection */
    @computed private get collisionPadding(): PadObject {
        const { minSpacing } = this.options

        const verticalMargin =
            minSpacing.vertical > 0 ? minSpacing.vertical / 2 : 0
        const horizontalMargin =
            minSpacing.horizontal > 0 ? minSpacing.horizontal / 2 : 0

        return {
            top: verticalMargin,
            bottom: verticalMargin,
            right: horizontalMargin,
            left: horizontalMargin,
        }
    }

    @computed
    private get sizedSeries(): SizedAnchoredLabelSeries[] {
        const {
            fontSize,
            fontWeight,
            maxWidth,
            verticalAlign,
            lineHeight,
            textAnchor,
        } = this.options

        return this.initialSeries.map((series) => {
            const { label, position } = series

            const textWrap = new TextWrap({
                text: label,
                maxWidth,
                fontSize,
                fontWeight,
                lineHeight,
                verticalAlign,
            })

            const isLeftAnchored = textAnchor === "start"
            const direction = isLeftAnchored ? 1 : -1

            const textPosition = {
                x: position.x + direction * this.labelPadding, // Apply padding
                y: position.y,
            }

            // Bounds wrap the rendered label text and are used for overlap checks.
            const boundsPosition = {
                x: isLeftAnchored
                    ? textPosition.x
                    : textPosition.x - textWrap.width,
                y: textPosition.y - textWrap.height / 2,
            }
            const bounds = new Bounds(
                boundsPosition.x,
                boundsPosition.y,
                textWrap.width,
                textWrap.height
            )

            return { ...series, textWrap, bounds, textPosition }
        })
    }

    private comparePriority(
        a: InitialAnchoredLabelSeries,
        b: InitialAnchoredLabelSeries
    ): number {
        return (
            getEmphasisRank(b) - getEmphasisRank(a) ||
            (this.options.compare?.(a, b) ?? 0)
        )
    }

    /** Ranked by comparePriority, with ties ordered to spread labels out */
    @computed private get sizedSeriesByPriority(): SizedAnchoredLabelSeries[] {
        return orderByPriorityThenFarthest(this.sizedSeries, (a, b) =>
            this.comparePriority(a, b)
        )
    }

    @computed private get verticalRange(): VerticalRange {
        return toVerticalRange(this.options.yRanges?.edge)
    }

    @computed private get inChartVerticalRange(): VerticalRange {
        const { yRanges } = this.options
        return toVerticalRange(yRanges?.inChart ?? yRanges?.edge)
    }

    @computed private get edgeSeriesNames(): Set<string> {
        const { xRange, textAnchor } = this.options
        const [left, right] = xRange
        const isAtOrBeyondEdge = (x: number): boolean =>
            textAnchor === "start"
                ? x > right - EDGE_TOLERANCE_PX
                : x < left + EDGE_TOLERANCE_PX

        return new Set(
            this.sizedSeries
                .filter((series) => isAtOrBeyondEdge(series.position.x))
                .map((series) => series.seriesName)
        )
    }

    @computed private get packedEdgeSeries(): PlacedAnchoredLabelSeries[] {
        const edgeSeries = this.sizedSeriesByPriority.filter((series) =>
            this.edgeSeriesNames.has(series.seriesName)
        )

        const centerYs = placeColumn(
            edgeSeries.map((series) => ({
                id: series.seriesName,
                anchorY: series.position.y,
                height: series.bounds.height,
            })),
            {
                range: this.verticalRange,
                gap: this.options.minSpacing.vertical,
                maxShift: this.options.fontSize,
            }
        )

        return edgeSeries
            .filter((series) => centerYs.has(series.seriesName))
            .map((series) =>
                shiftSeries(
                    series,
                    centerYs.get(series.seriesName)! - series.position.y
                )
            )
    }

    @computed private get placedInChartSeries(): PlacedAnchoredLabelSeries[] {
        const { anchorCollisionRadius, fontSize: maxNudge } = this.options
        const range = this.inChartVerticalRange

        const anchors = this.sizedSeries.map((series) => ({
            series,
            bounds: Bounds.forDot(
                series.position.x,
                series.position.y,
                anchorCollisionRadius
            ),
        }))
        const edgeLabels = this.packedEdgeSeries.map((series) => ({
            series,
            bounds: series.bounds.expand(this.collisionPadding),
        }))
        const placedCollisionBounds: Bounds[] = []

        /** Bounds a label could hit anywhere in its nudge range */
        const findObstaclesInReach = (
            series: SizedAnchoredLabelSeries,
            collisionBounds: Bounds
        ): Bounds[] => {
            const reachTop = collisionBounds.top - maxNudge - NUDGE_STEP_PX
            const reachBottom =
                collisionBounds.bottom + maxNudge + NUDGE_STEP_PX
            const isInReach = (bounds: Bounds): boolean =>
                bounds.left <= collisionBounds.right &&
                bounds.right >= collisionBounds.left &&
                bounds.top <= reachBottom &&
                bounds.bottom >= reachTop

            const obstacles = placedCollisionBounds.filter(isInReach)
            for (const edge of edgeLabels)
                if (
                    isInReach(edge.bounds) &&
                    this.comparePriority(edge.series, series) <= 0
                )
                    obstacles.push(edge.bounds)
            if (anchorCollisionRadius === 0) return obstacles

            const emphasisRank = getEmphasisRank(series)
            for (const anchor of anchors)
                if (
                    isInReach(anchor.bounds) &&
                    anchor.series.seriesName !== series.seriesName &&
                    emphasisRank <= getEmphasisRank(anchor.series)
                )
                    obstacles.push(anchor.bounds)
            return obstacles
        }

        const placed: PlacedAnchoredLabelSeries[] = []
        for (const series of this.sizedSeriesByPriority) {
            if (this.edgeSeriesNames.has(series.seriesName)) continue

            const { bounds } = series
            const collisionBounds = bounds.expand(this.collisionPadding)
            const obstacles = findObstaclesInReach(series, collisionBounds)

            const isOffsetFree = (dy: number): boolean =>
                bounds.top + dy >= range.top &&
                bounds.bottom + dy <= range.bottom &&
                !obstacles.some(
                    (obstacle) =>
                        obstacle.top <= collisionBounds.bottom + dy &&
                        obstacle.bottom >= collisionBounds.top + dy
                )

            const dy = findNearestFreeOffset({ maxNudge, isOffsetFree })
            if (dy === undefined) continue

            const nudged = shiftSeries(series, dy)
            placed.push(nudged)
            placedCollisionBounds.push(
                nudged.bounds.expand(this.collisionPadding)
            )
        }
        return placed
    }

    /** Packed edge labels minus those an outranking in-chart label overlaps */
    @computed private get placedEdgeSeries(): PlacedAnchoredLabelSeries[] {
        const inChartCollisionBounds = this.placedInChartSeries.map((series) =>
            series.bounds.expand(this.collisionPadding)
        )
        return this.packedEdgeSeries.filter((series) => {
            const collisionBounds = series.bounds.expand(this.collisionPadding)
            return !inChartCollisionBounds.some((bounds) =>
                bounds.intersects(collisionBounds)
            )
        })
    }

    @computed get series(): PlacedAnchoredLabelSeries[] {
        const placedByName = new Map(
            [...this.placedEdgeSeries, ...this.placedInChartSeries].map(
                (series) => [series.seriesName, series]
            )
        )

        return this.sizedSeries
            .map((series) => placedByName.get(series.seriesName))
            .filter((series) => series !== undefined)
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.textWrap.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}

function shiftSeries<T extends SizedAnchoredLabelSeries>(
    series: T,
    dy: number
): T {
    return {
        ...series,
        textPosition: {
            x: series.textPosition.x,
            y: series.textPosition.y + dy,
        },
        bounds: series.bounds.set({ y: series.bounds.y + dy }),
    }
}

/** Smallest vertical offset within maxNudge that isOffsetFree accepts, trying up before down */
function findNearestFreeOffset({
    maxNudge,
    isOffsetFree,
}: {
    maxNudge: number
    isOffsetFree: (dy: number) => boolean
}): number | undefined {
    for (let k = 0; k * NUDGE_STEP_PX <= maxNudge + FLOAT_TOLERANCE_PX; k++) {
        const offset = k * NUDGE_STEP_PX
        const offsets = k === 0 ? [0] : [-offset, offset]
        for (const dy of offsets) if (isOffsetFree(dy)) return dy
    }
    return undefined
}

function toVerticalRange(yRange?: [number, number]): VerticalRange {
    return yRange
        ? { top: yRange[1], bottom: yRange[0] }
        : { top: -Infinity, bottom: Infinity }
}

/**
 * Repeatedly picks the highest-priority remaining series, breaking ties by
 * the anchor furthest from every anchor picked so far; full ties keep input
 * order
 */
function orderByPriorityThenFarthest<T extends InitialAnchoredLabelSeries>(
    series: readonly T[],
    comparePriority: (a: T, b: T) => number
): T[] {
    const remaining = series.map((candidate) => ({
        candidate,
        squaredDistanceToPicked: Infinity,
    }))
    const picked: T[] = []

    while (remaining.length > 0) {
        let bestIndex = 0
        for (let index = 1; index < remaining.length; index++) {
            const current = remaining[index]
            const best = remaining[bestIndex]
            const order = comparePriority(current.candidate, best.candidate)
            if (
                order < 0 ||
                (order === 0 &&
                    current.squaredDistanceToPicked >
                        best.squaredDistanceToPicked)
            )
                bestIndex = index
        }

        const [{ candidate: next }] = remaining.splice(bestIndex, 1)
        picked.push(next)

        for (const entry of remaining) {
            const dx = entry.candidate.position.x - next.position.x
            const dy = entry.candidate.position.y - next.position.y
            entry.squaredDistanceToPicked = Math.min(
                entry.squaredDistanceToPicked,
                dx * dx + dy * dy
            )
        }
    }
    return picked
}

function getEmphasisRank(series: InitialAnchoredLabelSeries): number {
    switch (series.emphasis) {
        case Emphasis.Highlighted:
            return 2
        case Emphasis.Muted:
            return 0
        case Emphasis.Default:
        case Emphasis.Elevated:
        case undefined:
            return 1
    }
}
