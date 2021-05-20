import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import {
    getRelativeMouse,
    sortBy,
    min,
    max,
    last,
    flatten,
    sum,
} from "../../clientUtils/Util"
import { Bounds } from "../../clientUtils/Bounds"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "../color/ColorScaleBin"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { Color } from "../../clientUtils/owidTypes"

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

const FOCUS_BORDER_COLOR = "#111"

const SPACE_BETWEEN_CATEGORICAL_BINS = 7

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

export enum LegendAlign {
    left = "left",
    center = "center",
    right = "right",
}

export interface HorizontalColorLegendManager {
    fontSize?: number
    legendX?: number
    legendAlign?: LegendAlign
    categoryLegendY?: number
    numericLegendY?: number
    legendWidth?: number
    legendHeight?: number
    scale?: number
    categoricalLegendData?: CategoricalBin[]
    categoricalFocusBracket?: CategoricalBin
    categoricalBinStroke?: Color
    numericLegendData?: ColorScaleBin[]
    numericFocusBracket?: ColorScaleBin
    equalSizeBins?: boolean
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: CategoricalBin) => void
}

@observer
class HorizontalColorLegend extends React.Component<{
    manager: HorizontalColorLegendManager
}> {
    @computed get manager(): HorizontalColorLegendManager {
        return this.props.manager
    }

    @computed get legendX(): number {
        return this.manager.legendX ?? 0
    }

    @computed get categoryLegendY(): number {
        return this.manager.categoryLegendY ?? 0
    }

    @computed get numericLegendY(): number {
        return this.manager.numericLegendY ?? 0
    }

    @computed get legendWidth(): number {
        return this.manager.legendWidth ?? 200
    }

    @computed get legendHeight(): number {
        return this.manager.legendHeight ?? 200
    }

    @computed get legendAlign() {
        // Assume center alignment if none specified, for backwards-compatibility
        return this.manager.legendAlign ?? LegendAlign.center
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }
}

@observer
export class HorizontalNumericColorLegend extends HorizontalColorLegend {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get numericLegendData(): ColorScaleBin[] {
        return this.manager.numericLegendData ?? []
    }

    @computed get numericBins(): NumericBin[] {
        return this.numericLegendData.filter(
            (bin): bin is NumericBin => bin instanceof NumericBin
        )
    }
    rectHeight = 10

    @computed get tickFontSize(): number {
        return 0.75 * this.fontSize
    }

    // NumericColorLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed get minValue(): number {
        return min(this.numericBins.map((bin) => bin.min)) as number
    }
    @computed get maxValue(): number {
        return max(this.numericBins.map((bin) => bin.max)) as number
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
        const { numericLegendData } = this
        const { categoryBinWidth, categoryBinMargin } = this
        const widths = numericLegendData.map((bin) =>
            bin instanceof CategoricalBin
                ? categoryBinWidth + categoryBinMargin
                : 0
        )
        return sum(widths)
    }
    @computed get availableNumericWidth(): number {
        return this.legendWidth - this.totalCategoricalWidth
    }

    @computed get positionedBins(): PositionedBin[] {
        const {
            manager,
            rangeSize,
            categoryBinWidth,
            categoryBinMargin,
            availableNumericWidth,
            numericLegendData,
            numericBins,
        } = this
        let xOffset = 0

        return numericLegendData.map((bin) => {
            let width = categoryBinWidth
            let margin = categoryBinMargin
            if (bin instanceof NumericBin) {
                if (manager.equalSizeBins)
                    width = availableNumericWidth / numericBins.length
                else
                    width =
                        ((bin.max - bin.min) / rangeSize) *
                        availableNumericWidth
                margin = 0
            }

            const x = xOffset
            xOffset += width + margin

            return {
                x,
                width,
                margin,
                bin: bin,
            }
        })
    }

    @computed get numericLabels(): NumericLabel[] {
        const { rectHeight, positionedBins, tickFontSize } = this

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
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: text,
                fontSize: tickFontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                hidden: false,
            }
        }

        const makeRangeLabel = (bin: PositionedBin): NumericLabel => {
            const labelBounds = Bounds.forText(bin.bin.text, {
                fontSize: tickFontSize,
            })
            const x = bin.x + bin.width / 2 - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: bin.bin.text,
                fontSize: tickFontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true,
                hidden: false,
            }
        }

        let labels: NumericLabel[] = []
        for (const bin of positionedBins) {
            if (bin.bin.text) labels.push(makeRangeLabel(bin))
            else if (bin.bin instanceof NumericBin) {
                labels.push(makeBoundaryLabel(bin, "min", bin.bin.minText))
                if (bin === last(positionedBins))
                    labels.push(makeBoundaryLabel(bin, "max", bin.bin.maxText))
            }
        }

        for (let index = 0; index < labels.length; index++) {
            const l1 = labels[index]
            if (l1.hidden) continue

            for (let j = index + 1; j < labels.length; j++) {
                const l2 = labels[j]
                if (
                    l1.bounds.right + 5 >= l2.bounds.centerX ||
                    (l2.bounds.left - 5 <= l1.bounds.centerX && !l2.priority)
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
            if (l1.bounds.right + 5 >= l2.bounds.left) {
                raisedMode = true
                break
            }
        }

        if (raisedMode) {
            for (let index = 1; index < labels.length; index++) {
                const label = labels[index]
                if (index % 2 !== 0) {
                    label.bounds = label.bounds.extend({
                        y: label.bounds.y - label.bounds.height - 1,
                    })
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
        return new Bounds(
            this.legendX,
            this.numericLegendY,
            this.legendWidth,
            this.legendHeight
        )
    }

    @action.bound onMouseMove(ev: MouseEvent | TouchEvent): void {
        const { manager, base, positionedBins } = this
        const { numericFocusBracket } = manager
        const mouse = getRelativeMouse(base.current, ev)

        // We implement onMouseMove and onMouseLeave in a custom way, without attaching them to
        // specific SVG elements, in order to allow continuous transition between bins as the user
        // moves their cursor across (even if their cursor is in the empty area above the
        // legend, where the labels are).
        // We could achieve the same by rendering invisible rectangles over the areas and attaching
        // event handlers to those.

        // If outside legend bounds, trigger onMouseLeave if there is an existing bin in focus.
        if (!this.bounds.contains(mouse)) {
            if (numericFocusBracket && manager.onLegendMouseLeave)
                return manager.onLegendMouseLeave()
            return
        }

        // If inside legend bounds, trigger onMouseOver with the bin closest to the cursor.
        let newFocusBracket = null
        positionedBins.forEach((bin) => {
            if (
                mouse.x >= this.legendX + bin.x &&
                mouse.x <= this.legendX + bin.x + bin.width
            )
                newFocusBracket = bin.bin
        })

        if (newFocusBracket && manager.onLegendMouseOver)
            manager.onLegendMouseOver(newFocusBracket)
    }

    componentDidMount(): void {
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
    }

    componentWillUnmount(): void {
        document.documentElement.removeEventListener(
            "mousemove",
            this.onMouseMove
        )
        document.documentElement.removeEventListener(
            "touchmove",
            this.onMouseMove
        )
    }

    render(): JSX.Element {
        const {
            manager,
            numericLabels,
            rectHeight,
            positionedBins,
            height,
        } = this
        const { numericFocusBracket } = manager
        //Bounds.debug([this.bounds])

        const borderColor = "#333"
        const bottomY = this.numericLegendY + height

        return (
            <g ref={this.base} className="numericColorLegend">
                {numericLabels.map((label, index) => (
                    <line
                        key={index}
                        x1={
                            this.legendX +
                            label.bounds.x +
                            label.bounds.width / 2
                        }
                        y1={bottomY - rectHeight}
                        x2={
                            this.legendX +
                            label.bounds.x +
                            label.bounds.width / 2
                        }
                        y2={bottomY + label.bounds.y + label.bounds.height}
                        stroke={borderColor}
                        strokeWidth={0.3}
                    />
                ))}
                {sortBy(
                    positionedBins.map((positionedBin, index) => {
                        const isFocus =
                            numericFocusBracket &&
                            positionedBin.bin.equals(numericFocusBracket)
                        return (
                            <rect
                                key={index}
                                x={this.legendX + positionedBin.x}
                                y={bottomY - rectHeight}
                                width={positionedBin.width}
                                height={rectHeight}
                                fill={positionedBin.bin.color}
                                stroke={
                                    isFocus ? FOCUS_BORDER_COLOR : borderColor
                                }
                                strokeWidth={isFocus ? 2 : 0.3}
                            />
                        )
                    }),
                    (rect) => rect.props["strokeWidth"]
                )}
                {numericLabels.map((label, index) => (
                    <text
                        key={index}
                        x={this.legendX + label.bounds.x}
                        y={bottomY + label.bounds.y}
                        fontSize={label.fontSize}
                        dominantBaseline="hanging"
                    >
                        {label.text}
                    </text>
                ))}
            </g>
        )
    }
}

@observer
export class HorizontalCategoricalColorLegend extends HorizontalColorLegend {
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.manager.categoricalLegendData ?? []
    }

    @computed private get markLines(): MarkLine[] {
        const manager = this.manager
        const scale = manager.scale ?? 1
        const rectSize = 12 * scale
        const rectPadding = 5
        const markPadding = 5
        const fontSize = 0.8 * scale * this.fontSize

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = []
        let xOffset = 0
        let yOffset = 0
        this.categoricalLegendData.forEach((bin) => {
            const labelBounds = Bounds.forText(bin.text, { fontSize })
            const markWidth =
                rectSize + rectPadding + labelBounds.width + markPadding

            if (xOffset + markWidth > this.legendWidth && marks.length > 0) {
                lines.push({ totalWidth: xOffset - markPadding, marks: marks })
                marks = []
                xOffset = 0
                yOffset += rectSize + rectPadding
            }

            const markX = xOffset
            const markY = yOffset

            const label = {
                text: bin.text,
                bounds: labelBounds.extend({
                    x: markX + rectSize + rectPadding,
                    y: markY + 1,
                }),
                fontSize,
            }

            marks.push({
                x: markX,
                y: markY,
                rectSize,
                label,
                bin,
            })

            xOffset += markWidth + SPACE_BETWEEN_CATEGORICAL_BINS
        })

        if (marks.length > 0)
            lines.push({ totalWidth: xOffset - markPadding, marks: marks })

        return lines
    }

    @computed get width(): number {
        return max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines
        const align = this.legendAlign

        // Center each line
        lines.forEach((line) => {
            const xShift =
                align === LegendAlign.center
                    ? (this.width - line.totalWidth) / 2
                    : align === LegendAlign.right
                    ? this.width - line.totalWidth
                    : 0
            line.marks.forEach((mark) => {
                mark.x += xShift
                mark.label.bounds = mark.label.bounds.extend({
                    x: mark.label.bounds.x + xShift,
                })
            })
        })

        return flatten(lines.map((l) => l.marks))
    }

    @computed get height(): number {
        return max(this.marks.map((mark) => mark.y + mark.rectSize)) as number
    }

    render(): JSX.Element {
        const { manager, marks } = this

        return (
            <g>
                <g className="categoricalColorLegend">
                    {marks.map((mark, index) => {
                        return (
                            <g
                                key={index}
                                onMouseOver={(): void =>
                                    manager.onLegendMouseOver
                                        ? manager.onLegendMouseOver(mark.bin)
                                        : undefined
                                }
                                onMouseLeave={(): void =>
                                    manager.onLegendMouseLeave
                                        ? manager.onLegendMouseLeave()
                                        : undefined
                                }
                            >
                                <rect
                                    x={this.legendX + mark.x}
                                    y={this.categoryLegendY + mark.y}
                                    width={mark.rectSize}
                                    height={mark.rectSize}
                                    fill={mark.bin.color}
                                    stroke={manager.categoricalBinStroke}
                                    strokeWidth={0.4}
                                />
                                ,
                                <text
                                    x={this.legendX + mark.label.bounds.x}
                                    y={
                                        this.categoryLegendY +
                                        mark.label.bounds.y
                                    }
                                    fontSize={mark.label.fontSize}
                                    dominantBaseline="hanging"
                                >
                                    {mark.label.text}
                                </text>
                            </g>
                        )
                    })}
                </g>
            </g>
        )
    }
}
