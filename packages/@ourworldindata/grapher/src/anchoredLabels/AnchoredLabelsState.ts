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

interface AnchoredLabelsOptions {
    /** Font size for the labels */
    fontSize: number

    /** Font weight for the labels */
    fontWeight?: number

    /** Line height multiplier for multi-line labels (defaults to 1) */
    lineHeight?: number

    /** Maximum width for labels (no restriction by default) */
    maxWidth?: number

    /** Labels outside of this range are hidden */
    yRange?: [number, number]

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

    /** Maximum distance in pixels an edge label may move from its anchor (defaults to the font size) */
    maxShift?: number

    /** Maximum distance in pixels an in-chart label may move from its anchor (defaults to the font size) */
    maxNudge?: number

    compare?: (
        a: InitialAnchoredLabelSeries,
        b: InitialAnchoredLabelSeries
    ) => number
}

const EDGE_TOLERANCE_PX = 1
const NUDGE_STEP_PX = 0.5

/**
 * Anchored labels are tied to a specific (x, y) position on the chart.
 * AnchoredLabelsState moves colliding edge labels apart, hides labels that don't
 * fit, and computes the final position for each label.
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
            emphasisRank(b) - emphasisRank(a) ||
            (this.options.compare?.(a, b) ?? 0)
        )
    }

    @computed private get seriesByPriority(): SizedAnchoredLabelSeries[] {
        return [...this.sizedSeries].sort((a, b) => this.comparePriority(a, b))
    }

    @computed private get maxShift(): number {
        return this.options.maxShift ?? this.options.fontSize
    }

    @computed private get maxNudge(): number {
        return this.options.maxNudge ?? this.options.fontSize
    }

    @computed private get verticalRange(): VerticalRange {
        const { yRange } = this.options
        return yRange
            ? { top: yRange[1], bottom: yRange[0] }
            : { top: -Infinity, bottom: Infinity }
    }

    @computed private get edgeSeriesNames(): Set<string> {
        const xs = this.sizedSeries.map((series) => series.position.x)
        if (xs.length === 0) return new Set()

        const edgeX =
            this.options.textAnchor === "start"
                ? Math.max(...xs)
                : Math.min(...xs)

        return new Set(
            this.sizedSeries
                .filter(
                    (series) =>
                        Math.abs(series.position.x - edgeX) < EDGE_TOLERANCE_PX
                )
                .map((series) => series.seriesName)
        )
    }

    @computed private get placedEdgeSeries(): PlacedAnchoredLabelSeries[] {
        const edgeSeries = this.seriesByPriority.filter((series) =>
            this.edgeSeriesNames.has(series.seriesName)
        )

        const placements = placeColumn(
            edgeSeries.map((series) => ({
                id: series.seriesName,
                anchorY: series.position.y,
                height: series.bounds.height,
                weight: 1,
            })),
            {
                range: this.verticalRange,
                gap: this.options.minSpacing.vertical,
                maxShift: this.maxShift,
            }
        )

        return edgeSeries.flatMap((series) => {
            const placement = placements.get(series.seriesName)
            if (placement?.kind !== "placed") return []

            return [shiftSeries(series, placement.y - series.position.y)]
        })
    }

    @computed private get placedInChartSeries(): PlacedAnchoredLabelSeries[] {
        const { yRange, anchorCollisionRadius } = this.options

        const anchorBounds = new Map(
            this.sizedSeries.map((series) => [
                series.seriesName,
                Bounds.forDot(
                    series.position.x,
                    series.position.y,
                    anchorCollisionRadius
                ),
            ])
        )

        const placedCollisionBounds = this.placedEdgeSeries.map((series) =>
            series.bounds.expand(this.collisionPadding)
        )

        const isFree = (
            series: SizedAnchoredLabelSeries,
            bounds: Bounds
        ): boolean => {
            if (yRange && (bounds.top < yRange[1] || bounds.bottom > yRange[0]))
                return false

            const collisionBounds = bounds.expand(this.collisionPadding)

            if (
                placedCollisionBounds.some((placed) =>
                    placed.intersects(collisionBounds)
                )
            )
                return false

            if (anchorCollisionRadius === 0) return true

            return !this.sizedSeries.some(
                (other) =>
                    other.seriesName !== series.seriesName &&
                    collisionBounds.intersects(
                        anchorBounds.get(other.seriesName)!
                    ) &&
                    emphasisRank(series) <= emphasisRank(other)
            )
        }

        const placed: PlacedAnchoredLabelSeries[] = []
        for (const series of this.seriesByPriority) {
            if (this.edgeSeriesNames.has(series.seriesName)) continue

            const nudged = nudgeUntilFree(series, this.maxNudge, isFree)
            if (!nudged) continue

            placed.push(nudged)
            placedCollisionBounds.push(
                nudged.bounds.expand(this.collisionPadding)
            )
        }
        return placed
    }

    @computed get series(): PlacedAnchoredLabelSeries[] {
        const placedByName = new Map(
            [...this.placedEdgeSeries, ...this.placedInChartSeries].map(
                (series) => [series.seriesName, series]
            )
        )

        return this.sizedSeries.flatMap((series) => {
            const placed = placedByName.get(series.seriesName)
            return placed ? [placed] : []
        })
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

function nudgeUntilFree(
    series: SizedAnchoredLabelSeries,
    maxNudge: number,
    isFree: (series: SizedAnchoredLabelSeries, bounds: Bounds) => boolean
): SizedAnchoredLabelSeries | undefined {
    for (let k = 0; k * NUDGE_STEP_PX <= maxNudge + 1e-9; k++) {
        const offset = k * NUDGE_STEP_PX
        const offsets = k === 0 ? [0] : [-offset, offset]
        for (const dy of offsets) {
            const shifted = shiftSeries(series, dy)
            if (isFree(series, shifted.bounds)) return shifted
        }
    }
    return undefined
}

function emphasisRank(series: InitialAnchoredLabelSeries): number {
    switch (series.emphasis) {
        case Emphasis.Highlighted:
            return 2
        case Emphasis.Muted:
            return 0
        default:
            return 1
    }
}
