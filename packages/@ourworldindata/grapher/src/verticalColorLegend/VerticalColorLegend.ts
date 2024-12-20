import { sum, max } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import {
    GRAPHER_FONT_SCALE_11_2,
    BASE_FONT_SIZE,
} from "../core/GrapherConstants"
import { Color } from "@ourworldindata/types"

export interface VerticalColorLegendProps {
    legendItems: LegendItem[]
    maxLegendWidth?: number
    fontSize?: number
    legendTitle?: string
    activeColors?: Color[] // inactive colors are grayed out
    focusColors?: Color[] // focused colors are bolded
}

export interface LegendItem {
    label?: string
    minText?: string
    maxText?: string
    color: Color
}

interface SizedLegendSeries {
    textWrap: TextWrap
    color: Color
    width: number
    height: number
    yOffset: number
}

export class VerticalColorLegend {
    rectPadding = 5
    lineHeight = 5

    props: VerticalColorLegendProps
    constructor(props: VerticalColorLegendProps) {
        this.props = props
    }

    @computed private get maxLegendWidth(): number {
        return this.props.maxLegendWidth ?? 100
    }

    @computed private get fontSize(): number {
        return GRAPHER_FONT_SCALE_11_2 * (this.props.fontSize ?? BASE_FONT_SIZE)
    }

    @computed get rectSize(): number {
        return Math.round(this.fontSize / 1.4)
    }

    @computed get title(): TextWrap | undefined {
        if (!this.props.legendTitle) return undefined
        return new TextWrap({
            maxWidth: this.maxLegendWidth,
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

    @computed get series(): SizedLegendSeries[] {
        const { fontSize, rectSize, rectPadding, titleHeight, lineHeight } =
            this

        let runningYOffset = titleHeight
        return this.props.legendItems.map((series) => {
            let label = series.label
            // infer label for numeric bins
            if (!label && series.minText && series.maxText) {
                label = `${series.minText} – ${series.maxText}`
            }
            const textWrap = new TextWrap({
                maxWidth: this.maxLegendWidth,
                fontSize,
                lineHeight: 1,
                text: label ?? "",
            })
            const width = rectSize + rectPadding + textWrap.width
            const height = Math.max(textWrap.height, rectSize)
            const yOffset = runningYOffset

            runningYOffset += height + lineHeight

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
        const widths = this.series.map((series) => series.width)
        if (this.title) widths.push(this.title.width)
        return max(widths) ?? 0
    }

    @computed get height(): number {
        return (
            this.titleHeight +
            sum(this.series.map((series) => series.height)) +
            this.lineHeight * this.series.length
        )
    }
}
