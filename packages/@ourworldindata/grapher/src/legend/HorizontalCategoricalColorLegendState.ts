import * as _ from "lodash-es"
import { computed } from "mobx"
import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12_8,
} from "../core/GrapherConstants"
import {
    LegendStyleConfig,
    LegendTextStyle,
    LegendMarkerStyle,
} from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    CategoricalMark,
    MarkLine,
    HorizontalCategoricalColorLegendOptions,
} from "./HorizontalColorLegendTypes"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

const RECT_PADDING = 5
const MARK_PADDING = 5

export class HorizontalCategoricalColorLegendState {
    private readonly bins: CategoricalBin[]
    private readonly options: HorizontalCategoricalColorLegendOptions

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

    @computed private get legendAlign(): HorizontalAlign {
        return this.options.legendAlign ?? HorizontalAlign.center
    }

    @computed get containerWidth(): number {
        return this.options.legendWidth ?? this.options.legendMaxWidth ?? 200
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
                rectSize + RECT_PADDING + labelBounds.width + MARK_PADDING

            if (xOffset + markWidth > this.containerWidth && marks.length > 0) {
                lines.push({
                    totalWidth: xOffset - MARK_PADDING,
                    marks: marks,
                })
                marks = []
                xOffset = 0
                yOffset += rectSize + RECT_PADDING
            }

            const markX = xOffset
            const markY = yOffset

            const label = {
                text: bin.text,
                bounds: labelBounds.set({
                    x: markX + rectSize + RECT_PADDING,
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
            lines.push({ totalWidth: xOffset - MARK_PADDING, marks: marks })

        return lines
    }

    @computed private get contentWidth(): number {
        return _.max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed get width(): number {
        return this.containerWidth ?? this.contentWidth
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines
        const align = this.legendAlign
        const width = this.containerWidth

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

    @computed get rectPadding(): number {
        return RECT_PADDING
    }

    @computed private get legendStyleConfig(): LegendStyleConfig | undefined {
        return (
            this.options.categoricalLegendStyleConfig ??
            this.options.legendStyleConfig
        )
    }

    private getBinState(bin: ColorScaleBin): Emphasis {
        return this.options.resolveLegendBinEmphasis?.(bin) ?? Emphasis.Default
    }

    getTextStyleConfig(bin: ColorScaleBin): LegendTextStyle {
        const state = this.getBinState(bin)
        const styleConfig = this.legendStyleConfig?.text
        const defaultStyle = styleConfig?.default
        const currentStyle = styleConfig?.[state]
        return { color: GRAPHER_DARK_TEXT, ...defaultStyle, ...currentStyle }
    }

    getMarkerStyleConfig(bin: ColorScaleBin): LegendMarkerStyle {
        const state = this.getBinState(bin)
        const styleConfig = this.legendStyleConfig?.marker
        const defaultStyle = styleConfig?.default
        const currentStyle = styleConfig?.[state]
        return {
            fill: bin.color,
            strokeWidth: 0.4,
            ...defaultStyle,
            ...currentStyle,
        }
    }
}
