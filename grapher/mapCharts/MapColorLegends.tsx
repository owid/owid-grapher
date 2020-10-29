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
} from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "grapher/color/ColorScaleBin"
import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

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

export interface MapLegendManager {
    fontSize?: number
    legendX?: number
    legendY?: number
    legendWidth?: number
    legendHeight?: number
    scale?: number
    categoricalLegendData: CategoricalBin[]
    categoricalFocusBracket?: CategoricalBin
    numericLegendData?: ColorScaleBin[]
    numericFocusBracket?: ColorScaleBin
    equalSizeBins?: boolean
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: CategoricalBin) => void
}

@observer
class MapLegend extends React.Component<{
    manager: MapLegendManager
}> {
    @computed get manager() {
        return this.props.manager
    }

    @computed get legendX() {
        return this.manager.legendX ?? 0
    }

    @computed get legendY() {
        return this.manager.legendY ?? 0
    }

    @computed get legendWidth() {
        return this.manager.legendWidth ?? 200
    }

    @computed get legendHeight() {
        return this.manager.legendHeight ?? 200
    }

    @computed get fontSize() {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }
}

@observer
export class MapNumericColorLegend extends MapLegend {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get numericLegendData() {
        return this.manager.numericLegendData ?? []
    }

    @computed get numericBins() {
        return this.numericLegendData.filter(
            (bin) => bin instanceof NumericBin
        ) as NumericBin[]
    }
    rectHeight = 10

    @computed get tickFontSize() {
        return 0.75 * this.fontSize
    }

    // NumericColorLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed get minValue() {
        return min(this.numericBins.map((d) => d.min)) as number
    }
    @computed get maxValue() {
        return max(this.numericBins.map((d) => d.max)) as number
    }
    @computed get rangeSize() {
        return this.maxValue - this.minValue
    }
    @computed get categoryBinWidth() {
        return Bounds.forText("No data", { fontSize: this.tickFontSize }).width
    }
    @computed get categoryBinMargin() {
        return this.rectHeight * 1.5
    }
    @computed get totalCategoricalWidth() {
        const { numericLegendData } = this
        const { categoryBinWidth, categoryBinMargin } = this
        const widths = numericLegendData.map((bin) =>
            bin instanceof CategoricalBin
                ? categoryBinWidth + categoryBinMargin
                : 0
        )
        return sum(widths)
    }
    @computed get availableNumericWidth() {
        return this.legendWidth - this.totalCategoricalWidth
    }

    @computed get positionedBins() {
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
            } as PositionedBin
        })
    }

    @computed get numericLabels() {
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
                hidden: false,
            }
        }

        const makeRangeLabel = (d: PositionedBin) => {
            const labelBounds = Bounds.forText(d.bin.text, {
                fontSize: tickFontSize,
            })
            const x = d.x + d.width / 2 - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: d.bin.text,
                fontSize: tickFontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true,
                hidden: false,
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

        labels = labels.filter((l) => !l.hidden)

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
                        y: l.bounds.y - l.bounds.height - 1,
                    })
                }
            }
        }

        return labels
    }

    @computed get height() {
        return Math.abs(min(this.numericLabels.map((l) => l.bounds.y)) ?? 0)
    }

    @computed get bounds() {
        return new Bounds(
            this.legendX,
            this.legendY,
            this.legendWidth,
            this.legendHeight
        )
    }

    @action.bound onMouseMove(ev: MouseEvent | TouchEvent) {
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
        positionedBins.forEach((d) => {
            if (
                mouse.x >= this.legendX + d.x &&
                mouse.x <= this.legendX + d.x + d.width
            )
                newFocusBracket = d.bin
        })

        if (newFocusBracket && manager.onLegendMouseOver)
            manager.onLegendMouseOver(newFocusBracket)
    }

    componentDidMount() {
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
    }

    componentWillUnmount() {
        document.documentElement.removeEventListener(
            "mousemove",
            this.onMouseMove
        )
        document.documentElement.removeEventListener(
            "touchmove",
            this.onMouseMove
        )
    }

    render() {
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
        const bottomY = this.legendY + height

        return (
            <g ref={this.base} className="numericColorLegend">
                {numericLabels.map((label, i) => (
                    <line
                        key={i}
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
                    positionedBins.map((positionedBin, i) => {
                        const isFocus =
                            numericFocusBracket &&
                            positionedBin.bin.equals(numericFocusBracket)
                        return (
                            <rect
                                key={i}
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
                    (r) => r.props["strokeWidth"]
                )}
                {numericLabels.map((label, i) => (
                    <text
                        key={i}
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
export class MapCategoricalColorLegend extends MapLegend {
    @computed get categoricalLegendData() {
        return this.manager.categoricalLegendData ?? []
    }

    @computed private get markLines() {
        const manager = this.manager
        const scale = manager.scale ?? 1
        const rectSize = 12 * scale
        const rectPadding = 5
        const markPadding = 5
        const fontSize = 0.7 * scale * this.fontSize

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = []
        let xOffset = 0
        let yOffset = 0
        this.categoricalLegendData.forEach((bin) => {
            const labelBounds = Bounds.forText(bin.text, { fontSize })
            const markWidth =
                rectSize + rectPadding + labelBounds.width + markPadding

            if (xOffset + markWidth > this.legendWidth) {
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

            xOffset += markWidth
        })

        if (marks.length > 0)
            lines.push({ totalWidth: xOffset - markPadding, marks: marks })

        return lines
    }

    @computed get width() {
        return max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed get marks() {
        const lines = this.markLines

        // Center each line
        lines.forEach((line) => {
            const xShift = this.width / 2 - line.totalWidth / 2
            line.marks.forEach((m) => {
                m.x += xShift
                m.label.bounds = m.label.bounds.extend({
                    x: m.label.bounds.x + xShift,
                })
            })
        })

        return flatten(lines.map((l) => l.marks))
    }

    @computed get height() {
        return max(this.marks.map((m) => m.y + m.rectSize)) as number
    }

    render() {
        const { manager, marks } = this
        const { categoricalFocusBracket } = manager

        return (
            <g className="mapLegend">
                <g className="categoricalColorLegend">
                    {marks.map((mark, i) => {
                        const isFocus =
                            categoricalFocusBracket &&
                            mark.bin.value === categoricalFocusBracket.value
                        const stroke = isFocus ? FOCUS_BORDER_COLOR : "#333"
                        return (
                            <g
                                key={i}
                                onMouseOver={() =>
                                    manager.onLegendMouseOver
                                        ? manager.onLegendMouseOver(mark.bin)
                                        : undefined
                                }
                                onMouseLeave={() =>
                                    manager.onLegendMouseLeave
                                        ? manager.onLegendMouseLeave()
                                        : undefined
                                }
                            >
                                <rect
                                    x={this.legendX + mark.x}
                                    y={this.legendY + mark.y}
                                    width={mark.rectSize}
                                    height={mark.rectSize}
                                    fill={mark.bin.color}
                                    stroke={stroke}
                                    strokeWidth={0.4}
                                />
                                ,
                                <text
                                    x={this.legendX + mark.label.bounds.x}
                                    y={this.legendY + mark.label.bounds.y}
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
