import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { match } from "ts-pattern"
import {
    Bounds,
    HorizontalAlign,
    Pair,
    RequiredBy,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { BASE_FONT_SIZE, FontSettings } from "../core/GrapherConstants.js"
import {
    HorizontalLabel,
    PlacedHorizontalLabel,
    SizedHorizontalLabel,
} from "./HorizontalLabelPairTypes.js"

export interface HorizontalLabelPairOptions {
    fontSettings?: FontSettings
    /** Horizontal range for label placement */
    xRange?: [number, number]
    /** Minimum horizontal gap between the two labels */
    minGap?: number
}

/**
 * Manages the state of two labels that are placed horizontally,
 * ensuring they do not overlap and stay within a specified horizontal range.
 */
export class HorizontalLabelPairState {
    private readonly initialSeries: Pair<HorizontalLabel>
    private readonly initialOptions: HorizontalLabelPairOptions

    private readonly defaultOptions = {
        fontSettings: {
            fontSize: BASE_FONT_SIZE,
            fontWeight: 400,
            lineHeight: 1,
        },
        xRange: [-Infinity, Infinity],
        minGap: 8,
    } as const satisfies Partial<HorizontalLabelPairOptions>

    constructor(
        series: Pair<HorizontalLabel>,
        options: HorizontalLabelPairOptions
    ) {
        this.initialSeries = series
        this.initialOptions = options
        makeObservable(this)
    }

    @computed private get options(): RequiredBy<
        HorizontalLabelPairOptions,
        keyof typeof this.defaultOptions
    > {
        return { ...this.defaultOptions, ...this.initialOptions }
    }

    @computed get sizedSeries(): Pair<SizedHorizontalLabel> {
        const { fontSettings } = this.options
        return this.initialSeries.map((series) => {
            const textWrap = new TextWrap({
                ...fontSettings,
                text: series.text,
                maxWidth: Infinity, // No line breaks
            })
            return { ...series, textWrap } satisfies SizedHorizontalLabel
        }) as Pair<SizedHorizontalLabel>
    }

    @computed get placedSeries(): Pair<PlacedHorizontalLabel> {
        const {
            minGap,
            xRange: [minX, maxX],
        } = this.options

        // Place each label at its target x, adjusted for text anchor
        const placedSeries = this.sizedSeries.map((series) => {
            const {
                x,
                textWrap: { width, height },
                textAnchor = HorizontalAlign.left,
            } = series

            // Resolve textAnchor to the x coordinate of the label's left edge
            const resolvedX = match(textAnchor)
                .with(HorizontalAlign.left, () => x)
                .with(HorizontalAlign.right, () => x - width)
                .with(HorizontalAlign.center, () => x - width / 2)
                .exhaustive()

            return {
                ...series,
                bounds: new Bounds(resolvedX, 0, width, height),
            }
        })

        // Shift labels that overflow the given horizontal range back within it
        for (const series of placedSeries) {
            const clampedX = _.clamp(
                series.bounds.x,
                minX,
                maxX - series.bounds.width
            )

            if (clampedX !== series.bounds.x)
                series.bounds = series.bounds.set({ x: clampedX })
        }

        const [leftLabel, rightLabel] = _.sortBy(
            placedSeries,
            (series) => series.bounds.x
        )

        // Check for overlap, enforcing a minimum gap between the two labels
        const overlap = leftLabel.bounds.right + minGap - rightLabel.bounds.left

        // If the labels are overlapping, shift them apart just enough to
        // resolve the overlap
        if (overlap > 0) {
            // Calculate how much each label can be shifted
            const leftAvailableShift = leftLabel.bounds.x - minX
            const rightAvailableShift = maxX - rightLabel.bounds.right

            // Split the required shift between the two labels
            let leftShift = Math.min(overlap / 2, leftAvailableShift)
            const rightShift = Math.min(
                overlap - leftShift,
                rightAvailableShift
            )

            // If the right side couldn't take its share, let the left side
            // absorb the remainder (if it has capacity)
            if (leftShift + rightShift < overlap) {
                leftShift = Math.min(overlap - rightShift, leftAvailableShift)
            }

            // Update label positions
            leftLabel.bounds = leftLabel.bounds.set({
                x: leftLabel.bounds.x - leftShift,
            })
            rightLabel.bounds = rightLabel.bounds.set({
                x: rightLabel.bounds.x + rightShift,
            })
        }

        return [leftLabel, rightLabel]
    }

    /** True if the two labels overlap horizontally after placement */
    @computed get hasOverlap(): boolean {
        const { minGap } = this.options
        const [leftLabel, rightLabel] = this.placedSeries
        const gap = rightLabel.bounds.left - leftLabel.bounds.right
        // Small tolerance to avoid false positives from floating-point noise
        return gap < minGap - 1e-6
    }
}
