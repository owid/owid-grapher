import * as _ from "lodash-es"
import * as R from "remeda"
import { computed } from "mobx"
import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import {
    LegendStyleConfig,
    LegendTextStyle,
    LegendMarkerStyle,
} from "./LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    PositionedBin,
    NumericLabel,
    HorizontalNumericColorLegendOptions,
} from "./HorizontalColorLegendTypes"
import {
    DEFAULT_NUMERIC_BIN_SIZE,
    DEFAULT_NUMERIC_BIN_STROKE,
    DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
    DEFAULT_TEXT_COLOR,
    DEFAULT_TICK_SIZE,
    CATEGORICAL_BIN_MIN_WIDTH,
    MINIMUM_LABEL_DISTANCE,
} from "./HorizontalColorLegendConstants"

export class HorizontalNumericColorLegendState {
    private readonly bins: ColorScaleBin[]
    private readonly options: HorizontalNumericColorLegendOptions

    constructor(
        bins: ColorScaleBin[],
        options: HorizontalNumericColorLegendOptions
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

    @computed private get legendTickSize(): number {
        return this.options.legendTickSize ?? DEFAULT_TICK_SIZE
    }

    @computed private get visibleBins(): ColorScaleBin[] {
        return this.bins.filter((bin) => !bin.isHidden)
    }

    @computed private get numericBins(): NumericBin[] {
        return this.visibleBins.filter(
            (bin): bin is NumericBin => bin instanceof NumericBin
        )
    }

    @computed get numericBinSize(): number {
        return this.options.numericBinSize ?? DEFAULT_NUMERIC_BIN_SIZE
    }

    @computed private get tickFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get itemMargin(): number {
        return Math.round(this.fontSize * 1.125)
    }

    @computed private get maxWidth(): number {
        return this.options.legendMaxWidth ?? this.options.legendWidth ?? 200
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
        return _.sum(widths)
    }

    @computed private get isAutoWidth(): boolean {
        return (
            this.options.legendWidth === undefined &&
            this.options.legendMaxWidth !== undefined
        )
    }

    private getNumericLabelMinWidth(bin: NumericBin): number {
        if (bin.text) {
            const tickLabelWidth = this.getTickLabelWidth(bin.text)
            return tickLabelWidth + MINIMUM_LABEL_DISTANCE
        } else {
            const combinedLabelWidths = _.sum(
                [bin.minText, bin.maxText].map(
                    (text) => this.getTickLabelWidth(text) / 2
                )
            )
            return combinedLabelWidths + MINIMUM_LABEL_DISTANCE * 2
        }
    }

    @computed private get idealNumericWidth(): number {
        const binCount = this.numericBins.length
        const spaceRequirements = this.numericBins.map((bin) => ({
            labelSpace: this.getNumericLabelMinWidth(bin),
        }))

        const minBinWidth = this.fontSize * 3.25
        const maxBinWidth =
            _.max(
                spaceRequirements.map(({ labelSpace }) =>
                    Math.max(labelSpace, minBinWidth)
                )
            ) ?? 0
        return Math.round(maxBinWidth * binCount)
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
    @computed private get xOffset(): number {
        const { width, maxWidth, legendAlign } = this
        const widthDiff = maxWidth - width
        if (legendAlign === HorizontalAlign.center) {
            return widthDiff / 2
        } else if (legendAlign === HorizontalAlign.right) {
            return widthDiff
        } else {
            return 0 // left align
        }
    }

    @computed get positionedBins(): PositionedBin[] {
        const {
            availableNumericWidth,
            visibleBins,
            numericBins,
            legendTitleWidth,
            xOffset,
        } = this

        let runningX = xOffset + legendTitleWidth
        let prevBin: ColorScaleBin | undefined

        return visibleBins.map((bin, index) => {
            const isFirst = index === 0
            let width: number = this.getCategoricalBinWidth(bin)
            let marginLeft: number = isFirst ? 0 : this.itemMargin

            if (bin instanceof NumericBin) {
                width = availableNumericWidth / numericBins.length

                if (prevBin instanceof NumericBin) {
                    marginLeft = 0
                }
            }

            const x = runningX + marginLeft
            runningX = x + width
            prevBin = bin

            return {
                x,
                width,
                bin,
            }
        })
    }

    @computed private get legendTitleFontSize(): number {
        return this.fontSize * GRAPHER_FONT_SCALE_14
    }

    @computed get legendTitle(): TextWrap | undefined {
        const { legendTitle } = this.options
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
                bin: bin.bin,
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
                bin: bin.bin,
            }
        }

        let labels: NumericLabel[] = []
        for (const bin of positionedBins) {
            if (bin.bin.text) labels.push(makeRangeLabel(bin))
            else if (bin.bin instanceof NumericBin) {
                if (bin.bin.minText)
                    labels.push(makeBoundaryLabel(bin, "min", bin.bin.minText))
                if (bin === R.last(positionedBins) && bin.bin.maxText)
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
            _.min(this.numericLabels.map((label) => label.bounds.y)) ?? 0
        )
    }

    /** Position of the legend title relative to the legend origin. */
    @computed get legendTitlePosition(): { x: number; y: number } | undefined {
        if (!this.legendTitle) return undefined
        return {
            x: this.xOffset,
            y:
                this.height -
                this.legendTitle.height +
                this.legendTitleFontSize * 0.2,
        }
    }

    /** Resolved default text color for the legend title. */
    @computed get defaultTextColor(): string {
        return (
            this.legendStyleConfig?.text?.default?.color ?? DEFAULT_TEXT_COLOR
        )
    }

    @computed private get legendStyleConfig(): LegendStyleConfig | undefined {
        return (
            this.options.numericLegendStyleConfig ??
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
        const current = styleConfig?.[state]
        return {
            fill: bin.color,
            stroke: DEFAULT_NUMERIC_BIN_STROKE,
            strokeWidth: DEFAULT_NUMERIC_BIN_STROKE_WIDTH,
            ...defaultStyle,
            ...current,
        }
    }
}
