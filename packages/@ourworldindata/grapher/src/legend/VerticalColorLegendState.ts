import * as _ from "lodash-es"
import { computed } from "mobx"
import { TextWrap } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { roundFontSize, scaleFontSize } from "../chart/ChartUtils"
import { INLINE_ANNOTATION_PADDING } from "../verticalLabels/VerticalLabelsConstants"
import {
    ColorScaleBin,
    isCategoricalBin,
    isNumericBin,
} from "../color/ColorScaleBin"
import {
    PlacedLegendSeries,
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

    private readonly rectPadding = 5
    private readonly lineHeight = 5

    constructor(bins: ColorScaleBin[], options: VerticalColorLegendOptions) {
        this.bins = bins
        this.options = options
    }

    @computed private get maxWidth(): number {
        return this.options.maxWidth ?? 100
    }

    @computed private get fontSize(): number {
        return scaleFontSize(11.2, this.options.baseFontSize ?? BASE_FONT_SIZE)
    }

    @computed private get rectSize(): number {
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

    private makeAnnotationTextWrap(bin: ColorScaleBin): TextWrap | undefined {
        const text = isCategoricalBin(bin) ? bin.annotation : undefined
        if (!text) return undefined
        return new TextWrap({
            text,
            maxWidth: Math.min(this.maxWidth, 150),
            fontSize: roundFontSize(this.fontSize * 0.9),
            lineHeight: 1,
        })
    }

    @computed private get sizedSeries(): SizedLegendSeries[] {
        const { fontSize, rectSize, rectPadding } = this

        return this.bins.map((bin) => {
            // Get label, inferring from minText/maxText for numeric bins if needed
            let label = bin.text
            if (!label && isNumericBin(bin) && bin.minText && bin.maxText) {
                label = `${bin.minText} – ${bin.maxText}`
            }

            const textWrap = new TextWrap({
                maxWidth: this.maxWidth,
                fontSize,
                lineHeight: 1,
                text: label,
                separators: [" ", "-"],
            })

            const annotationTextWrap = this.makeAnnotationTextWrap(bin)

            const labelHeight = annotationTextWrap
                ? textWrap.height +
                  INLINE_ANNOTATION_PADDING +
                  annotationTextWrap.height
                : textWrap.height

            return {
                bin,
                textWrap,
                annotationTextWrap,
                width:
                    rectSize +
                    rectPadding +
                    Math.max(textWrap.width, annotationTextWrap?.width ?? 0),
                height: Math.max(labelHeight, rectSize),
            }
        })
    }

    @computed get series(): PlacedLegendSeries[] {
        const { rectSize, rectPadding, lineHeight } = this

        let runningYOffset = this.titleHeight
        return this.sizedSeries.map((series) => {
            const yOffset = runningYOffset
            runningYOffset += series.height + lineHeight

            const label = { x: rectSize + rectPadding, y: yOffset }

            // The swatch hangs off the label's first baseline rather than its
            // box, so the two line up however the text happens to wrap.
            const [, baselineY] = series.textWrap.getPositionForSvgRendering(
                label.x,
                label.y
            )

            return {
                ...series,
                label,
                swatch: new Bounds(0, baselineY - rectSize, rectSize, rectSize),
                hitArea: new Bounds(
                    0,
                    yOffset - lineHeight / 2,
                    series.width,
                    series.height + lineHeight
                ),
            }
        })
    }

    @computed get width(): number {
        const widths = this.sizedSeries.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return _.max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            _.sum(this.sizedSeries.map((series) => series.height)) +
            this.lineHeight * this.sizedSeries.length
        )
    }
}
