import { useEffect, useMemo } from "react"
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"

import { Bounds } from "@ourworldindata/utils"

import type { IncomeDistributionChartModel } from "../../core/chartModel.js"
import { MARGIN, type PlotRect } from "../../core/chartGeometry.js"
import {
    hideLabelsUnderBox,
    placeCurveLabels,
    type CurveLabelCandidate,
    type CurveLabelLayout,
    type LabelBox,
} from "../../core/curveLabels.js"
import { displayEntityName } from "../../core/entityLabels.js"
import { layoutPovertyLineLabel } from "../../core/povertyLineLabel.js"
import {
    placeRegionLabels,
    type RegionBandPixels,
    type RegionLabel,
} from "../../core/regionLabels.js"
import { COUNTRY_LABEL_FONT_WEIGHT } from "./AreaLayer.js"
import type { PovertyLineText } from "./PovertyLine.js"

const REGION_LABEL_FONT_SIZES = [14, 13, 12, 11, 10, 9] as const
const REGION_LABEL_FONT_SIZES_NARROW = [13, 12, 11, 10, 9] as const

const COUNTRY_LABEL_FONT_SIZE = 12
const COUNTRY_LABEL_FONT_SIZE_NARROW = 11
/** Line height of a country label as a multiple of its font size, for its box */
const COUNTRY_LABEL_LINE_HEIGHT = 1.2
/**
 * Countries view: room kept between the plot's top and the tallest peak for
 * the label above it, which mustn't run into the poverty line's label
 */
export const COUNTRY_LABEL_HEADROOM = 30
/** More countries than this are labelled directly only up to it; the rest go to the legend */
const MAX_COUNTRY_LABELS = 6
const MAX_COUNTRY_LABELS_NARROW = 4
/** Country labels stay this far below the plot's top, clear of the poverty line's label */
const COUNTRY_LABEL_TOP_INSET = 9
/** Room kept between the country labels and the poverty line's label, in px */
const POVERTY_LINE_LABEL_MARGIN = 4

/**
 * Mirrors the overlay legend's swatch rows (IncomeDistributionLegend.scss):
 * 10px 12px padding, a 1px border, rows of 12px text at 1.25 line height with
 * 2px padding above and below, a 10px swatch and a 6px gap before the label,
 * which is capped at 260px
 */
const LEFTOVER_LEGEND = {
    paddingX: 12 + 1,
    paddingY: 10 + 1,
    rowHeight: 12 * 1.25 + 4,
    markWidth: 10 + 6,
    fontSize: 12,
    maxLabelWidth: 260,
    /** For rounding and font differences */
    slack: 4,
}

/**
 * Where the overlay legend listing `keys` will be, right-aligned at `right`
 * from `top` down; undefined when there's nothing to list
 */
function estimateLeftoverLegendBox(
    keys: string[],
    { top, right }: { top: number; right: number }
): LabelBox | undefined {
    if (keys.length === 0) return undefined
    const labelWidth = Math.min(
        Math.max(
            ...keys.map(
                (key) =>
                    Bounds.forText(key, { fontSize: LEFTOVER_LEGEND.fontSize })
                        .width
            )
        ),
        LEFTOVER_LEGEND.maxLabelWidth
    )
    const width =
        2 * LEFTOVER_LEGEND.paddingX +
        LEFTOVER_LEGEND.markWidth +
        labelWidth +
        LEFTOVER_LEGEND.slack
    const height =
        2 * LEFTOVER_LEGEND.paddingY +
        keys.length * LEFTOVER_LEGEND.rowHeight +
        LEFTOVER_LEGEND.slack
    return { left: right - width, right, top, bottom: top + height }
}

/**
 * The labels drawn on the data: the regions' names inside their bands
 * (global view), or the countries' names above their curves (countries
 * view), the latter keeping clear of whatever floats over the plot and of
 * the poverty line's label. Reports the countries left unlabelled.
 */
export function useChartLabels({
    model,
    xScale,
    yScale,
    plot,
    width,
    isNarrow,
    showSeriesLabels,
    ghostSeries,
    lineForLabels,
    hasClearButton,
    obstacles,
    legendBox,
    leftoverLegendTop,
    onUnlabelledCountriesChange,
}: {
    model: IncomeDistributionChartModel
    xScale: ScaleLogarithmic<number, number>
    yScale: ScaleLinear<number, number>
    plot: PlotRect
    /** The chart's width, which the labels stay within */
    width: number
    isNarrow: boolean
    showSeriesLabels: boolean
    ghostSeries: boolean
    /** The poverty line's label the country labels keep clear of (see dragStartLine) */
    lineForLabels: PovertyLineText | null
    /** Whether that label has a × after it */
    hasClearButton: boolean
    obstacles: LabelBox[] | undefined
    legendBox: LabelBox | undefined
    leftoverLegendTop: number | undefined
    onUnlabelledCountriesChange: ((keys: string[]) => void) | undefined
}): {
    regionLabels: RegionLabel[]
    countryLabels: CurveLabelLayout | undefined
    countryLabelFontSize: number
} {
    const incomes = model.grid.incomes
    const isStacked = model.regionBands.length > 0
    const {
        left: plotLeft,
        right: plotRight,
        top: plotTop,
        bottom: plotBottom,
    } = plot

    const regionLabels = useMemo(() => {
        if (model.regionBands.length === 0 || !showSeriesLabels || ghostSeries)
            return []
        const bands: RegionBandPixels[] = model.regionBands.map((band) => ({
            region: band.region,
            points: incomes.map((income, i) => ({
                x: xScale(income),
                top: yScale(band.y1[i]),
                bottom: yScale(band.y0[i]),
            })),
        }))
        return placeRegionLabels(bands, {
            fontSizes: isNarrow
                ? REGION_LABEL_FONT_SIZES_NARROW
                : REGION_LABEL_FONT_SIZES,
            // Measured rather than estimated from the character count, so
            // the label is as large as its band really allows
            measureAspect: (label) =>
                Bounds.forText(displayEntityName(label), {
                    fontSize: 16,
                    fontWeight: 700,
                }).width / 16,
        })
    }, [
        model.regionBands,
        incomes,
        xScale,
        yScale,
        isNarrow,
        showSeriesLabels,
        ghostSeries,
    ])

    const povertyLineLabelBox = useMemo((): LabelBox | undefined => {
        if (isStacked || !lineForLabels) return undefined
        const { box } = layoutPovertyLineLabel({
            x: xScale(lineForLabels.income),
            ballY: plotTop,
            width,
            title: lineForLabels.title,
            label: lineForLabels.label,
            hint: lineForLabels.hint,
            hasClear: hasClearButton,
            preferLeft: lineForLabels.title !== undefined,
            obstacles,
        })
        const m = POVERTY_LINE_LABEL_MARGIN
        return {
            left: box.left - m,
            right: box.right + m,
            top: box.top - m,
            bottom: box.bottom + m,
        }
    }, [
        isStacked,
        lineForLabels,
        xScale,
        plotTop,
        width,
        hasClearButton,
        obstacles,
    ])

    const countryLabelFontSize = isNarrow
        ? COUNTRY_LABEL_FONT_SIZE_NARROW
        : COUNTRY_LABEL_FONT_SIZE
    const countryLabels = useMemo((): CurveLabelLayout | undefined => {
        if (isStacked || !showSeriesLabels) return undefined
        const candidates = model.series.map((s): CurveLabelCandidate => ({
            key: s.key,
            width: Bounds.forText(s.key, {
                fontSize: countryLabelFontSize,
                fontWeight: COUNTRY_LABEL_FONT_WEIGHT,
            }).width,
            points: incomes.map((income, i) => ({
                x: xScale(income),
                y: yScale(s.y1[i]),
            })),
        }))
        const options = {
            bounds: {
                left: plotLeft,
                right: plotRight,
                top: plotTop + COUNTRY_LABEL_TOP_INSET,
                bottom: plotBottom,
            },
            labelHeight: countryLabelFontSize * COUNTRY_LABEL_LINE_HEIGHT,
            maxLabels: isNarrow
                ? MAX_COUNTRY_LABELS_NARROW
                : MAX_COUNTRY_LABELS,
            obstacles: [
                ...(obstacles ?? []),
                ...(legendBox ? [legendBox] : []),
                ...(povertyLineLabelBox ? [povertyLineLabelBox] : []),
            ],
        }
        const layout = placeCurveLabels(candidates, options)
        if (leftoverLegendTop === undefined) return layout
        // The box lists every country once any label had to be left out, so
        // place the labels as if it weren't there, then hide the ones it
        // ends up covering
        const allKeys = model.series.map((series) => series.key)
        return hideLabelsUnderBox(layout, (dropped) =>
            dropped.length === 0
                ? undefined
                : estimateLeftoverLegendBox(allKeys, {
                      top: leftoverLegendTop,
                      right: width - MARGIN.right,
                  })
        )
    }, [
        isStacked,
        model.series,
        incomes,
        xScale,
        yScale,
        countryLabelFontSize,
        isNarrow,
        plotLeft,
        plotRight,
        plotTop,
        plotBottom,
        obstacles,
        legendBox,
        povertyLineLabelBox,
        leftoverLegendTop,
        width,
        showSeriesLabels,
    ])

    // Reported by value, so a new layout with the same leftovers doesn't
    // re-render the caller
    const unlabelledCountries = countryLabels?.dropped.join("\n")
    useEffect(() => {
        if (unlabelledCountries !== undefined)
            onUnlabelledCountriesChange?.(
                unlabelledCountries === ""
                    ? []
                    : unlabelledCountries.split("\n")
            )
    }, [unlabelledCountries, onUnlabelledCountriesChange])

    return { regionLabels, countryLabels, countryLabelFontSize }
}
