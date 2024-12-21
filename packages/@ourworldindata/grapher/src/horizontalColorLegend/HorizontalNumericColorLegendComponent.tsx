import React from "react"
import { HorizontalNumericColorLegend } from "./HorizontalNumericColorLegend"
import { action, computed } from "mobx"
import {
    dyFromAlign,
    getRelativeMouse,
    makeIdForHumanConsumption,
    removeAllWhitespace,
    sortBy,
    VerticalAlign,
} from "@ourworldindata/utils"
import { ColorScaleBin, NumericBin } from "../color/ColorScaleBin"
import { darkenColorForLine } from "../color/ColorUtils"
import { observer } from "mobx-react"

const FOCUS_BORDER_COLOR = "#111"

@observer
export class HorizontalNumericColorLegendComponent extends React.Component<{
    legend: HorizontalNumericColorLegend
    legendOpacity?: number
    onLegendMouseLeave?: () => void
    onLegendMouseOver?: (d: ColorScaleBin) => void
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get legend(): HorizontalNumericColorLegend {
        return this.props.legend
    }

    @action.bound private onMouseMove(ev: MouseEvent | TouchEvent): void {
        const { base } = this
        const { positionedBins } = this.legend
        const { numericFocusBracket } = this.props.legend.props // TODO
        const { onLegendMouseLeave, onLegendMouseOver } = this.props
        if (base.current) {
            const mouse = getRelativeMouse(base.current, ev)

            // We implement onMouseMove and onMouseLeave in a custom way, without attaching them to
            // specific SVG elements, in order to allow continuous transition between bins as the user
            // moves their cursor across (even if their cursor is in the empty area above the
            // legend, where the labels are).
            // We could achieve the same by rendering invisible rectangles over the areas and attaching
            // event handlers to those.

            // If outside legend bounds, trigger onMouseLeave if there is an existing bin in focus.
            if (!this.legend.bounds.contains(mouse)) {
                if (numericFocusBracket && onLegendMouseLeave)
                    return onLegendMouseLeave()
                return
            }

            // If inside legend bounds, trigger onMouseOver with the bin closest to the cursor.
            let newFocusBracket: ColorScaleBin | undefined
            positionedBins.forEach((bin) => {
                if (mouse.x >= bin.x && mouse.x <= bin.x + bin.width)
                    newFocusBracket = bin.bin
            })

            if (newFocusBracket && onLegendMouseOver)
                onLegendMouseOver(newFocusBracket)
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
        const { numericLabels, numericBinSize, positionedBins, height } =
            this.legend
        const { numericFocusBracket } = this.legend.props
        const { legendOpacity } = this.props

        const stroke = this.legend.numericBinStroke
        const strokeWidth = this.legend.numericBinStrokeWidth
        const bottomY = this.legend.numericLegendY + height

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
                                numericFocusBracket &&
                                bin.equals(numericFocusBracket)
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
                                    opacity={legendOpacity} // defaults to undefined which removes the prop
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
                            fill={this.legend.legendTextColor}
                        >
                            {label.text}
                        </text>
                    ))}
                </g>
                {this.legend.legendTitle?.render(
                    this.legend.x,
                    // Align legend title baseline with bottom of color bins
                    this.legend.numericLegendY +
                        height -
                        this.legend.legendTitle.height +
                        this.legend.legendTitleFontSize * 0.2,
                    { textProps: { fill: this.legend.legendTextColor } }
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
