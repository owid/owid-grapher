import * as _ from "lodash-es"
import { computed } from "mobx"
import { TextWrap } from "@ourworldindata/components"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import { ColorScaleBin, NumericBin } from "../color/ColorScaleBin"
import {
    SizedLegendSeries,
    VerticalColorLegendOptions,
} from "./VerticalColorLegendTypes"

/**
 * Stacks labelled colour swatches vertically, one per bin, under an optional
 * title. All coordinates are relative to the legend's own origin; the render
 * component offsets them by its `x`/`y` props.
 */
export class VerticalColorLegendState {
    private readonly bins: ColorScaleBin[]
    private readonly options: VerticalColorLegendOptions

    readonly rectPadding = 5
    readonly lineHeight = 5

    constructor(bins: ColorScaleBin[], options: VerticalColorLegendOptions) {
        this.bins = bins
        this.options = options
    }

    @computed private get maxWidth(): number {
        return this.options.maxWidth ?? 100
    }

    @computed private get fontSize(): number {
        return (
            GRAPHER_FONT_SCALE_11_2 * (this.options.fontSize ?? BASE_FONT_SIZE)
        )
    }

    @computed get rectSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    @computed get title(): TextWrap | undefined {
        if (!this.options.title) return undefined
        return new TextWrap({
            maxWidth: this.maxWidth,
            fontSize: this.fontSize,
            fontWeight: 700,
            lineHeight: 1,
            text: this.options.title,
            separators: [" ", "-"],
        })
    }

    @computed private get titleHeight(): number {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed get series(): SizedLegendSeries[] {
        const { fontSize, rectSize, rectPadding, titleHeight, lineHeight } =
            this

        let runningYOffset = titleHeight
        return this.bins.map((bin) => {
            // Get label, inferring from minText/maxText for numeric bins if needed
            let label = bin.text
            if (
                !label &&
                bin instanceof NumericBin &&
                bin.minText &&
                bin.maxText
            ) {
                label = `${bin.minText} – ${bin.maxText}`
            }

            const textWrap = new TextWrap({
                maxWidth: this.maxWidth,
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
}
