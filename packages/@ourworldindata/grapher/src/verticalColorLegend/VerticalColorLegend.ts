import { sum, max } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import { Color } from "@ourworldindata/types"

interface Bin {
    color: Color
}

export interface VerticalColorLegendCategoricalBin extends Bin {
    type: "categorical"
    label: string
}

export interface VerticalColorLegendNumericBin extends Bin {
    type: "numeric"
    minLabel: string
    maxLabel: string
}

export type VerticalColorLegendBin =
    | VerticalColorLegendCategoricalBin
    | VerticalColorLegendNumericBin

export interface PlacedBin extends Bin {
    textWrap: TextWrap
    width: number
    height: number
    yOffset: number
}

export interface VerticalColorLegendProps {
    bins: VerticalColorLegendBin[]
    maxWidth?: number
    fontSize?: number
    legendTitle?: string
}

export class VerticalColorLegend {
    /** Margin between the swatch and the label */
    swatchMarginRight = 5

    /** Vertical space between two bins */
    verticalBinMargin = 5

    private props: VerticalColorLegendProps
    constructor(props: VerticalColorLegendProps) {
        this.props = props
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? 100
    }

    @computed private get fontSize(): number {
        return GRAPHER_FONT_SCALE_11_2 * (this.props.fontSize ?? BASE_FONT_SIZE)
    }

    @computed get swatchSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    @computed get title(): TextWrap | undefined {
        if (!this.props.legendTitle) return undefined
        return new TextWrap({
            maxWidth: this.maxWidth,
            fontSize: this.fontSize,
            fontWeight: 700,
            lineHeight: 1,
            text: this.props.legendTitle,
        })
    }

    @computed private get titleHeight(): number {
        if (!this.title) return 0
        return this.title.height + 5
    }

    @computed get placedBins(): PlacedBin[] {
        const {
            fontSize,
            swatchSize,
            swatchMarginRight,
            titleHeight,
            verticalBinMargin,
        } = this

        let runningYOffset = titleHeight
        return this.props.bins.map((series) => {
            let label
            if (series.type === "categorical") {
                label = series.label
            } else {
                // infer label for numeric bins
                label = `${series.minLabel} – ${series.maxLabel}`
            }
            const textWrap = new TextWrap({
                maxWidth: this.maxWidth,
                fontSize,
                lineHeight: 1,
                text: label ?? "",
            })
            const width = swatchSize + swatchMarginRight + textWrap.width
            const height = Math.max(textWrap.height, swatchSize)
            const yOffset = runningYOffset

            runningYOffset += height + verticalBinMargin

            return {
                textWrap,
                color: series.color,
                width,
                height,
                yOffset,
            }
        })
    }

    @computed get width(): number {
        const widths = this.placedBins.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            sum(this.placedBins.map((series) => series.height)) +
            this.verticalBinMargin * this.placedBins.length
        )
    }
}
