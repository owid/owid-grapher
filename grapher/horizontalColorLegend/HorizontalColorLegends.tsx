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
    dyFromAlign,
    removeAllWhitespace,
} from "../../clientUtils/Util"
import { Bounds } from "../../clientUtils/Bounds"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "../color/ColorScaleBin"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import {
    Color,
    HorizontalAlign,
    VerticalAlign,
} from "../../clientUtils/owidTypes"
import { TextWrap } from "../text/TextWrap"

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

// TODO unify properties across categorical & numeric legend.
// This would make multiple legends per chart less convenient (only used in Map), but we shouldn't
// be using multiple anyway – instead the numeric should also handle categorical bins too.
export interface HorizontalColorLegendManager {
    fontSize?: number
    legendX?: number
    legendAlign?: HorizontalAlign
    legendTitle?: string
    categoryLegendY?: number
    numericLegendY?: number
    legendWidth?: number
    legendHeight?: number
    legendOpacity?: number
    legendTextColor?: Color
    legendTickSize?: number
    categoricalLegendData?: CategoricalBin[]
    categoricalFocusBracket?: CategoricalBin
    categoricalBinStroke?: Color
    numericLegendData?: ColorScaleBin[]
    numericFocusBracket?: ColorScaleBin
    numericBinSize?: number
    numericBinStroke?: Color
    numericBinStrokeWidth?: number
    equalSizeBins?: boolean
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
}

const DEFAULT_NUMERIC_BIN_SIZE = 10
const DEFAULT_NUMERIC_BIN_STROKE = "#333"
const DEFAULT_NUMERIC_BIN_STROKE_WIDTH = 0.3
const DEFAULT_TEXT_COLOR = "#111"
const DEFAULT_TICK_SIZE = 3

const LEGEND_ITEM_PADDING = 15
const CATEGORICAL_BIN_MIN_WIDTH = 20
const FOCUS_BORDER_COLOR = "#111"
const SPACE_BETWEEN_CATEGORICAL_BINS = 7

export abstract class HorizontalColorLegend extends React.Component<{
    manager: HorizontalColorLegendManager
}> {
    @computed protected get manager(): HorizontalColorLegendManager {
        return this.props.manager
    }

    @computed protected get legendX(): number {
        return this.manager.legendX ?? 0
    }

    @computed protected get categoryLegendY(): number {
        return this.manager.categoryLegendY ?? 0
    }

    @computed protected get numericLegendY(): number {
        return this.manager.numericLegendY ?? 0
    }

    @computed protected get legendWidth(): number {
        return this.manager.legendWidth ?? 200
    }

    @computed protected get legendHeight(): number {
        return this.manager.legendHeight ?? 200
    }

    @computed protected get legendAlign(): HorizontalAlign {
        // Assume center alignment if none specified, for backwards-compatibility
        return this.manager.legendAlign ?? HorizontalAlign.center
    }

    @computed protected get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed protected get legendTextColor(): Color {
        return this.manager.legendTextColor ?? DEFAULT_TEXT_COLOR
    }

    @computed protected get legendTickSize(): number {
        return this.manager.legendTickSize ?? DEFAULT_TICK_SIZE
    }

    abstract get height(): number
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

    @computed private get numericBinSize(): number {
        return this.props.manager.numericBinSize ?? DEFAULT_NUMERIC_BIN_SIZE
    }

    @computed private get numericBinStroke(): Color {
        return this.props.manager.numericBinStroke ?? DEFAULT_NUMERIC_BIN_STROKE
    }

    @computed private get numericBinStrokeWidth(): number {
        return (
            this.props.manager.numericBinStrokeWidth ??
            DEFAULT_NUMERIC_BIN_STROKE_WIDTH
        )
    }

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

    private getCategoricalBinWidth(label: string): number {
        const width = Bounds.forText(label, {
            fontSize: this.tickFontSize,
        }).width
        return Math.max(width, CATEGORICAL_BIN_MIN_WIDTH)
    }

    @computed get totalCategoricalWidth(): number {
        const { numericLegendData } = this
        const widths = numericLegendData.map((bin) =>
            bin instanceof CategoricalBin
                ? this.getCategoricalBinWidth(bin.text) + LEGEND_ITEM_PADDING
                : 0
        )
        return sum(widths)
    }
    @computed get availableNumericWidth(): number {
        return (
            this.legendWidth -
            this.totalCategoricalWidth -
            this.legendTitleWidth
        )
    }

    @computed get positionedBins(): PositionedBin[] {
        const {
            manager,
            rangeSize,
            availableNumericWidth,
            numericLegendData,
            numericBins,
            legendX,
        } = this

        let xOffset = legendX + this.legendTitleWidth

        return numericLegendData.map((bin) => {
            let width = this.getCategoricalBinWidth(bin.text)
            let margin = LEGEND_ITEM_PADDING
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
                bin,
            }
        })
    }

    @computed private get legendTitleFontSize(): number {
        return this.fontSize * 0.85
    }

    @computed private get legendTitle(): TextWrap | undefined {
        const { legendTitle } = this.manager
        return legendTitle
            ? new TextWrap({
                  text: legendTitle,
                  fontSize: this.legendTitleFontSize,
                  fontWeight: 700,
                  maxWidth: this.legendWidth / 3,
              })
            : undefined
    }

    @computed get legendTitleWidth(): number {
        return this.legendTitle
            ? this.legendTitle.width + LEGEND_ITEM_PADDING
            : 0
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
                    label.bounds = label.bounds.set({
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
        if (base.current) {
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
            let newFocusBracket: ColorScaleBin | undefined
            positionedBins.forEach((bin) => {
                if (mouse.x >= bin.x && mouse.x <= bin.x + bin.width)
                    newFocusBracket = bin.bin
            })

            if (newFocusBracket && manager.onLegendMouseOver)
                manager.onLegendMouseOver(newFocusBracket)
        }
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
            numericBinSize,
            positionedBins,
            height,
        } = this
        const { numericFocusBracket } = manager

        const stroke = this.numericBinStroke
        const strokeWidth = this.numericBinStrokeWidth
        const bottomY = this.numericLegendY + height

        return (
            <g ref={this.base} className="numericColorLegend">
                {numericLabels.map((label, index) => (
                    <line
                        key={index}
                        x1={label.bounds.x + label.bounds.width / 2}
                        y1={bottomY - numericBinSize}
                        x2={label.bounds.x + label.bounds.width / 2}
                        y2={bottomY + label.bounds.y + label.bounds.height}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                    />
                ))}
                {sortBy(
                    positionedBins.map((positionedBin, index) => {
                        const bin = positionedBin.bin
                        const isFocus =
                            numericFocusBracket &&
                            bin.equals(numericFocusBracket)
                        return (
                            <NumericBinRect
                                key={index}
                                x={positionedBin.x}
                                y={bottomY - numericBinSize}
                                width={positionedBin.width}
                                height={numericBinSize}
                                fill={bin.color}
                                opacity={manager.legendOpacity} // defaults to undefined which removes the prop
                                stroke={isFocus ? FOCUS_BORDER_COLOR : stroke}
                                strokeWidth={isFocus ? 2 : strokeWidth}
                                isOpenLeft={
                                    bin instanceof NumericBin
                                        ? bin.props.isOpenLeft
                                        : false
                                }
                                isOpenRight={
                                    bin instanceof NumericBin
                                        ? bin.props.isOpenRight
                                        : false
                                }
                            />
                        )
                    }),
                    (rect) => rect.props["strokeWidth"]
                )}
                {numericLabels.map((label, index) => (
                    <text
                        key={index}
                        x={label.bounds.x}
                        y={bottomY + label.bounds.y}
                        // we can't use dominant-baseline to do proper alignment since our svg-to-png library Sharp
                        // doesn't support that (https://github.com/lovell/sharp/issues/1996), so we'll have to make
                        // do with some rough positioning.
                        dy={dyFromAlign(VerticalAlign.bottom)}
                        fontSize={label.fontSize}
                        fill={this.legendTextColor}
                    >
                        {label.text}
                    </text>
                ))}
                {this.legendTitle?.render(
                    this.legendX,
                    // Align legend title baseline with bottom of color bins
                    this.numericLegendY +
                        height -
                        this.legendTitle.height +
                        this.legendTitleFontSize * 0.2,
                    { fill: this.legendTextColor }
                )}
            </g>
        )
    }
}

interface NumericBinRectProps extends React.SVGProps<SVGRectElement> {
    x: number
    y: number
    width: number
    height: number
    isOpenLeft?: boolean
    isOpenRight?: boolean
}

/** The width of the arrowhead for open-ended bins (left or right) */
const ARROW_SIZE = 5

const NumericBinRect = (props: NumericBinRectProps) => {
    const { isOpenLeft, isOpenRight, x, y, width, height, ...restProps } = props
    if (isOpenRight) {
        const a = ARROW_SIZE
        const w = width - a
        const d = removeAllWhitespace(`
            M ${x}, ${y}
            l ${w}, 0
            l ${a}, ${height / 2}
            l ${-a}, ${height / 2}
            l ${-w}, 0
            z
        `)
        return <path d={d} {...restProps} />
    } else if (isOpenLeft) {
        const a = ARROW_SIZE
        const w = width - a
        const d = removeAllWhitespace(`
            M ${x + a}, ${y}
            l ${w}, 0
            l 0, ${height}
            l ${-w}, 0
            l ${-a}, ${-height / 2}
            z
        `)
        return <path d={d} {...restProps} />
    } else {
        return <rect x={x} y={y} width={width} height={height} {...restProps} />
    }
}

@observer
export class HorizontalCategoricalColorLegend extends HorizontalColorLegend {
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.manager.categoricalLegendData ?? []
    }

    @computed private get markLines(): MarkLine[] {
        const fontSize = this.fontSize * 0.8
        const rectSize = this.fontSize * 0.75
        const rectPadding = 5
        const markPadding = 5

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
                bounds: labelBounds.set({
                    x: markX + rectSize + rectPadding,
                    y: markY + rectSize / 2,
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

    @computed get contentWidth(): number {
        return max(this.markLines.map((l) => l.totalWidth)) as number
    }

    @computed private get containerWidth(): number {
        return this.manager.legendWidth ?? this.contentWidth
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines
        const align = this.legendAlign
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

        return flatten(lines.map((l) => l.marks))
    }

    @computed get height(): number {
        return max(this.marks.map((mark) => mark.y + mark.rectSize)) ?? 0
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
                                    opacity={manager.legendOpacity} // defaults to undefined which removes the prop
                                />
                                ,
                                <text
                                    x={this.legendX + mark.label.bounds.x}
                                    y={
                                        this.categoryLegendY +
                                        mark.label.bounds.y
                                    }
                                    // we can't use dominant-baseline to do proper alignment since our svg-to-png library Sharp
                                    // doesn't support that (https://github.com/lovell/sharp/issues/1996), so we'll have to make
                                    // do with some rough positioning.
                                    dy={dyFromAlign(VerticalAlign.middle)}
                                    fontSize={mark.label.fontSize}
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
