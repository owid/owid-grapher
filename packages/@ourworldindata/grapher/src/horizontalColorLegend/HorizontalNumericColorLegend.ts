import { Color, HorizontalAlign } from "@ourworldindata/types"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin"
import { computed } from "mobx"
import {
    CATEGORICAL_BIN_MIN_WIDTH,
    DEFAULT_NUMERIC_BIN_SIZE,
    DEFAULT_NUMERIC_BIN_STROKE,
    DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
    DEFAULT_TEXT_COLOR,
    DEFAULT_TICK_SIZE,
    MINIMUM_LABEL_DISTANCE,
} from "./HorizontalColorLegendConstants"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import { Bounds, last, max, min, sum } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"

export interface HorizontalNumericColorLegendProps {
    fontSize?: number
    x?: number
    align?: HorizontalAlign
    maxWidth?: number
    numericLegendData: ColorScaleBin[]
    numericBinSize?: number
    numericBinStroke?: Color
    numericBinStrokeWidth?: number
    equalSizeBins?: boolean
    legendWidth?: number
    legendTitle?: string
    numericFocusBracket?: ColorScaleBin
    numericLegendY?: number
    legendTextColor?: Color
    legendTickSize?: number
}

interface NumericLabel {
    text: string
    fontSize: number
    bounds: Bounds
    priority?: boolean
    hidden: boolean
    raised: boolean
}

export interface PositionedBin {
    x: number
    width: number
    bin: ColorScaleBin
}

export class HorizontalNumericColorLegend {
    props: HorizontalNumericColorLegendProps
    constructor(props: HorizontalNumericColorLegendProps) {
        this.props = props
    }

    static height(props: HorizontalNumericColorLegendProps): number {
        const legend = new HorizontalNumericColorLegend(props)
        return legend.height
    }

    @computed get numericLegendY(): number {
        return this.props.numericLegendY ?? 0
    }

    @computed get legendTextColor(): Color {
        return this.props.legendTextColor ?? DEFAULT_TEXT_COLOR
    }

    @computed private get legendTickSize(): number {
        return this.props.legendTickSize ?? DEFAULT_TICK_SIZE
    }

    @computed private get numericLegendData(): ColorScaleBin[] {
        return this.props.numericLegendData ?? []
    }

    @computed private get visibleBins(): ColorScaleBin[] {
        return this.numericLegendData.filter((bin) => !bin.isHidden)
    }

    @computed private get numericBins(): NumericBin[] {
        return this.visibleBins.filter(
            (bin): bin is NumericBin => bin instanceof NumericBin
        )
    }

    @computed get numericBinSize(): number {
        return this.props.numericBinSize ?? DEFAULT_NUMERIC_BIN_SIZE
    }

    @computed get numericBinStroke(): Color {
        return this.props.numericBinStroke ?? DEFAULT_NUMERIC_BIN_STROKE
    }

    @computed get numericBinStrokeWidth(): number {
        return (
            this.props.numericBinStrokeWidth ?? DEFAULT_NUMERIC_BIN_STROKE_WIDTH
        )
    }

    @computed protected get fontSize(): number {
        return this.props.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get tickFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get itemMargin(): number {
        return Math.round(this.fontSize * 1.125)
    }

    // NumericColorLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed private get minValue(): number {
        return min(this.numericBins.map((bin) => bin.min)) as number
    }
    @computed private get maxValue(): number {
        return max(this.numericBins.map((bin) => bin.max)) as number
    }
    @computed private get rangeSize(): number {
        return this.maxValue - this.minValue
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? this.props.legendWidth ?? 200
    }

    private getTickLabelWidth(label: string): number {
        return Bounds.forText(label, {
            fontSize: this.tickFontSize,
        }).width
    }

    private getCategoricalBinWidth(bin: ColorScaleBin): number {
        return Math.max(
            this.getTickLabelWidth(bin.text),
            CATEGORICAL_BIN_MIN_WIDTH
        )
    }

    @computed private get totalCategoricalWidth(): number {
        const { visibleBins, itemMargin } = this
        const widths = visibleBins.map((bin) =>
            bin instanceof CategoricalBin && !bin.isHidden
                ? this.getCategoricalBinWidth(bin) + itemMargin
                : 0
        )
        return sum(widths)
    }

    @computed private get isAutoWidth(): boolean {
        return (
            this.props.legendWidth === undefined &&
            this.props.maxWidth !== undefined
        )
    }

    private getNumericLabelMinWidth(bin: NumericBin): number {
        if (bin.text) {
            const tickLabelWidth = this.getTickLabelWidth(bin.text)
            return tickLabelWidth + MINIMUM_LABEL_DISTANCE
        } else {
            const combinedLabelWidths = sum(
                [bin.minText, bin.maxText].map(
                    (text) =>
                        // because labels are center-aligned, only half the label space is required
                        this.getTickLabelWidth(text) / 2
                )
            )
            return combinedLabelWidths + MINIMUM_LABEL_DISTANCE * 2
        }
    }

    // Overstretched legends don't look good.
    // If the manager provides `legendMaxWidth`, then we calculate an _ideal_ width for the legend.
    @computed private get idealNumericWidth(): number {
        const binCount = this.numericBins.length
        const spaceRequirements = this.numericBins.map((bin) => ({
            labelSpace: this.getNumericLabelMinWidth(bin),
            shareOfTotal: (bin.max - bin.min) / this.rangeSize,
        }))
        // Make sure the legend is big enough to avoid overlapping labels (including `raisedMode`)
        if (this.props.equalSizeBins) {
            // Try to keep the minimum close to the size of the "No data" bin,
            // so they look visually balanced somewhat.
            const minBinWidth = this.fontSize * 3.25
            const maxBinWidth =
                max(
                    spaceRequirements.map(({ labelSpace }) =>
                        Math.max(labelSpace, minBinWidth)
                    )
                ) ?? 0
            return Math.round(maxBinWidth * binCount)
        } else {
            const minBinWidth = this.fontSize * 2
            const maxTotalWidth =
                max(
                    spaceRequirements.map(({ labelSpace, shareOfTotal }) =>
                        Math.max(labelSpace / shareOfTotal, minBinWidth)
                    )
                ) ?? 0
            return Math.round(maxTotalWidth)
        }
    }

    @computed get width(): number {
        if (this.isAutoWidth) {
            return Math.min(
                this.maxWidth,
                this.legendTitleWidth +
                    this.totalCategoricalWidth +
                    this.idealNumericWidth
            )
        } else {
            return this.maxWidth
        }
    }

    @computed private get availableNumericWidth(): number {
        return this.width - this.totalCategoricalWidth - this.legendTitleWidth
    }

    // Since we calculate the width automatically in some cases (when `isAutoWidth` is true),
    // we need to shift X to align the legend horizontally (`legendAlign`).
    @computed get x(): number {
        const { width, maxWidth, x } = this
        const { align } = this.props
        const widthDiff = maxWidth - width
        if (align === HorizontalAlign.center) {
            return x + widthDiff / 2
        } else if (align === HorizontalAlign.right) {
            return x + widthDiff
        } else {
            return x // left align
        }
    }

    @computed get positionedBins(): PositionedBin[] {
        const {
            rangeSize,
            availableNumericWidth,
            visibleBins,
            numericBins,
            legendTitleWidth,
            x,
        } = this
        const { equalSizeBins } = this.props

        let xOffset = x + legendTitleWidth
        let prevBin: ColorScaleBin | undefined

        return visibleBins.map((bin, index) => {
            const isFirst = index === 0
            let width: number = this.getCategoricalBinWidth(bin)
            let marginLeft: number = isFirst ? 0 : this.itemMargin

            if (bin instanceof NumericBin) {
                if (equalSizeBins) {
                    width = availableNumericWidth / numericBins.length
                } else {
                    width =
                        ((bin.max - bin.min) / rangeSize) *
                        availableNumericWidth
                }
                // Don't add any margin between numeric bins
                if (prevBin instanceof NumericBin) {
                    marginLeft = 0
                }
            }

            const x = xOffset + marginLeft
            xOffset = x + width
            prevBin = bin

            return {
                x,
                width,
                bin,
            }
        })
    }

    @computed get legendTitleFontSize(): number {
        return this.fontSize * GRAPHER_FONT_SCALE_14
    }

    @computed get legendTitle(): TextWrap | undefined {
        const { legendTitle } = this.props
        return legendTitle
            ? new TextWrap({
                  text: legendTitle,
                  fontSize: this.legendTitleFontSize,
                  fontWeight: 700,
                  maxWidth: this.maxWidth / 3,
                  lineHeight: 1,
              })
            : undefined
    }

    @computed private get legendTitleWidth(): number {
        return this.legendTitle ? this.legendTitle.width + this.itemMargin : 0
    }

    @computed get numericLabels(): NumericLabel[] {
        const { numericBinSize, positionedBins, tickFontSize } = this

        const makeBoundaryLabel = (
            bin: PositionedBin,
            minOrMax: "min" | "max",
            text: string
        ): NumericLabel => {
            const labelBounds = Bounds.forText(text, { fontSize: tickFontSize })
            const x =
                bin.x +
                (minOrMax === "min" ? 0 : bin.width) -
                labelBounds.width / 2
            const y = -numericBinSize - labelBounds.height - this.legendTickSize

            return {
                text: text,
                fontSize: tickFontSize,
                bounds: labelBounds.set({ x: x, y: y }),
                hidden: false,
                raised: false,
            }
        }

        const makeRangeLabel = (bin: PositionedBin): NumericLabel => {
            const labelBounds = Bounds.forText(bin.bin.text, {
                fontSize: tickFontSize,
            })
            const x = bin.x + bin.width / 2 - labelBounds.width / 2
            const y = -numericBinSize - labelBounds.height - this.legendTickSize

            return {
                text: bin.bin.text,
                fontSize: tickFontSize,
                bounds: labelBounds.set({ x: x, y: y }),
                priority: true,
                hidden: false,
                raised: false,
            }
        }

        let labels: NumericLabel[] = []
        for (const bin of positionedBins) {
            if (bin.bin.text) labels.push(makeRangeLabel(bin))
            else if (bin.bin instanceof NumericBin) {
                if (bin.bin.minText)
                    labels.push(makeBoundaryLabel(bin, "min", bin.bin.minText))
                if (bin === last(positionedBins) && bin.bin.maxText)
                    labels.push(makeBoundaryLabel(bin, "max", bin.bin.maxText))
            }
        }

        for (let index = 0; index < labels.length; index++) {
            const l1 = labels[index]
            if (l1.hidden) continue

            for (let j = index + 1; j < labels.length; j++) {
                const l2 = labels[j]
                if (
                    l1.bounds.right + MINIMUM_LABEL_DISTANCE >
                        l2.bounds.centerX ||
                    (l2.bounds.left - MINIMUM_LABEL_DISTANCE <
                        l1.bounds.centerX &&
                        !l2.priority)
                )
                    l2.hidden = true
            }
        }

        labels = labels.filter((label) => !label.hidden)

        // If labels overlap, first we try alternating raised labels
        let raisedMode = false
        for (let index = 1; index < labels.length; index++) {
            const l1 = labels[index - 1],
                l2 = labels[index]
            if (l1.bounds.right + MINIMUM_LABEL_DISTANCE > l2.bounds.left) {
                raisedMode = true
                break
            }
        }

        if (raisedMode) {
            for (let index = 1; index < labels.length; index++) {
                const label = labels[index]
                if (index % 2 !== 0) {
                    label.bounds = label.bounds.set({
                        y: label.bounds.y - label.bounds.height - 1,
                    })
                    label.raised = true
                }
            }
        }

        return labels
    }

    @computed get height(): number {
        return Math.abs(
            min(this.numericLabels.map((label) => label.bounds.y)) ?? 0
        )
    }

    @computed get bounds(): Bounds {
        return new Bounds(this.x, this.numericLegendY, this.width, this.height)
    }
}
