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
    PositionedBin,
    NumericLabel,
    HorizontalNumericColorLegendOptions,
} from "./HorizontalColorLegendTypes"
import {
    DEFAULT_NUMERIC_BIN_SIZE,
    DEFAULT_TICK_SIZE,
    CATEGORICAL_BIN_MIN_WIDTH,
    MINIMUM_LABEL_DISTANCE,
} from "./HorizontalColorLegendConstants"

/**
 * Lays out a horizontal strip of color bins with tick labels above it.
 * All coordinates are relative to the legend's own origin; the render
 * component offsets them by its `x`/`y` props.
 */
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

    @computed private get align(): HorizontalAlign {
        return this.options.align ?? HorizontalAlign.center
    }

    @computed private get tickSize(): number {
        return this.options.tickSize ?? DEFAULT_TICK_SIZE
    }

    @computed private get visibleBins(): ColorScaleBin[] {
        return this.bins.filter((bin) => !bin.isHidden)
    }

    @computed private get numericBins(): NumericBin[] {
        return this.visibleBins.filter(
            (bin): bin is NumericBin => bin instanceof NumericBin
        )
    }

    @computed get binSize(): number {
        return this.options.binSize ?? DEFAULT_NUMERIC_BIN_SIZE
    }

    @computed private get tickFontSize(): number {
        return GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get itemMargin(): number {
        return Math.round(this.fontSize * 1.125)
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

    private getNumericLabelMinWidth(bin: NumericBin): number {
        if (bin.text) {
            const tickLabelWidth = this.getTickLabelWidth(bin.text)
            return tickLabelWidth + MINIMUM_LABEL_DISTANCE
        } else {
            const combinedLabelWidths = _.sum(
                [bin.minText, bin.maxText].map(
                    (text) =>
                        // because labels are center-aligned, only half the label space is required
                        this.getTickLabelWidth(text) / 2
                )
            )
            return combinedLabelWidths + MINIMUM_LABEL_DISTANCE * 2
        }
    }

    // Overstretched legends don't look good, so we calculate an _ideal_ width
    // and only grow to `maxWidth` when the labels genuinely need the room.
    @computed private get idealNumericWidth(): number {
        const binCount = this.numericBins.length
        const spaceRequirements = this.numericBins.map((bin) => ({
            labelSpace: this.getNumericLabelMinWidth(bin),
        }))
        // Make sure the legend is big enough to avoid overlapping labels (including `raisedMode`)

        // Try to keep the minimum close to the size of the "No data" bin,
        // so they look visually balanced somewhat.
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
        return Math.min(
            this.options.maxWidth,
            this.titleWidth +
                this.totalCategoricalWidth +
                this.idealNumericWidth
        )
    }

    @computed private get availableNumericWidth(): number {
        return this.width - this.totalCategoricalWidth - this.titleWidth
    }

    // The legend is usually narrower than the space it was given, so it has to
    // be shifted to sit where `align` asks.
    @computed private get xOffset(): number {
        const { width, align } = this
        const widthDiff = this.options.maxWidth - width
        if (align === HorizontalAlign.center) {
            return widthDiff / 2
        } else if (align === HorizontalAlign.right) {
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
            titleWidth,
            xOffset,
        } = this

        let runningX = xOffset + titleWidth
        let prevBin: ColorScaleBin | undefined

        return visibleBins.map((bin, index) => {
            const isFirst = index === 0
            let width: number = this.getCategoricalBinWidth(bin)
            let marginLeft: number = isFirst ? 0 : this.itemMargin

            if (bin instanceof NumericBin) {
                width = availableNumericWidth / numericBins.length

                // Don't add any margin between numeric bins
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

    @computed private get titleFontSize(): number {
        return this.fontSize * GRAPHER_FONT_SCALE_14
    }

    @computed get title(): TextWrap | undefined {
        const { title } = this.options
        return title
            ? new TextWrap({
                  text: title,
                  fontSize: this.titleFontSize,
                  fontWeight: 700,
                  maxWidth: this.options.maxWidth / 3,
                  lineHeight: 1,
              })
            : undefined
    }

    @computed private get titleWidth(): number {
        return this.title ? this.title.width + this.itemMargin : 0
    }

    @computed get numericLabels(): NumericLabel[] {
        const { binSize, positionedBins, tickFontSize } = this

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
            const y = -binSize - labelBounds.height - this.tickSize

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
            const y = -binSize - labelBounds.height - this.tickSize

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

    /** Where to draw the title, relative to the legend origin. */
    @computed get titlePosition(): { x: number; y: number } | undefined {
        if (!this.title) return undefined
        return {
            x: this.xOffset,
            y:
                // Align the title's baseline with the bottom of the colour bins
                this.height - this.title.height + this.titleFontSize * 0.2,
        }
    }
}
