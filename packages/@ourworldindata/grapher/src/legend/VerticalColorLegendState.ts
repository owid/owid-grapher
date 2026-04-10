import * as _ from "lodash-es"
import { computed } from "mobx"
import { TextWrap } from "@ourworldindata/components"
import { ColorScaleBin, NumericBin } from "../color/ColorScaleBin"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import {
    LegendStyleConfig,
    LegendTextStyle,
    LegendMarkerStyle,
} from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    SizedLegendSeries,
    VerticalColorLegendOptions,
} from "./VerticalColorLegendTypes"

const RECT_PADDING = 5
const LINE_HEIGHT = 5

export class VerticalColorLegendState {
    private readonly bins: ColorScaleBin[]
    private readonly options: VerticalColorLegendOptions

    constructor(bins: ColorScaleBin[], options: VerticalColorLegendOptions) {
        this.bins = bins
        this.options = options
    }

    @computed private get maxLegendWidth(): number {
        return this.options.maxLegendWidth ?? 100
    }

    @computed private get fontSize(): number {
        return (
            GRAPHER_FONT_SCALE_11_2 * (this.options.fontSize ?? BASE_FONT_SIZE)
        )
    }

    @computed get rectSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    @computed get rectPadding(): number {
        return RECT_PADDING
    }

    @computed get lineHeight(): number {
        return LINE_HEIGHT
    }

    @computed get title(): TextWrap | undefined {
        if (!this.options.legendTitle) return undefined
        return new TextWrap({
            maxWidth: this.maxLegendWidth,
            fontSize: this.fontSize,
            fontWeight: 700,
            lineHeight: 1,
            text: this.options.legendTitle,
            separators: [" ", "-"],
        })
    }

    @computed get titleHeight(): number {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed get series(): SizedLegendSeries[] {
        const { fontSize, rectPadding, titleHeight, lineHeight } = this
        const rectSize = this.rectSize

        let runningYOffset = titleHeight
        return this.bins.map((bin) => {
            let label = bin.text
            if (
                !label &&
                bin instanceof NumericBin &&
                bin.minText &&
                bin.maxText
            ) {
                label = `${bin.minText} \u2013 ${bin.maxText}`
            }

            const textWrap = new TextWrap({
                maxWidth: this.maxLegendWidth,
                fontSize,
                lineHeight: 1,
                text: label,
                separators: [" ", "-"],
            })
            const width = rectSize + rectPadding + textWrap.width
            const height = Math.max(textWrap.height, rectSize)
            const yOffset = runningYOffset

            runningYOffset += height + lineHeight

            return { bin, textWrap, width, height, yOffset }
        })
    }

    @computed get width(): number {
        const widths = this.series.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return _.max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            _.sum(this.series.map((series) => series.height)) +
            this.lineHeight * this.series.length
        )
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
        return { fill: bin.color, ...defaultStyle, ...currentStyle }
    }
}
