import * as _ from "lodash-es"
import { computed } from "mobx"
import { Bounds, HorizontalAlign } from "@ourworldindata/utils"
import { CategoricalBin, isNoDataBin } from "../color/ColorScaleBin"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { scaleFontSize } from "../chart/ChartUtils"
import {
    HorizontalOrdinalColorLegendOptions,
    OrdinalLabel,
    PositionedBin,
} from "./HorizontalColorLegendTypes"
import {
    CATEGORICAL_BIN_MIN_WIDTH,
    DEFAULT_BIN_HEIGHT,
    MINIMUM_BIN_LABEL_DISTANCE,
    BIN_MAX_WIDTH_EM,
    BIN_MIN_WIDTH_EM,
    BIN_LABEL_PADDING,
} from "./HorizontalColorLegendConstants"
import {
    findMaxLabelHeight,
    layOutOrdinalLabels,
    PlacedBinLabel,
} from "./OrdinalLabelLayout"

export class HorizontalOrdinalColorLegendState {
    private readonly bins: CategoricalBin[]
    private readonly options: HorizontalOrdinalColorLegendOptions

    constructor(
        bins: CategoricalBin[],
        options: HorizontalOrdinalColorLegendOptions
    ) {
        this.bins = bins
        this.options = options
    }

    @computed private get baseFontSize(): number {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get align(): HorizontalAlign {
        return this.options.align ?? HorizontalAlign.center
    }

    @computed private get labelFontSize(): number {
        return scaleFontSize(12, this.baseFontSize)
    }

    @computed private get noDataGap(): number {
        return Math.max(
            Math.round(this.baseFontSize * 1.125),
            MINIMUM_BIN_LABEL_DISTANCE
        )
    }

    @computed get binHeight(): number {
        return this.options.binHeight ?? DEFAULT_BIN_HEIGHT
    }

    @computed private get visibleBins(): CategoricalBin[] {
        return this.bins.filter((bin) => !bin.isHidden)
    }

    @computed private get noDataBin(): CategoricalBin | undefined {
        return this.visibleBins.find(isNoDataBin)
    }

    @computed private get visibleCategoryBins(): CategoricalBin[] {
        return this.visibleBins.filter((bin) => !isNoDataBin(bin))
    }

    @computed private get maxBinWidth(): number {
        return this.baseFontSize * BIN_MAX_WIDTH_EM
    }

    private getLabelWidth(text: string): number {
        return Bounds.forText(text, { fontSize: this.labelFontSize }).width
    }

    @computed private get noDataBinWidth(): number {
        if (!this.noDataBin) return 0
        const availableWidth = this.options.maxWidth - this.noDataGap
        const sharedWidth = availableWidth / this.visibleBins.length
        const preferredWidth = Math.max(
            this.getLabelWidth(this.noDataBin.text),
            CATEGORICAL_BIN_MIN_WIDTH
        )
        return Math.min(sharedWidth, this.maxBinWidth, preferredWidth)
    }

    @computed private get noDataWidth(): number {
        return this.noDataBin ? this.noDataBinWidth + this.noDataGap : 0
    }

    @computed private get categoryBinWidth(): number {
        const count = this.visibleCategoryBins.length
        if (count === 0) return 0
        const availableWidth = this.options.maxWidth - this.noDataWidth
        const sharedWidth = availableWidth / count
        const widestLabelWidth =
            _.max(
                this.visibleCategoryBins.map((bin) =>
                    this.getLabelWidth(bin.text)
                )
            ) ?? 0
        const preferredWidth = Math.max(
            widestLabelWidth + MINIMUM_BIN_LABEL_DISTANCE,
            this.baseFontSize * BIN_MIN_WIDTH_EM
        )
        return Math.min(sharedWidth, this.maxBinWidth, preferredWidth)
    }

    @computed get width(): number {
        return (
            this.noDataWidth +
            this.visibleCategoryBins.length * this.categoryBinWidth
        )
    }

    @computed private get xOffset(): number {
        const widthDiff = this.options.maxWidth - this.width
        if (this.align === HorizontalAlign.center) return widthDiff / 2
        if (this.align === HorizontalAlign.right) return widthDiff
        return 0
    }

    @computed get positionedBins(): PositionedBin<CategoricalBin>[] {
        const { noDataBin, xOffset, categoryBinWidth } = this
        const categoryStartX = xOffset + this.noDataWidth
        const categoryBins = this.visibleCategoryBins.map((bin, index) => ({
            x: categoryStartX + index * categoryBinWidth,
            width: categoryBinWidth,
            bin,
        }))
        if (!noDataBin) return categoryBins
        const noDataPositioned = {
            x: xOffset,
            width: this.noDataBinWidth,
            bin: noDataBin,
        }
        return [noDataPositioned, ...categoryBins]
    }

    @computed private get placedLabels(): PlacedBinLabel[] {
        return layOutOrdinalLabels({
            bins: this.positionedBins,
            maxWidth: this.options.maxWidth,
            fontSize: this.labelFontSize,
        })
    }

    @computed private get labelHeightAbove(): number {
        return findMaxLabelHeight(this.placedLabels, "above")
    }

    @computed private get labelHeightBelow(): number {
        return findMaxLabelHeight(this.placedLabels, "below")
    }

    @computed get binY(): number {
        return this.labelHeightAbove + BIN_LABEL_PADDING
    }

    @computed get labels(): OrdinalLabel[] {
        const {
            placedLabels,
            labelHeightAbove,
            positionedBins,
            binY,
            binHeight,
        } = this
        const belowY = binY + binHeight + BIN_LABEL_PADDING
        return placedLabels.map((placed, index) => ({
            bin: positionedBins[index].bin,
            side: placed.side,
            textWrap: placed.textWrap,
            left: placed.left,
            top:
                placed.side === "above"
                    ? labelHeightAbove - placed.textWrap.height
                    : belowY,
        }))
    }

    @computed get height(): number {
        if (this.visibleBins.length === 0) return 0
        const { labelHeightBelow } = this
        return (
            this.binY +
            this.binHeight +
            (labelHeightBelow > 0 ? BIN_LABEL_PADDING + labelHeightBelow : 0)
        )
    }
}
