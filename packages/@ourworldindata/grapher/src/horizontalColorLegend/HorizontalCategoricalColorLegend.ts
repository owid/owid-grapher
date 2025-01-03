import { computed } from "mobx"
import { max, Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { CategoricalBin } from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_12_8,
} from "../core/GrapherConstants"
import { SPACE_BETWEEN_CATEGORICAL_BINS } from "./HorizontalColorLegendConstants"

export interface HorizontalCategoricalColorLegendProps {
    categoricalBins: CategoricalBin[]
    maxWidth?: number
    align?: HorizontalAlign
    fontSize?: number
}

export interface CategoricalMark {
    x: number
    y: number
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
    /** Margin between the swatch and the label */
    swatchMarginRight = 5

    /** Horizontal space between two bins */
    horizontalBinMargin = 5

    props: HorizontalCategoricalColorLegendProps
    constructor(props: HorizontalCategoricalColorLegendProps) {
        this.props = props
    }

    static numLines(props: HorizontalCategoricalColorLegendProps): number {
        const legend = new HorizontalCategoricalColorLegend(props)
        return legend.numLines
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? 200
    }

    @computed private get fontSize(): number {
        return this.props.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelFontSize(): number {
        return GRAPHER_FONT_SCALE_12_8 * this.fontSize
    }

    @computed get swatchSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get align(): HorizontalAlign {
        return this.props.align ?? HorizontalAlign.center
    }

    @computed private get bins(): CategoricalBin[] {
        return this.props.categoricalBins ?? []
    }

    @computed private get visibleBins(): CategoricalBin[] {
        return this.bins.filter((bin) => !bin.isHidden)
    }

    @computed private get markLines(): MarkLine[] {
        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = []
        let xOffset = 0
        let yOffset = 0
        this.visibleBins.forEach((bin) => {
            const labelBounds = Bounds.forText(bin.text, {
                fontSize: this.labelFontSize,
            })
            const markWidth =
                this.swatchSize +
                this.swatchMarginRight +
                labelBounds.width +
                this.horizontalBinMargin

            if (xOffset + markWidth > this.maxWidth && marks.length > 0) {
                lines.push({
                    totalWidth: xOffset - this.horizontalBinMargin,
                    marks: marks,
                })
                marks = []
                xOffset = 0
                yOffset += this.swatchSize + this.swatchMarginRight
            }

            const markX = xOffset
            const markY = yOffset

            const label = {
                text: bin.text,
                bounds: labelBounds.set({
                    x: markX + this.swatchSize + this.swatchMarginRight,
                    y: markY + this.swatchSize / 2,
                }),
                fontSize: this.labelFontSize,
            }

            marks.push({
                x: markX,
                y: markY,
                width: markWidth,
                label,
                bin,
            })

            xOffset += markWidth + SPACE_BETWEEN_CATEGORICAL_BINS
        })

        if (marks.length > 0)
            lines.push({
                totalWidth: xOffset - this.horizontalBinMargin,
                marks: marks,
            })

        return lines
    }

    @computed private get contentWidth(): number {
        return max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed private get containerWidth(): number {
        return this.maxWidth ?? this.contentWidth
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
        return max(this.marks.map((mark) => mark.y + this.swatchSize)) ?? 0
    }

    @computed get numLines(): number {
        return this.markLines.length
    }
}
