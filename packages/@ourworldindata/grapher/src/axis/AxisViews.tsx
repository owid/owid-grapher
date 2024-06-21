import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    HorizontalAlign,
    Position,
    VerticalAlign,
    dyFromAlign,
    textAnchorFromAlign,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { VerticalAxis, HorizontalAxis, DualAxis } from "./Axis"
import classNames from "classnames"
import { GRAPHER_DARK_TEXT } from "../core/GrapherConstants"
import { ScaleType, DetailsMarker } from "@ourworldindata/types"

const dasharrayFromFontSize = (fontSize: number): string => {
    const dashLength = Math.round((fontSize / 16) * 3)
    const spaceLength = Math.round((dashLength * 2) / 3)
    return `${dashLength},${spaceLength}`
}

const TICK_COLOR = "#ddd"
const FAINT_TICK_COLOR = "#eee"
const SOLID_TICK_COLOR = "#999"

@observer
export class VerticalAxisGridLines extends React.Component<{
    verticalAxis: VerticalAxis
    bounds: Bounds
    strokeWidth?: number
}> {
    render(): React.ReactElement {
        const { bounds, verticalAxis, strokeWidth } = this.props
        const axis = verticalAxis.clone()
        axis.range = bounds.yRange()

        return (
            <g
                id={makeIdForHumanConsumption("horizontal-grid-lines")}
                className={classNames("AxisGridLines", "horizontalLines")}
            >
                {axis.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? FAINT_TICK_COLOR
                        : t.solid
                          ? SOLID_TICK_COLOR
                          : TICK_COLOR

                    return (
                        <line
                            id={makeIdForHumanConsumption(
                                "grid-line",
                                t.value.toString()
                            )}
                            key={i}
                            x1={bounds.left.toFixed(2)}
                            y1={axis.place(t.value)}
                            x2={bounds.right.toFixed(2)}
                            y2={axis.place(t.value)}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={
                                t.solid
                                    ? undefined
                                    : dasharrayFromFontSize(
                                          verticalAxis.tickFontSize
                                      )
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
    strokeWidth?: number
}> {
    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render(): React.ReactElement {
        const { horizontalAxis, strokeWidth } = this.props
        const { bounds } = this
        const axis = horizontalAxis.clone()
        axis.range = bounds.xRange()

        return (
            <g
                id={makeIdForHumanConsumption("vertical-grid-lines")}
                className={classNames("AxisGridLines", "verticalLines")}
            >
                {axis.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? FAINT_TICK_COLOR
                        : t.solid
                          ? SOLID_TICK_COLOR
                          : TICK_COLOR

                    return (
                        <line
                            id={makeIdForHumanConsumption(
                                "grid-line",
                                t.value.toString()
                            )}
                            key={i}
                            x1={axis.place(t.value)}
                            y1={bounds.bottom.toFixed(2)}
                            x2={axis.place(t.value)}
                            y2={bounds.top.toFixed(2)}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={
                                t.solid
                                    ? undefined
                                    : dasharrayFromFontSize(
                                          horizontalAxis.tickFontSize
                                      )
                            }
                        />
                    )
                })}
            </g>
        )
    }
}

@observer
export class HorizontalAxisZeroLine extends React.Component<{
    horizontalAxis: HorizontalAxis
    bounds: Bounds
    strokeWidth?: number
}> {
    render(): React.ReactElement {
        const { bounds, horizontalAxis, strokeWidth } = this.props
        const axis = horizontalAxis.clone()
        axis.range = bounds.xRange()

        return (
            <g
                id={makeIdForHumanConsumption("vertical-zero-line")}
                className={classNames(
                    "AxisGridLines",
                    "verticalLines",
                    "zeroLine"
                )}
            >
                <line
                    x1={axis.place(0)}
                    y1={bounds.bottom.toFixed(2)}
                    x2={axis.place(0)}
                    y2={bounds.top.toFixed(2)}
                    stroke={SOLID_TICK_COLOR}
                    strokeWidth={strokeWidth}
                />
            </g>
        )
    }
}

interface DualAxisViewProps {
    dualAxis: DualAxis
    highlightValue?: { x: number; y: number }
    showTickMarks?: boolean
    labelColor?: string
    tickColor?: string
    lineWidth?: number
    detailsMarker?: DetailsMarker
}

@observer
export class DualAxisComponent extends React.Component<DualAxisViewProps> {
    render(): React.ReactElement {
        const {
            dualAxis,
            showTickMarks,
            labelColor,
            tickColor,
            lineWidth,
            detailsMarker,
        } = this.props
        const { bounds, horizontalAxis, verticalAxis, innerBounds } = dualAxis

        const verticalGridlines = verticalAxis.hideGridlines ? null : (
            <VerticalAxisGridLines
                verticalAxis={verticalAxis}
                bounds={innerBounds}
                strokeWidth={lineWidth}
            />
        )

        const horizontalGridlines = horizontalAxis.hideGridlines ? null : (
            <HorizontalAxisGridLines
                horizontalAxis={horizontalAxis}
                bounds={innerBounds}
                strokeWidth={lineWidth}
            />
        )

        const verticalAxisComponent = verticalAxis.hideAxis ? null : (
            <VerticalAxisComponent
                bounds={bounds}
                verticalAxis={verticalAxis}
                labelColor={labelColor}
                tickColor={tickColor}
                detailsMarker={detailsMarker}
            />
        )

        const horizontalAxisComponent = horizontalAxis.hideAxis ? null : (
            <HorizontalAxisComponent
                bounds={bounds}
                axis={horizontalAxis}
                showTickMarks={showTickMarks}
                preferredAxisPosition={innerBounds.bottom}
                labelColor={labelColor}
                tickColor={tickColor}
                tickMarkWidth={lineWidth}
                detailsMarker={detailsMarker}
            />
        )

        return (
            <g
                id={makeIdForHumanConsumption("dual-axis")}
                className="DualAxisView"
            >
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
    showTickMarks?: boolean
    labelColor?: string
    tickColor?: string
    detailsMarker?: DetailsMarker
}> {
    render(): React.ReactElement {
        const {
            bounds,
            verticalAxis,
            labelColor,
            tickColor,
            detailsMarker,
            showTickMarks,
        } = this.props
        const { tickLabels, labelTextWrap, config } = verticalAxis

        return (
            <g
                id={makeIdForHumanConsumption("vertical-axis")}
                className="VerticalAxis"
            >
                {labelTextWrap &&
                    labelTextWrap.renderSVG(
                        -verticalAxis.rangeCenter,
                        bounds.left,
                        {
                            id: makeIdForHumanConsumption(
                                "vertical-axis-label"
                            ),
                            textProps: {
                                transform: "rotate(-90)",
                                fill: labelColor || GRAPHER_DARK_TEXT,
                                textAnchor: "middle",
                            },
                            detailsMarker,
                        }
                    )}
                {showTickMarks && (
                    <g id={makeIdForHumanConsumption("tick-marks")}>
                        {tickLabels.map((label, i) => (
                            <VerticalAxisTickMark
                                key={i}
                                tickMarkYPosition={verticalAxis.place(
                                    label.value
                                )}
                                tickMarkLeftPosition={
                                    bounds.left + verticalAxis.width
                                }
                                color={SOLID_TICK_COLOR}
                            />
                        ))}
                    </g>
                )}
                {!config.hideTickLabels && (
                    <g id={makeIdForHumanConsumption("tick-labels")}>
                        {tickLabels.map((label, i) => {
                            const { y, xAlign, yAlign, formattedValue } = label
                            return (
                                <text
                                    key={i}
                                    id={makeIdForHumanConsumption(
                                        "tick-label",
                                        formattedValue
                                    )}
                                    x={(
                                        bounds.left +
                                        verticalAxis.width -
                                        verticalAxis.labelPadding
                                    ).toFixed(2)}
                                    y={y}
                                    dy={dyFromAlign(
                                        yAlign ?? VerticalAlign.middle
                                    )}
                                    textAnchor={textAnchorFromAlign(
                                        xAlign ?? HorizontalAlign.right
                                    )}
                                    fill={tickColor || GRAPHER_DARK_TEXT}
                                    fontSize={verticalAxis.tickFontSize}
                                >
                                    {formattedValue}
                                </text>
                            )
                        })}
                    </g>
                )}
            </g>
        )
    }
}

export class HorizontalAxisComponent extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    showTickMarks?: boolean
    preferredAxisPosition?: number
    labelColor?: string
    tickColor?: string
    tickMarkWidth?: number
    detailsMarker?: DetailsMarker
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

    render(): React.ReactElement {
        const {
            bounds,
            axis,
            showTickMarks,
            preferredAxisPosition,
            labelColor,
            tickColor,
            tickMarkWidth = 1,
            detailsMarker,
        } = this.props
        const { tickLabels, labelTextWrap: label, labelOffset, orient } = axis
        const tickSize = 5
        const horizontalAxisLabelsOnTop = orient === Position.top
        const labelYPosition = horizontalAxisLabelsOnTop
            ? bounds.top
            : bounds.bottom - (label?.height ?? 0)

        const tickMarksYPosition = horizontalAxisLabelsOnTop
            ? bounds.top + axis.height - 5
            : preferredAxisPosition ?? bounds.bottom

        const tickLabelYPlacement = horizontalAxisLabelsOnTop
            ? bounds.top + labelOffset + 10
            : bounds.bottom - labelOffset

        const showTickLabels = !axis.config.hideTickLabels

        return (
            <g
                id={makeIdForHumanConsumption("horizontal-axis")}
                className="HorizontalAxis"
            >
                {label &&
                    label.renderSVG(axis.rangeCenter, labelYPosition, {
                        id: makeIdForHumanConsumption("horizontal-axis-label"),
                        textProps: {
                            fill: labelColor || GRAPHER_DARK_TEXT,
                            textAnchor: "middle",
                        },
                        detailsMarker,
                    })}
                {(showTickMarks || showTickLabels) &&
                    tickLabels.map((label) => {
                        const { x, xAlign, formattedValue } = label
                        return (
                            <g
                                id={makeIdForHumanConsumption(
                                    "tick",
                                    formattedValue
                                )}
                                key={formattedValue}
                            >
                                {showTickMarks && (
                                    <line
                                        x1={axis.place(label.value)}
                                        y1={
                                            tickMarksYPosition -
                                            tickMarkWidth / 2
                                        }
                                        x2={axis.place(label.value)}
                                        y2={tickMarksYPosition + tickSize}
                                        stroke={SOLID_TICK_COLOR}
                                        strokeWidth={tickMarkWidth}
                                    />
                                )}
                                {showTickLabels && (
                                    <text
                                        x={x}
                                        y={tickLabelYPlacement}
                                        fill={tickColor || GRAPHER_DARK_TEXT}
                                        textAnchor={textAnchorFromAlign(
                                            xAlign ?? HorizontalAlign.center
                                        )}
                                        fontSize={axis.tickFontSize}
                                    >
                                        {formattedValue}
                                    </text>
                                )}
                            </g>
                        )
                    })}
            </g>
        )
    }
}

export class HorizontalAxisTickMark extends React.Component<{
    tickMarkTopPosition: number
    tickMarkXPosition: number
    color: string
    width?: number
    id?: string
}> {
    render(): React.ReactElement {
        const { tickMarkTopPosition, tickMarkXPosition, color, width, id } =
            this.props
        const tickSize = 5
        const tickBottom = tickMarkTopPosition + tickSize
        return (
            <line
                id={id}
                x1={tickMarkXPosition}
                y1={tickMarkTopPosition}
                x2={tickMarkXPosition}
                y2={tickBottom}
                stroke={color}
                strokeWidth={width}
            />
        )
    }
}

export class VerticalAxisTickMark extends React.Component<{
    tickMarkLeftPosition: number
    tickMarkYPosition: number
    color: string
    width?: number
    id?: string
}> {
    render(): React.ReactElement {
        const { tickMarkYPosition, tickMarkLeftPosition, color, width, id } =
            this.props
        const tickSize = 5
        const tickRight = tickMarkLeftPosition + tickSize
        return (
            <line
                id={id}
                x1={tickMarkLeftPosition}
                y1={tickMarkYPosition}
                x2={tickRight}
                y2={tickMarkYPosition}
                stroke={color}
                strokeWidth={width}
            />
        )
    }
}
