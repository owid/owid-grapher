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
import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"

interface AnchoredLabelsOptions {
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

    /** Function to resolve collisions between two overlapping labels by choosing which one to keep */
    resolveCollision?: (
        s1: InitialAnchoredLabelSeries,
        s2: InitialAnchoredLabelSeries
    ) => InitialAnchoredLabelSeries
}

/**
 * Anchored labels are tied to a specific (x, y) position on the chart.
 * AnchoredLabelsState resolves collisions by hiding overlapping labels and
 * computes the final position for each label.
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
        fontSize: BASE_FONT_SIZE,
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

    @computed get series(): PlacedAnchoredLabelSeries[] {
        const { resolveCollision, yRange } = this.options

        const series = this.sizedSeries.map((series) => ({
            ...series,
            // Bounds used to detect collisions. They're a bit larger than the
            // text bounds to account for the minimum spacing between labels.
            collisionBounds: series.bounds.expand(this.collisionPadding),
            // Bounds used to detect collisions with the anchor element
            anchorBounds: Bounds.forDot(
                series.position.x,
                series.position.y,
                this.options.anchorCollisionRadius
            ),
            // None of the series are initially hidden
            isHidden: false,
        }))

        // Hide labels that are outside of the specified y-value range
        if (yRange) {
            for (const s1 of series) {
                if (s1.isHidden) continue

                if (s1.bounds.top < yRange[1] || s1.bounds.bottom > yRange[0]) {
                    s1.isHidden = true
                }
            }
        }

        // Hide labels that are overlapping with an anchor element
        if (this.options.anchorCollisionRadius) {
            for (const s1 of series) {
                for (const s2 of series) {
                    if (s1.seriesName === s2.seriesName) continue
                    if (s1.collisionBounds.intersects(s2.anchorBounds)) {
                        s1.isHidden = true
                        break
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
                R.omit(series, ["isHidden", "collisionBounds", "anchorBounds"])
            )
    }

    @computed get width(): number {
        const labelWidths = this.series.map((series) => series.textWrap.width)
        const maxLabelWidth = R.firstBy(labelWidths, [R.identity(), "desc"])
        return maxLabelWidth ?? 0
    }
}
