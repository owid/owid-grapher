import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { Bounds, PadObject, Point, RequiredBy } from "@ourworldindata/utils"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import {
    InitialAnchoredLabelSeries,
    SizedAnchoredLabelSeries,
    PlacedAnchoredLabelSeries,
} from "./AnchoredLabelsTypes.js"
import { Emphasis } from "../interaction/Emphasis.js"
import {
    placeEdgeLabels,
    VerticalRange,
} from "./AnchoredLabelsEdgePlacement.js"
import { placeInChartLabels } from "./AnchoredLabelsInChartPlacement.js"
import { EDGE_TOLERANCE_PX } from "./AnchoredLabelsConstants.js"

interface SeriesBounds {
    series: SizedAnchoredLabelSeries
    bounds: Bounds
}

interface AnchoredLabelsOptions {
    /** Font size for the labels */
    fontSize: number

    /** Font weight for the labels */
    fontWeight?: number

    /** Line height multiplier for multi-line labels (defaults to 1) */
    lineHeight?: number

    /** Maximum width for labels (no restriction by default) */
    maxWidth?: number

    /** Horizontal extent of the plot; without it, every label is an edge label */
    xRange?: [number, number]

    /** Vertical ranges the labels must stay inside */
    yRanges?: {
        /** Labels anchored at the plot edge */
        edge: [number, number]
        /** Labels anchored inside the plot (defaults to edge) */
        inChart?: [number, number]
    }

    /** Minimum space between labels */
    minSpacing?: { horizontal: number; vertical: number }

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
        const { fontSize, fontWeight, maxWidth, lineHeight, textAnchor } =
            this.options

        return this.initialSeries.map((series) => {
            const { label, position } = series

            const seriesLabel = new SeriesLabelState({
                text: label,
                maxWidth,
                fontSize,
                fontWeight,
                lineHeight,
                textAnchor,
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
                    : textPosition.x - seriesLabel.width,
                y: textPosition.y - seriesLabel.height / 2,
            }
            const bounds = new Bounds(
                boundsPosition.x,
                boundsPosition.y,
                seriesLabel.width,
                seriesLabel.height
            )

            return { ...series, seriesLabel, bounds, textPosition }
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

    /**
     * Names of series whose anchor sits on the plot's right edge (left edge
     * for end-anchored labels), e.g. lines that run to the last year
     */
    @computed private get edgeSeriesNames(): Set<string> {
        const { xRange, textAnchor } = this.options
        if (!xRange)
            return new Set(this.sizedSeries.map((series) => series.seriesName))

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

    /**
     * Edge labels separated so they don't overlap, each moved at most
     * one font size from its anchor. Labels join from the highest rank down,
     * and one is left out if it would overflow the vertical range or push any
     * label further than that. In-chart labels are placed afterwards and may
     * cover lower-ranked ones, which placedEdgeSeries then drops.
     */
    @computed
    private get tentativelyPlacedEdgeSeries(): PlacedAnchoredLabelSeries[] {
        const edgeSeries = this.sizedSeriesByPriority.filter((series) =>
            this.edgeSeriesNames.has(series.seriesName)
        )

        const centerYs = placeEdgeLabels(
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

    private getCollisionBounds(series: SizedAnchoredLabelSeries): Bounds {
        return series.bounds.expand(this.collisionPadding)
    }

    /** Tentatively placed edge labels as padded bounds */
    @computed private get edgeLabelsForInChartLabelsToAvoid(): SeriesBounds[] {
        return this.tentativelyPlacedEdgeSeries.map((series) => ({
            series,
            bounds: this.getCollisionBounds(series),
        }))
    }

    /** Zones around anchor points; none if anchorCollisionRadius is 0 */
    @computed private get anchorsForInChartLabelsToAvoid(): SeriesBounds[] {
        const { anchorCollisionRadius } = this.options
        if (anchorCollisionRadius === 0) return []
        return this.sizedSeries.map((series) => ({
            series,
            bounds: Bounds.forDot(
                series.position.x,
                series.position.y,
                anchorCollisionRadius
            ),
        }))
    }

    /**
     * Bounds an in-chart label must not cover: edge labels ranked at least as
     * high, and other series' anchors with at least the same emphasis
     */
    private getBoundsToAvoid(
        inChartSeries: SizedAnchoredLabelSeries
    ): Bounds[] {
        const emphasisRank = getEmphasisRank(inChartSeries)
        const edgeLabels = this.edgeLabelsForInChartLabelsToAvoid.filter(
            (edge) => this.comparePriority(edge.series, inChartSeries) <= 0
        )
        const anchors = this.anchorsForInChartLabelsToAvoid.filter(
            (anchor) =>
                anchor.series.seriesName !== inChartSeries.seriesName &&
                emphasisRank <= getEmphasisRank(anchor.series)
        )
        return [...edgeLabels, ...anchors].map((toAvoid) => toAvoid.bounds)
    }

    /** In-chart labels, each shifted at most one font size from its anchor */
    @computed private get placedInChartSeries(): PlacedAnchoredLabelSeries[] {
        const inChartSeries = this.sizedSeriesByPriority.filter(
            (series) => !this.edgeSeriesNames.has(series.seriesName)
        )

        const offsetYs = placeInChartLabels(
            inChartSeries.map((series) => ({
                id: series.seriesName,
                bounds: series.bounds,
                collisionBounds: this.getCollisionBounds(series),
                boundsToAvoid: this.getBoundsToAvoid(series),
            })),
            {
                range: this.inChartVerticalRange,
                maxShift: this.options.fontSize,
            }
        )

        return inChartSeries
            .filter((series) => offsetYs.has(series.seriesName))
            .map((series) =>
                shiftSeries(series, offsetYs.get(series.seriesName)!)
            )
    }

    /** Tentatively placed edge labels minus those an outranking in-chart label overlaps */
    @computed private get placedEdgeSeries(): PlacedAnchoredLabelSeries[] {
        const inChartCollisionBounds = this.placedInChartSeries.map((series) =>
            this.getCollisionBounds(series)
        )
        return this.tentativelyPlacedEdgeSeries.filter((series) => {
            const collisionBounds = this.getCollisionBounds(series)
            return !inChartCollisionBounds.some((bounds) =>
                bounds.intersects(collisionBounds)
            )
        })
    }

    @computed get series(): PlacedAnchoredLabelSeries[] {
        const placedSeriesByName = new Map(
            [...this.placedEdgeSeries, ...this.placedInChartSeries].map(
                (series) => [series.seriesName, series]
            )
        )

        return this.sizedSeries
            .map((series) => placedSeriesByName.get(series.seriesName))
            .filter((series) => series !== undefined)
    }

    @computed get width(): number {
        const labelWidths = this.series.map(
            (series) => series.seriesLabel.width
        )
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}

function shiftSeries<T extends SizedAnchoredLabelSeries>(
    series: T,
    offsetY: number
): T {
    return {
        ...series,
        textPosition: {
            x: series.textPosition.x,
            y: series.textPosition.y + offsetY,
        },
        bounds: series.bounds.set({ y: series.bounds.y + offsetY }),
    }
}

function toVerticalRange(yRange?: [number, number]): VerticalRange {
    return yRange
        ? { top: yRange[1], bottom: yRange[0] }
        : { top: -Infinity, bottom: Infinity }
}

/**
 * Sorts labels by comparePriority, highest priority first. Within a run of
 * labels the comparator ties, the next label is always the one whose anchor is
 * furthest from every label ordered so far, which spreads tied labels across
 * the chart. Labels at equal distance keep their input order.
 */
function orderByPriorityThenFarthest<T extends InitialAnchoredLabelSeries>(
    series: readonly T[],
    comparePriority: (a: T, b: T) => number
): T[] {
    const ties: T[][] = []
    for (const label of series.toSorted(comparePriority)) {
        const currentTie = ties.at(-1)
        if (currentTie && comparePriority(currentTie[0], label) === 0)
            currentTie.push(label)
        else ties.push([label])
    }

    const ordered: T[] = []
    for (const tie of ties) appendFarthestFirst(ordered, tie)
    return ordered
}

/**
 * Appends candidates one by one, each time the one whose anchor is furthest
 * from every anchor already in ordered; full ties keep candidate order
 */
function appendFarthestFirst<T extends InitialAnchoredLabelSeries>(
    ordered: T[],
    candidates: readonly T[]
): void {
    const remaining = candidates.map((candidate) => ({
        candidate,
        squaredDistanceToOrdered: getSquaredDistanceToNearest(
            candidate,
            ordered
        ),
    }))
    while (remaining.length > 0) {
        const [{ candidate: next }] = remaining.splice(
            findFarthestIndex(remaining),
            1
        )
        ordered.push(next)
        for (const entry of remaining)
            entry.squaredDistanceToOrdered = Math.min(
                entry.squaredDistanceToOrdered,
                getSquaredDistance(entry.candidate.position, next.position)
            )
    }
}

/** Index of the entry furthest from its nearest ordered label; the first on ties */
function findFarthestIndex(
    remaining: readonly { squaredDistanceToOrdered: number }[]
): number {
    let farthestIndex = 0
    for (let index = 1; index < remaining.length; index++)
        if (
            remaining[index].squaredDistanceToOrdered >
            remaining[farthestIndex].squaredDistanceToOrdered
        )
            farthestIndex = index
    return farthestIndex
}

/** Squared distance from the series' anchor to the nearest of the others' anchors; Infinity without others */
function getSquaredDistanceToNearest(
    series: InitialAnchoredLabelSeries,
    others: readonly InitialAnchoredLabelSeries[]
): number {
    let min = Infinity
    for (const other of others)
        min = Math.min(min, getSquaredDistance(series.position, other.position))
    return min
}

function getSquaredDistance(a: Point, b: Point): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return dx * dx + dy * dy
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
