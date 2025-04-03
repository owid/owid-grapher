import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import {
    getRelativeMouse,
    sortBy,
    min,
    max,
    last,
    sum,
    dyFromAlign,
    removeAllWhitespace,
    Bounds,
    Color,
    HorizontalAlign,
    VerticalAlign,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import {
    ColorScaleBin,
    NumericBin,
    CategoricalBin,
} from "../color/ColorScaleBin"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_12_8,
    GRAPHER_FONT_SCALE_14,
    GRAPHER_OPACITY_MUTE,
} from "../core/GrapherConstants"
import { darkenColorForLine } from "../color/ColorUtils"
import { OWID_NON_FOCUSED_GRAY } from "../color/ColorConstants"

export interface PositionedBin {
    x: number
    width: number
    bin: ColorScaleBin
}

interface NumericLabel {
    text: string
    fontSize: number
    bounds: Bounds
    priority?: boolean
    hidden: boolean
    raised: boolean
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
    legendMaxWidth?: number
    legendHeight?: number
    legendOpacity?: number
    legendTextColor?: Color
    legendTickSize?: number
    categoricalLegendData?: CategoricalBin[]
    categoricalHoverBracket?: CategoricalBin
    categoricalBinStroke?: Color
    numericLegendData?: ColorScaleBin[]
    numericHoverBracket?: ColorScaleBin
    numericBinSize?: number
    numericBinStroke?: Color
    numericBinStrokeWidth?: number
    equalSizeBins?: boolean
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
    onLegendClick?: (d: ColorScaleBin) => void
    activeColors?: string[] // inactive colors are grayed out
    focusColors?: string[] // focused colors are bolded
    hoverColors?: string[] // non-hovered colors are muted
    isStatic?: boolean
}

const DEFAULT_NUMERIC_BIN_SIZE = 10
const DEFAULT_NUMERIC_BIN_STROKE = "#333"
const DEFAULT_NUMERIC_BIN_STROKE_WIDTH = 0.3
const DEFAULT_TEXT_COLOR = "#111"
const DEFAULT_TICK_SIZE = 3

const CATEGORICAL_BIN_MIN_WIDTH = 20
const FOCUS_BORDER_COLOR = "#111"
const SPACE_BETWEEN_CATEGORICAL_BINS = 7
const MINIMUM_LABEL_DISTANCE = 5

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

    @computed protected get legendMaxWidth(): number | undefined {
        return this.manager.legendMaxWidth
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
    abstract get width(): number
}

@observer
export class HorizontalNumericColorLegend extends HorizontalColorLegend {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get numericLegendData(): ColorScaleBin[] {
        return this.manager.numericLegendData ?? []
    }

    @computed private get visibleBins(): ColorScaleBin[] {
        return this.numericLegendData.filter((bin) => !bin.isHidden)
    }

    @computed private get numericBins(): NumericBin[] {
        return this.visibleBins.filter(
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
        return this.manager.legendMaxWidth ?? this.manager.legendWidth ?? 200
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
            this.manager.legendWidth === undefined &&
            this.manager.legendMaxWidth !== undefined
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
        if (this.manager.equalSizeBins) {
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
    @computed private get x(): number {
        const { width, maxWidth, legendAlign, legendX } = this
        const widthDiff = maxWidth - width
        if (legendAlign === HorizontalAlign.center) {
            return legendX + widthDiff / 2
        } else if (legendAlign === HorizontalAlign.right) {
            return legendX + widthDiff
        } else {
            return legendX // left align
        }
    }

    @computed private get positionedBins(): PositionedBin[] {
        const {
            manager,
            rangeSize,
            availableNumericWidth,
            visibleBins,
            numericBins,
            legendTitleWidth,
            x,
        } = this

        let xOffset = x + legendTitleWidth
        let prevBin: ColorScaleBin | undefined

        return visibleBins.map((bin, index) => {
            const isFirst = index === 0
            let width: number = this.getCategoricalBinWidth(bin)
            let marginLeft: number = isFirst ? 0 : this.itemMargin

            if (bin instanceof NumericBin) {
                if (manager.equalSizeBins) {
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

    @computed private get legendTitleFontSize(): number {
        return this.fontSize * GRAPHER_FONT_SCALE_14
    }

    @computed private get legendTitle(): TextWrap | undefined {
        const { legendTitle } = this.manager
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

    @computed private get numericLabels(): NumericLabel[] {
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

    @computed private get bounds(): Bounds {
        return new Bounds(this.x, this.numericLegendY, this.width, this.height)
    }

    @action.bound private onMouseMove(ev: MouseEvent | TouchEvent): void {
        const { manager, base, positionedBins } = this
        const { numericHoverBracket } = manager
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
                if (numericHoverBracket && manager.onLegendMouseLeave)
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

    render(): React.ReactElement {
        const {
            manager,
            numericLabels,
            numericBinSize,
            positionedBins,
            height,
        } = this
        const { numericHoverBracket } = manager

        const stroke = this.numericBinStroke
        const strokeWidth = this.numericBinStrokeWidth
        const bottomY = this.numericLegendY + height

        return (
            <g
                ref={this.base}
                id={makeIdForHumanConsumption("numeric-color-legend")}
                className="numericColorLegend"
            >
                <g id={makeIdForHumanConsumption("lines")}>
                    {numericLabels.map((label, index) => (
                        <line
                            key={index}
                            id={makeIdForHumanConsumption(label.text)}
                            x1={label.bounds.x + label.bounds.width / 2}
                            y1={bottomY - numericBinSize}
                            x2={label.bounds.x + label.bounds.width / 2}
                            y2={bottomY + label.bounds.y + label.bounds.height}
                            // if we use a light color for stroke (e.g. white), we want it to stay
                            // "invisible", except for raised labels, where we want *some* contrast.
                            stroke={
                                label.raised
                                    ? darkenColorForLine(stroke)
                                    : stroke
                            }
                            strokeWidth={strokeWidth}
                        />
                    ))}
                </g>
                <g id={makeIdForHumanConsumption("swatches")}>
                    {sortBy(
                        positionedBins.map((positionedBin, index) => {
                            const bin = positionedBin.bin
                            const isFocus =
                                numericHoverBracket &&
                                bin.equals(numericHoverBracket)
                            return (
                                <NumericBinRect
                                    key={index}
                                    x={positionedBin.x}
                                    y={bottomY - numericBinSize}
                                    width={positionedBin.width}
                                    height={numericBinSize}
                                    fill={
                                        bin.patternRef
                                            ? `url(#${bin.patternRef})`
                                            : bin.color
                                    }
                                    opacity={manager.legendOpacity} // defaults to undefined which removes the prop
                                    stroke={
                                        isFocus ? FOCUS_BORDER_COLOR : stroke
                                    }
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
                </g>
                <g id={makeIdForHumanConsumption("labels")}>
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
                </g>
                {this.legendTitle?.renderSVG(
                    this.x,
                    // Align legend title baseline with bottom of color bins
                    this.numericLegendY +
                        height -
                        this.legendTitle.height +
                        this.legendTitleFontSize * 0.2,
                    { textProps: { fill: this.legendTextColor } }
                )}
            </g>
        )
    }
}

interface NumericBinRectProps extends React.SVGAttributes<SVGElement> {
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
    private rectPadding = 5
    private markPadding = 5

    @computed get width(): number {
        return this.manager.legendWidth ?? this.manager.legendMaxWidth ?? 200
    }

    @computed private get categoricalLegendData(): CategoricalBin[] {
        return this.manager.categoricalLegendData ?? []
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

    @computed private get marks(): CategoricalMark[] {
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

        return lines.flatMap((l) => l.marks)
    }

    @computed get height(): number {
        return max(this.marks.map((mark) => mark.y + mark.rectSize)) ?? 0
    }

    renderLabels(): React.ReactElement {
        const { manager, marks } = this
        const { focusColors, hoverColors = [] } = manager

        return (
            <g id={makeIdForHumanConsumption("labels")}>
                {marks.map((mark, index) => {
                    const isFocus = focusColors?.includes(mark.bin.color)
                    const isNotHovered =
                        hoverColors.length > 0 &&
                        !hoverColors.includes(mark.bin.color)

                    return (
                        <text
                            key={`${mark.label}-${index}`}
                            x={this.legendX + mark.label.bounds.x}
                            y={this.categoryLegendY + mark.label.bounds.y}
                            // we can't use dominant-baseline to do proper alignment since our svg-to-png library Sharp
                            // doesn't support that (https://github.com/lovell/sharp/issues/1996), so we'll have to make
                            // do with some rough positioning.
                            dy={dyFromAlign(VerticalAlign.middle)}
                            fontSize={mark.label.fontSize}
                            fontWeight={isFocus ? "bold" : undefined}
                            opacity={isNotHovered ? GRAPHER_OPACITY_MUTE : 1}
                        >
                            {mark.label.text}
                        </text>
                    )
                })}
            </g>
        )
    }

    renderSwatches(): React.ReactElement {
        const { manager, marks } = this
        const { activeColors, hoverColors = [] } = manager

        return (
            <g id={makeIdForHumanConsumption("swatches")}>
                {marks.map((mark, index) => {
                    const isActive = activeColors?.includes(mark.bin.color)
                    const isHovered = hoverColors.includes(mark.bin.color)
                    const isNotHovered =
                        hoverColors.length > 0 &&
                        !hoverColors.includes(mark.bin.color)

                    const color = mark.bin.patternRef
                        ? `url(#${mark.bin.patternRef})`
                        : mark.bin.color

                    const fill =
                        isHovered || isActive || activeColors === undefined
                            ? color
                            : OWID_NON_FOCUSED_GRAY

                    const opacity = isNotHovered
                        ? GRAPHER_OPACITY_MUTE
                        : manager.legendOpacity

                    return (
                        <rect
                            id={makeIdForHumanConsumption(mark.label.text)}
                            key={`${mark.label}-${index}`}
                            x={this.legendX + mark.x}
                            y={this.categoryLegendY + mark.y}
                            width={mark.rectSize}
                            height={mark.rectSize}
                            fill={fill}
                            stroke={manager.categoricalBinStroke}
                            strokeWidth={0.4}
                            opacity={opacity}
                        />
                    )
                })}
            </g>
        )
    }

    renderInteractiveElements(): React.ReactElement {
        const { manager, marks } = this

        return (
            <g>
                {marks.map((mark, index) => {
                    const mouseOver = (): void =>
                        manager.onLegendMouseOver
                            ? manager.onLegendMouseOver(mark.bin)
                            : undefined
                    const mouseLeave = (): void =>
                        manager.onLegendMouseLeave
                            ? manager.onLegendMouseLeave()
                            : undefined
                    const click = manager.onLegendClick
                        ? (): void => manager.onLegendClick?.(mark.bin)
                        : undefined

                    const cursor = click ? "pointer" : "default"

                    return (
                        <g
                            key={`${mark.label}-${index}`}
                            onMouseOver={mouseOver}
                            onMouseLeave={mouseLeave}
                            onClick={click}
                            style={{ cursor }}
                        >
                            {/* for hover interaction */}
                            <rect
                                x={this.legendX + mark.x}
                                y={
                                    this.categoryLegendY +
                                    mark.y -
                                    this.rectPadding / 2
                                }
                                height={mark.rectSize + this.rectPadding}
                                width={
                                    mark.width + SPACE_BETWEEN_CATEGORICAL_BINS
                                }
                                fill="#fff"
                                opacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("categorical-color-legend")}
                className="categoricalColorLegend"
            >
                {this.renderSwatches()}
                {this.renderLabels()}
                {!this.manager.isStatic && this.renderInteractiveElements()}
            </g>
        )
    }
}
