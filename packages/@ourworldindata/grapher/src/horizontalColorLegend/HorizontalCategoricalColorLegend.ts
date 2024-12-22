import { computed } from "mobx"
import { max, Bounds, Color, HorizontalAlign } from "@ourworldindata/utils"
import { CategoricalBin } from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12_8,
} from "../core/GrapherConstants"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

export interface HorizontalCategoricalColorLegendProps {
    fontSize?: number
    align?: HorizontalAlign
    maxWidth?: number
    categoricalLegendData: CategoricalBin[]
    categoricalBinStroke?: Color
    categoryLegendY?: number
}

interface CategoricalMark {
    x: number
    y: number
    rectSize: number
    width: number
    label: {
        text: string
        bounds: Bounds
        fontSize: number
    }
    bin: CategoricalBin
}

interface MarkLine {
    totalWidth: number
    marks: CategoricalMark[]
}

export class HorizontalCategoricalColorLegend {
    rectPadding = 5
    private markPadding = 5

    props: HorizontalCategoricalColorLegendProps
    constructor(props: HorizontalCategoricalColorLegendProps) {
        this.props = props
    }

    static height(props: HorizontalCategoricalColorLegendProps): number {
        const legend = new HorizontalCategoricalColorLegend(props)
        return legend.height
    }

    static numLines(props: HorizontalCategoricalColorLegendProps): number {
        const legend = new HorizontalCategoricalColorLegend(props)
        return legend.numLines
    }

    @computed get categoryLegendY(): number {
        return this.props.categoryLegendY ?? 0
    }

    @computed get width(): number {
        return this.props.maxWidth ?? 200
    }

    @computed private get fontSize(): number {
        return this.props.fontSize ?? BASE_FONT_SIZE
    }

    @computed protected get align(): HorizontalAlign {
        // Assume center alignment if none specified, for backwards-compatibility
        return this.props.align ?? HorizontalAlign.center
    }

    @computed private get categoricalLegendData(): CategoricalBin[] {
        return this.props.categoricalLegendData ?? []
    }

    @computed private get visibleCategoricalBins(): CategoricalBin[] {
        return this.categoricalLegendData.filter((bin) => !bin.isHidden)
    }

    @computed private get markLines(): MarkLine[] {
        const fontSize = this.fontSize * GRAPHER_FONT_SCALE_12_8
        const rectSize = this.fontSize * 0.75

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = []
        let xOffset = 0
        let yOffset = 0
        this.visibleCategoricalBins.forEach((bin) => {
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

    @computed private get contentWidth(): number {
        return max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed private get containerWidth(): number {
        return this.width ?? this.contentWidth
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines
        const align = this.align
        const width = this.containerWidth

        // Center each line
        lines.forEach((line) => {
            // TODO abstract this
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
        return max(this.marks.map((mark) => mark.y + mark.rectSize)) ?? 0
    }

    @computed get numLines(): number {
        return this.markLines.length
    }
}
