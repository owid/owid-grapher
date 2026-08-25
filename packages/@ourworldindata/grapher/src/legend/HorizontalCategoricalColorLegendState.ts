import * as _ from "lodash-es"
import { computed } from "mobx"
import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { ColorScaleBin, CategoricalBin } from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12_8,
} from "../core/GrapherConstants"
import { LegendTextStyle, LegendMarkerStyle } from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    CategoricalMark,
    MarkLine,
    HorizontalCategoricalColorLegendOptions,
} from "./HorizontalColorLegendTypes"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

/**
 * Lays out labelled color swatches wrapped across as many lines as they need.
 * All coordinates are relative to the legend's own origin; the render
 * component offsets them by its `x`/`y` props.
 */
export class HorizontalCategoricalColorLegendState {
    private readonly bins: CategoricalBin[]
    private readonly options: HorizontalCategoricalColorLegendOptions

    readonly rectPadding = 5
    private readonly markPadding = 5

    constructor(
        bins: CategoricalBin[],
        options: HorizontalCategoricalColorLegendOptions
    ) {
        this.bins = bins
        this.options = options
    }

    @computed private get fontSize(): number {
        return this.options.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get align(): HorizontalAlign {
        return this.options.align ?? HorizontalAlign.center
    }

    @computed get width(): number {
        return this.options.width ?? this.options.maxWidth ?? 200
    }

    @computed private get visibleBins(): CategoricalBin[] {
        return this.bins.filter((bin) => !bin.isHidden)
    }

    @computed private get markLines(): MarkLine[] {
        const fontSize = this.fontSize * GRAPHER_FONT_SCALE_12_8
        const rectSize = this.fontSize * 0.75

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = []
        let xOffset = 0
        let yOffset = 0
        this.visibleBins.forEach((bin) => {
            const labelBounds = Bounds.forText(bin.text, { fontSize })
            const markWidth =
                rectSize +
                this.rectPadding +
                labelBounds.width +
                this.markPadding

            if (xOffset + markWidth > this.width && marks.length > 0) {
                lines.push({
                    totalWidth: xOffset - this.markPadding,
                    marks: marks,
                })
                marks = []
                xOffset = 0
                yOffset += rectSize + this.rectPadding
            }

            const markX = xOffset
            const markY = yOffset

            const label = {
                text: bin.text,
                bounds: labelBounds.set({
                    x: markX + rectSize + this.rectPadding,
                    y: markY + rectSize / 2,
                }),
                fontSize,
            }

            marks.push({
                x: markX,
                y: markY,
                width: markWidth,
                rectSize,
                label,
                bin,
            })

            xOffset += markWidth + SPACE_BETWEEN_CATEGORICAL_BINS
        })

        if (marks.length > 0)
            lines.push({ totalWidth: xOffset - this.markPadding, marks: marks })

        return lines
    }

    @computed get marks(): CategoricalMark[] {
        const { markLines: lines, align, width } = this

        // Center each line
        lines.forEach((line) => {
            const xShift =
                align === HorizontalAlign.center
                    ? (width - line.totalWidth) / 2
                    : align === HorizontalAlign.right
                      ? width - line.totalWidth
                      : 0
            line.marks.forEach((mark) => {
                mark.x += xShift
                mark.label.bounds = mark.label.bounds.set({
                    x: mark.label.bounds.x + xShift,
                })
            })
        })

        return lines.flatMap((l) => l.marks)
    }

    @computed get height(): number {
        return _.max(this.marks.map((mark) => mark.y + mark.rectSize)) ?? 0
    }

    getBinEmphasis(bin: ColorScaleBin): Emphasis {
        return this.options.resolveBinEmphasis?.(bin) ?? Emphasis.Default
    }

    getTextStyle(bin: ColorScaleBin): LegendTextStyle {
        const styleConfig = this.options.styleConfig?.text
        return {
            color: GRAPHER_DARK_TEXT,
            ...styleConfig?.default,
            ...styleConfig?.[this.getBinEmphasis(bin)],
        }
    }

    getMarkerStyle(bin: ColorScaleBin): LegendMarkerStyle {
        const styleConfig = this.options.styleConfig?.marker
        return {
            fill: bin.color,
            strokeWidth: 0.4,
            ...styleConfig?.default,
            ...styleConfig?.[this.getBinEmphasis(bin)],
        }
    }
}
