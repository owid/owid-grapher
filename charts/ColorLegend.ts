import { computed } from "mobx"

import { min, max, map, each, last, flatten, some, find, sum } from "./Util"
import { Bounds } from "./Bounds"
import { TextWrap } from "./TextWrap"
import { ColorScaleBin, NumericBin, CategoricalBin } from "./ColorScaleBin"

interface PositionedBin {
    x: number
    width: number
    margin: number
    bin: ColorScaleBin
}

interface NumericLabel {
    text: string
    fontSize: number
    bounds: Bounds
    priority?: boolean
    hidden: boolean
}

export interface NumericColorLegendProps {
    width: number
    fontSize: number
    legendData: ColorScaleBin[]
    focusBracket?: ColorScaleBin
    equalSizeBins?: true
}

export class NumericColorLegend {
    props: NumericColorLegendProps
    constructor(props: NumericColorLegendProps) {
        this.props = props
    }

    @computed get focusBracket() {
        return this.props.focusBracket
    }
    @computed get numericBins(): NumericBin[] {
        return this.props.legendData.filter(
            l => l instanceof NumericBin
        ) as NumericBin[]
    }
    @computed get rectHeight(): number {
        return 10
    }
    @computed get tickFontSize(): number {
        return 0.75 * this.props.fontSize
    }

    // NumericColorLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed get minValue(): number {
        return min(this.numericBins.map(d => d.min)) as number
    }
    @computed get maxValue(): number {
        return max(this.numericBins.map(d => d.max)) as number
    }
    @computed get rangeSize(): number {
        return this.maxValue - this.minValue
    }
    @computed get categoryBinWidth(): number {
        return Bounds.forText("No data", { fontSize: this.tickFontSize }).width
    }
    @computed get categoryBinMargin(): number {
        return this.rectHeight * 1.5
    }
    @computed get totalCategoricalWidth(): number {
        const { legendData } = this.props
        const { categoryBinWidth, categoryBinMargin } = this
        const widths = legendData.map(d =>
            d instanceof CategoricalBin
                ? categoryBinWidth + categoryBinMargin
                : 0
        )
        return sum(widths)
    }
    @computed get availableNumericWidth(): number {
        return this.props.width - this.totalCategoricalWidth
    }

    @computed get positionedBins(): PositionedBin[] {
        const {
            props,
            rangeSize,
            categoryBinWidth,
            categoryBinMargin,
            availableNumericWidth,
            numericBins
        } = this
        let xOffset = 0

        return props.legendData.map(d => {
            let width = categoryBinWidth,
                margin = categoryBinMargin
            if (d instanceof NumericBin) {
                if (props.equalSizeBins)
                    width = availableNumericWidth / numericBins.length
                else
                    width =
                        ((d.max - d.min) / rangeSize) * availableNumericWidth
                margin = 0
            }

            const x = xOffset
            xOffset += width + margin

            return {
                x: x,
                width: width,
                margin: margin,
                bin: d
            }
        })
    }

    @computed get numericLabels(): NumericLabel[] {
        const { rectHeight, positionedBins, tickFontSize } = this

        const makeBoundaryLabel = (
            d: PositionedBin,
            minOrMax: "min" | "max",
            text: string
        ) => {
            const labelBounds = Bounds.forText(text, { fontSize: tickFontSize })
            const x =
                d.x + (minOrMax === "min" ? 0 : d.width) - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: text,
                fontSize: tickFontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                hidden: false
            }
        }

        const makeRangeLabel = (d: PositionedBin) => {
            const labelBounds = Bounds.forText(d.bin.text, {
                fontSize: tickFontSize
            })
            const x = d.x + d.width / 2 - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: d.bin.text,
                fontSize: tickFontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true,
                hidden: false
            }
        }

        let labels: NumericLabel[] = []
        for (const d of positionedBins) {
            if (d.bin.text) labels.push(makeRangeLabel(d))
            else if (d.bin instanceof NumericBin) {
                labels.push(makeBoundaryLabel(d, "min", d.bin.minText))
                if (d === last(positionedBins))
                    labels.push(makeBoundaryLabel(d, "max", d.bin.maxText))
            }
        }

        for (let i = 0; i < labels.length; i++) {
            const l1 = labels[i]
            if (l1.hidden) continue

            for (let j = i + 1; j < labels.length; j++) {
                const l2 = labels[j]
                if (
                    l1.bounds.right + 5 >= l2.bounds.centerX ||
                    (l2.bounds.left - 5 <= l1.bounds.centerX && !l2.priority)
                )
                    l2.hidden = true
            }
        }

        labels = labels.filter(l => !l.hidden)

        // If labels overlap, first we try alternating raised labels
        let raisedMode = false
        for (let i = 1; i < labels.length; i++) {
            const l1 = labels[i - 1],
                l2 = labels[i]
            if (l1.bounds.right + 5 >= l2.bounds.left) {
                raisedMode = true
                break
            }
        }

        if (raisedMode) {
            for (let i = 1; i < labels.length; i++) {
                const l = labels[i]
                if (i % 2 !== 0) {
                    l.bounds = l.bounds.extend({
                        y: l.bounds.y - l.bounds.height - 1
                    })
                }
            }
        }

        return labels
    }

    @computed get height(): number {
        return Math.abs(min(this.numericLabels.map(l => l.bounds.y)) ?? 0)
    }

    @computed get width(): number {
        return this.props.width
    }
}

interface CategoricalMark {
    x: number
    y: number
    rectSize: number
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

export interface CategoricalColorLegendProps {
    maxWidth: number
    scale: number
    legendData: CategoricalBin[]
    focusBracket?: CategoricalBin
    fontSize: number
}

export class CategoricalColorLegend {
    props: CategoricalColorLegendProps
    constructor(props: CategoricalColorLegendProps) {
        this.props = props
    }

    @computed get markLines(): MarkLine[] {
        const props = this.props,
            rectSize = 12 * props.scale,
            rectPadding = 5,
            markPadding = 5,
            fontSize = 0.7 * props.scale * this.props.fontSize

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = [],
            xOffset = 0,
            yOffset = 0
        each(props.legendData, d => {
            const labelBounds = Bounds.forText(d.text, { fontSize: fontSize })
            const markWidth =
                rectSize + rectPadding + labelBounds.width + markPadding

            if (xOffset + markWidth > props.maxWidth) {
                lines.push({ totalWidth: xOffset - markPadding, marks: marks })
                marks = []
                xOffset = 0
                yOffset += rectSize + rectPadding
            }

            const markX = xOffset,
                markY = yOffset

            const label = {
                text: d.text,
                bounds: labelBounds.extend({
                    x: markX + rectSize + rectPadding,
                    y: markY + 1
                }),
                fontSize: fontSize
            }

            marks.push({
                x: markX,
                y: markY,
                rectSize: rectSize,
                label: label,
                bin: d
            })

            xOffset += markWidth
        })

        if (marks.length > 0) {
            lines.push({ totalWidth: xOffset - markPadding, marks: marks })
        }

        return lines
    }

    @computed get width(): number {
        return max(this.markLines.map(l => l.totalWidth)) as number
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines

        // Center each line
        each(lines, line => {
            const xShift = this.width / 2 - line.totalWidth / 2
            each(line.marks, m => {
                m.x += xShift
                m.label.bounds = m.label.bounds.extend({
                    x: m.label.bounds.x + xShift
                })
            })
        })

        return flatten(map(lines, l => l.marks))
    }

    @computed get height(): number {
        return max(this.marks.map(m => m.y + m.rectSize)) as number
    }
}

export interface ColorLegendProps {
    fontSize: number
    legendData: ColorScaleBin[]
    title: string
    bounds: Bounds
    focusValue?: number | string
    focusBracket?: ColorScaleBin
    equalSizeBins?: true
}

export class ColorLegend {
    props: ColorLegendProps
    constructor(props: ColorLegendProps) {
        this.props = props
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        if (
            this.hasCategorical ||
            !some(
                this.props.legendData,
                d => (d as CategoricalBin).value === "No data" && !d.isHidden
            )
        ) {
            return this.props.legendData.filter(
                l => l instanceof NumericBin && !l.isHidden
            )
        } else {
            const bin = this.props.legendData.filter(
                l =>
                    (l instanceof NumericBin || l.value === "No data") &&
                    !l.isHidden
            )
            return flatten([bin[bin.length - 1], bin.slice(0, -1)])
        }
    }
    @computed get hasNumeric(): boolean {
        return this.numericLegendData.length > 1
    }
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.props.legendData.filter(
            l => l instanceof CategoricalBin && !l.isHidden
        ) as CategoricalBin[]
    }
    @computed get hasCategorical(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get mainLabel(): TextWrap {
        return new TextWrap({
            maxWidth: this.props.bounds.width,
            fontSize: 0.7 * this.props.fontSize,
            text: this.props.title
        })
    }

    @computed get numericFocusBracket(): ColorScaleBin | undefined {
        const { focusBracket, focusValue } = this.props
        const { numericLegendData } = this

        if (focusBracket) return focusBracket
        else if (focusValue)
            return find(numericLegendData, bin => bin.contains(focusValue))
        else return undefined
    }

    @computed get categoricalFocusBracket(): CategoricalBin | undefined {
        const { focusBracket, focusValue } = this.props
        const { categoricalLegendData } = this
        if (focusBracket && focusBracket instanceof CategoricalBin)
            return focusBracket
        else if (focusValue)
            return find(categoricalLegendData, bin => bin.contains(focusValue))
        else return undefined
    }

    @computed get categoryLegend(): CategoricalColorLegend | undefined {
        const that = this
        return this.hasCategorical
            ? new CategoricalColorLegend({
                  get legendData() {
                      return that.categoricalLegendData
                  },
                  get maxWidth() {
                      return that.props.bounds.width * 0.8
                  },
                  get scale() {
                      return 1
                  },
                  get fontSize() {
                      return that.props.fontSize
                  }
              })
            : undefined
    }

    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height + 5 : 0
    }

    @computed get numericLegend(): NumericColorLegend | undefined {
        const that = this
        return this.hasNumeric
            ? new NumericColorLegend({
                  get legendData() {
                      return that.numericLegendData
                  },
                  get width() {
                      return that.props.bounds.width * 0.8
                  },
                  get equalSizeBins() {
                      return that.props.equalSizeBins
                  },
                  get focusBracket() {
                      return that.numericFocusBracket
                  },
                  get fontSize() {
                      return that.props.fontSize
                  }
              })
            : undefined
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get height(): number {
        return (
            this.mainLabel.height +
            this.categoryLegendHeight +
            this.numericLegendHeight +
            10
        )
    }

    @computed get bounds() {
        return this.props.bounds
    }
}
