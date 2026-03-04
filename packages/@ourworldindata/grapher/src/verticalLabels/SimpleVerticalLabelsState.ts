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
    minSpacing?: number

    /** Controls how the label is aligned relative to the y-position */
    verticalAlign?: VerticalAlign

    /** Function to resolve collisions between two overlapping labels by choosing which one to keep */
    resolveCollision?: (
        s1: InitialSimpleLabelSeries,
        s2: InitialSimpleLabelSeries
    ) => InitialSimpleLabelSeries
}

/**
 * Manages layout of simple vertical labels, handling sizing, placement,
 * and basic collision resolution by removing overlapping labels.
 */
export class SimpleVerticalLabelsState {
    private initialSeries: InitialSimpleLabelSeries[]
    private initialOptions: SimpleVerticalLabelsOptions

    private defaultOptions = {
        lineHeight: 1,
        maxWidth: Infinity,
        minSpacing: 5,
        verticalAlign: VerticalAlign.middle,
        fontWeight: 400,
        fontSize: BASE_FONT_SIZE,
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

    @computed
    private get sizedSeries(): SizedSimpleLabelSeries[] {
        const { fontSize, fontWeight, maxWidth, verticalAlign, lineHeight } =
            this.options

        return this.initialSeries.map((series) => {
            const { label, yPosition } = series

            const textWrap = new TextWrap({
                text: label,
                maxWidth,
                fontSize,
                fontWeight,
                lineHeight,
                verticalAlign,
            })

            const [x, y] = textWrap.getPositionForSvgRendering(0, yPosition)
            const bounds = new Bounds(x, y, textWrap.width, textWrap.height)

            return { ...series, textWrap, bounds }
        })
    }

    @computed get series(): PlacedSimpleLabelSeries[] {
        const { minSpacing, resolveCollision, yRange } = this.options

        const margin = minSpacing > 0 ? minSpacing / 2 : 0
        const margins = { top: margin, bottom: margin }

        const series = this.sizedSeries.map((series) => ({
            ...series,
            // Bounds used to detect collisions. They're a bit larger than the
            // text bounds to account for the minimum spacing between labels.
            collisionBounds: series.bounds.expand(margins),
            // None of the series are initially hidden
            isHidden: false,
        }))

        // Hide labels that are overlapping or too close to each other
        for (let i = 0; i < series.length; i++) {
            const s1 = series[i]
            if (s1.isHidden) continue

            // Check if the label is out of bounds
            if (
                yRange &&
                (s1.bounds.top < yRange[1] || s1.bounds.bottom > yRange[0])
            ) {
                s1.isHidden = true
                continue
            }

            // Check if the label is overlapping with any other label
            for (let j = i + 1; j < series.length; j++) {
                const s2 = series[j]
                if (s2.isHidden) continue

                if (s1.collisionBounds.hasVerticalOverlap(s2.collisionBounds)) {
                    const picked = resolveCollision?.(s1, s2) ?? s1

                    if (picked === s1) s2.isHidden = true
                    else s1.isHidden = true
                }
            }
        }

        return series
            .filter((series) => !series.isHidden)
            .map((series) => R.omit(series, ["isHidden", "collisionBounds"]))
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.textWrap.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}
