import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { VerticalAxis, HorizontalAxis, DualAxis } from "./Axis"
import classNames from "classnames"
import { ScaleType } from "../core/GrapherConstants"
import {
    HorizontalAlign,
    Position,
    VerticalAlign,
} from "../../clientUtils/owidTypes"
import { dyFromAlign, textAnchorFromAlign } from "../../clientUtils/Util"

const dasharrayFromFontSize = (fontSize: number): string => {
    const dashLength = Math.round((fontSize / 16) * 3)
    const spaceLength = Math.round((dashLength * 2) / 3)
    return `${dashLength},${spaceLength}`
}

const TICK_COLOR = "#ddd"
const FAINT_TICK_COLOR = "#eee"
const DOMAIN_TICK_COLOR = "#999"

@observer
export class VerticalAxisGridLines extends React.Component<{
    verticalAxis: VerticalAxis
    bounds: Bounds
}> {
    render(): JSX.Element {
        const { bounds, verticalAxis } = this.props
        const axis = verticalAxis.clone()
        axis.range = bounds.yRange()

        return (
            <g className={classNames("AxisGridLines", "horizontalLines")}>
                {axis.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? FAINT_TICK_COLOR
                        : t.value === 0
                        ? DOMAIN_TICK_COLOR
                        : TICK_COLOR

                    return (
                        <line
                            key={i}
                            x1={bounds.left.toFixed(2)}
                            y1={axis.place(t.value)}
                            x2={bounds.right.toFixed(2)}
                            y2={axis.place(t.value)}
                            stroke={color}
                            strokeDasharray={
                                t.value !== 0
                                    ? dasharrayFromFontSize(
                                          verticalAxis.tickFontSize
                                      )
                                    : undefined
                            }
                        />
                    )
                })}
            </g>
        )
    }
}

@observer
export class HorizontalAxisGridLines extends React.Component<{
    horizontalAxis: HorizontalAxis
    bounds?: Bounds
}> {
    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render(): JSX.Element {
        const { horizontalAxis } = this.props
        const { bounds } = this
        const axis = horizontalAxis.clone()
        axis.range = bounds.xRange()

        return (
            <g className={classNames("AxisGridLines", "verticalLines")}>
                {axis.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? FAINT_TICK_COLOR
                        : t.value === 0
                        ? DOMAIN_TICK_COLOR
                        : TICK_COLOR

                    return (
                        <line
                            key={i}
                            x1={axis.place(t.value)}
                            y1={bounds.bottom.toFixed(2)}
                            x2={axis.place(t.value)}
                            y2={bounds.top.toFixed(2)}
                            stroke={color}
                            strokeDasharray={
                                t.value !== 0
                                    ? dasharrayFromFontSize(
                                          horizontalAxis.tickFontSize
                                      )
                                    : undefined
                            }
                        />
                    )
                })}
            </g>
        )
    }
}

interface DualAxisViewProps {
    dualAxis: DualAxis
    highlightValue?: { x: number; y: number }
    showTickMarks?: boolean
}

@observer
export class DualAxisComponent extends React.Component<DualAxisViewProps> {
    render(): JSX.Element {
        const { dualAxis, showTickMarks } = this.props
        const { bounds, horizontalAxis, verticalAxis, innerBounds } = dualAxis

        const verticalGridlines = verticalAxis.hideGridlines ? null : (
            <VerticalAxisGridLines
                verticalAxis={verticalAxis}
                bounds={innerBounds}
            />
        )

        const horizontalGridlines = horizontalAxis.hideGridlines ? null : (
            <HorizontalAxisGridLines
                horizontalAxis={horizontalAxis}
                bounds={innerBounds}
            />
        )

        const verticalAxisComponent = verticalAxis.hideAxis ? null : (
            <VerticalAxisComponent
                bounds={bounds}
                verticalAxis={verticalAxis}
            />
        )

        const horizontalAxisComponent = horizontalAxis.hideAxis ? null : (
            <HorizontalAxisComponent
                bounds={bounds}
                axis={horizontalAxis}
                showTickMarks={showTickMarks}
                preferredAxisPosition={innerBounds.bottom}
            />
        )

        return (
            <g className="DualAxisView">
                {horizontalAxisComponent}
                {verticalAxisComponent}
                {verticalGridlines}
                {horizontalGridlines}
            </g>
        )
    }
}

@observer
export class VerticalAxisComponent extends React.Component<{
    bounds: Bounds
    verticalAxis: VerticalAxis
}> {
    render(): JSX.Element {
        const { bounds, verticalAxis } = this.props
        const { tickLabels, labelTextWrap } = verticalAxis
        const textColor = "#666"

        return (
            <g className="VerticalAxis">
                {labelTextWrap &&
                    labelTextWrap.render(
                        -bounds.centerY - labelTextWrap.width / 2,
                        bounds.left,
                        { transform: "rotate(-90)" }
                    )}
                {tickLabels.map((label, i) => {
                    const { y, xAlign, yAlign, formattedValue } = label
                    return (
                        <text
                            key={i}
                            x={(
                                bounds.left +
                                verticalAxis.width -
                                verticalAxis.labelPadding
                            ).toFixed(2)}
                            y={y}
                            dy={dyFromAlign(yAlign ?? VerticalAlign.middle)}
                            textAnchor={textAnchorFromAlign(
                                xAlign ?? HorizontalAlign.right
                            )}
                            fill={textColor}
                            fontSize={verticalAxis.tickFontSize}
                        >
                            {formattedValue}
                        </text>
                    )
                })}
            </g>
        )
    }
}

export class HorizontalAxisComponent extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    showTickMarks?: boolean
    preferredAxisPosition?: number
}> {
    @computed get scaleType(): ScaleType {
        return this.props.axis.scaleType
    }

    set scaleType(scaleType: ScaleType) {
        this.props.axis.config.scaleType = scaleType
    }

    // for scale selector. todo: cleanup
    @computed get bounds(): Bounds {
        const { bounds, axis } = this.props
        if (axis.orient === Position.top)
            return new Bounds(bounds.right, bounds.top + 30, 100, 100)
        else return new Bounds(bounds.right, bounds.bottom - 30, 100, 100)
    }

    render(): JSX.Element {
        const { bounds, axis, showTickMarks, preferredAxisPosition } =
            this.props
        const { tickLabels, labelTextWrap: label, labelOffset, orient } = axis
        const horizontalAxisLabelsOnTop = orient === Position.top
        const textColor = "#666"
        const labelYPosition = horizontalAxisLabelsOnTop
            ? bounds.top
            : bounds.bottom - (label?.height ?? 0)

        const tickMarksYPosition = horizontalAxisLabelsOnTop
            ? bounds.top + axis.height - 5
            : preferredAxisPosition ?? bounds.bottom

        const tickMarks = showTickMarks ? (
            <AxisTickMarks
                tickMarkTopPosition={tickMarksYPosition}
                tickMarkXPositions={tickLabels.map((label): number =>
                    axis.place(label.value)
                )}
                color={DOMAIN_TICK_COLOR}
            />
        ) : undefined

        const tickLabelYPlacement = horizontalAxisLabelsOnTop
            ? bounds.top + labelOffset + 10
            : bounds.bottom - labelOffset
        return (
            <g className="HorizontalAxis">
                {label &&
                    label.render(
                        bounds.centerX - label.width / 2,
                        labelYPosition
                    )}
                {tickMarks}
                {tickLabels.map((label, i) => {
                    const { x, xAlign, formattedValue } = label
                    return (
                        <text
                            key={i}
                            x={x}
                            y={tickLabelYPlacement}
                            fill={textColor}
                            textAnchor={textAnchorFromAlign(
                                xAlign ?? HorizontalAlign.center
                            )}
                            fontSize={axis.tickFontSize}
                        >
                            {formattedValue}
                        </text>
                    )
                })}
            </g>
        )
    }
}

export class AxisTickMarks extends React.Component<{
    tickMarkTopPosition: number
    tickMarkXPositions: number[]
    color: string
}> {
    render(): JSX.Element[] {
        const { tickMarkTopPosition, tickMarkXPositions, color } = this.props
        const tickSize = 5
        const tickBottom = tickMarkTopPosition + tickSize
        return tickMarkXPositions.map((tickMarkPosition, index) => {
            return (
                <line
                    key={index}
                    x1={tickMarkPosition}
                    y1={tickMarkTopPosition}
                    x2={tickMarkPosition}
                    y2={tickBottom}
                    stroke={color}
                />
            )
        })
    }
}
