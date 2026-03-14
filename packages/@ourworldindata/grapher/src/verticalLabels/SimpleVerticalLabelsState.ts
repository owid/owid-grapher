import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { Bounds, RequiredBy, VerticalAlign } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    InitialSimpleLabelSeries,
    SizedSimpleLabelSeries,
    PlacedSimpleLabelSeries,
} from "./SimpleVerticalLabelsTypes.js"
import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"

interface SimpleVerticalLabelsOptions {
    /** Font size for the labels */
    fontSize?: number

    /** Font weight for the labels */
    fontWeight?: number

    /** Line height multiplier for multi-line labels (defaults to 1) */
    lineHeight?: number

    /** Maximum width for labels (no restriction by default) */
    maxWidth?: number

    /** Labels outside of this range are hidden */
    yRange?: [number, number]

    /** Minimum space between labels in pixels to prevent overlap */
    minSpacing?: { horizontal: number; vertical: number }

    /** Controls how the label is aligned relative to the y-position */
    verticalAlign?: VerticalAlign

    /** Controls how labels are anchored at their x position */
    textAnchor?: "start" | "end"

    /** Horizontal space between the dot and text label */
    labelOffset?: number

    /** Marker radius if the label is plotted next to a dot */
    markerRadius?: number

    /** Rectangular regions that labels should not overlap with */
    avoidBounds?: Bounds[]

    /** Function to resolve collisions between two overlapping labels by choosing which one to keep */
    resolveCollision?: (
        s1: InitialSimpleLabelSeries,
        s2: InitialSimpleLabelSeries
    ) => InitialSimpleLabelSeries
}

/**
 * Manages layout of simple vertical labels, handling sizing, placement,
 * and collision resolution by removing overlapping labels.
 */
export class SimpleVerticalLabelsState {
    private initialSeries: InitialSimpleLabelSeries[]
    private initialOptions: SimpleVerticalLabelsOptions

    private defaultOptions = {
        lineHeight: 1,
        maxWidth: Infinity,
        minSpacing: { horizontal: 4, vertical: 2 },
        verticalAlign: VerticalAlign.middle,
        fontWeight: 400,
        fontSize: BASE_FONT_SIZE,
        textAnchor: "start",
        labelOffset: 4,
        markerRadius: 0,
    } as const satisfies Partial<SimpleVerticalLabelsOptions>

    constructor(
        series: InitialSimpleLabelSeries[],
        options: SimpleVerticalLabelsOptions
    ) {
        this.initialSeries = series
        this.initialOptions = options
        makeObservable(this)
    }

    @computed private get options(): RequiredBy<
        SimpleVerticalLabelsOptions,
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
        return this.options.markerRadius + this.options.labelOffset
    }

    @computed private get labelMargins(): {
        top: number
        bottom: number
        left: number
        right: number
    } {
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
    private get sizedSeries(): SizedSimpleLabelSeries[] {
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

            const direction = textAnchor === "start" ? 1 : -1

            const x = position.x + direction * this.labelPadding
            const y = position.y

            const bounds = new Bounds(
                textAnchor === "start" ? x : x - textWrap.width,
                y - textWrap.height / 2,
                textWrap.width,
                textWrap.height
            )

            return { ...series, textWrap, bounds, textPosition: { x, y } }
        })
    }

    @computed get series(): PlacedSimpleLabelSeries[] {
        const { resolveCollision, yRange, avoidBounds } = this.options

        const series = this.sizedSeries.map((series) => ({
            ...series,
            // Bounds used to detect collisions. They're a bit larger than the
            // text bounds to account for the minimum spacing between labels.
            collisionBounds: series.bounds.expand(this.labelMargins),
            // Bounds used to detect collisions with dots
            dotBounds: Bounds.forDot(
                series.position.x,
                series.position.y,
                this.options.markerRadius
            ),
            // None of the series are initially hidden
            isHidden: false,
        }))

        // Check if the label is out of bounds
        if (yRange) {
            for (const s1 of series) {
                if (s1.isHidden) continue

                if (s1.bounds.top < yRange[1] || s1.bounds.bottom > yRange[0]) {
                    s1.isHidden = true
                }
            }
        }

        // Check if the label overlaps with any bounds to avoid
        if (avoidBounds?.length) {
            for (const s1 of series) {
                if (s1.isHidden) continue
                if (avoidBounds.some((b) => s1.collisionBounds.intersects(b)))
                    s1.isHidden = true
            }
        }

        // Check if the label is overlapping with any other dot
        if (this.options.markerRadius) {
            for (const s1 of series) {
                for (const s2 of series) {
                    if (s1.seriesName === s2.seriesName) continue
                    if (s1.collisionBounds.intersects(s2.dotBounds)) {
                        s1.isHidden = true
                    }
                }
            }
        }

        // Hide labels that are overlapping or too close to each other
        for (let i = 0; i < series.length; i++) {
            const s1 = series[i]
            if (s1.isHidden) continue

            for (let j = i + 1; j < series.length; j++) {
                const s2 = series[j]
                if (s2.isHidden) continue

                if (s1.collisionBounds.intersects(s2.collisionBounds)) {
                    const picked = resolveCollision?.(s1, s2) ?? s1

                    if (picked === s1) s2.isHidden = true
                    else s1.isHidden = true
                }
            }
        }

        return series
            .filter((series) => !series.isHidden)
            .map((series) =>
                R.omit(series, ["isHidden", "collisionBounds", "dotBounds"])
            )
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.textWrap.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}
