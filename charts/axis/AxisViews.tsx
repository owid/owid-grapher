/* AxisBox.tsx
 * ================
 *
 * Standard axis box layout model. Precompute before rendering and pass it around.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { VerticalAxis, HorizontalAxis, AxisBox } from "./Axis"
import { ScaleType } from "charts/core/ChartConstants"
import classNames from "classnames"
import { ControlsOverlay } from "charts/controls/Controls"
import { ScaleSelector } from "charts/controls/ScaleSelector"

@observer
export class VerticalAxisGridLines extends React.Component<{
    verticalAxis: VerticalAxis
    bounds: Bounds
}> {
    render() {
        const { bounds, verticalAxis } = this.props
        const axis = verticalAxis.clone()
        axis.range = bounds.yRange()

        return (
            <g className={classNames("AxisGridLines", "horizontalLines")}>
                {axis.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? "#eee"
                        : t.value === 0
                        ? "#ccc"
                        : "#d3d3d3"

                    return (
                        <line
                            key={i}
                            x1={bounds.left.toFixed(2)}
                            y1={axis.place(t.value)}
                            x2={bounds.right.toFixed(2)}
                            y2={axis.place(t.value)}
                            stroke={color}
                            strokeDasharray={t.value !== 0 ? "3,2" : undefined}
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
    bounds: Bounds
}> {
    render() {
        const { bounds, horizontalAxis } = this.props
        const view = horizontalAxis.clone()
        view.range = bounds.xRange()

        return (
            <g className={classNames("AxisGridLines", "verticalLines")}>
                {view.getTickValues().map((t, i) => {
                    const color = t.faint
                        ? "#eee"
                        : t.value === 0
                        ? "#ccc"
                        : "#d3d3d3"

                    return (
                        <line
                            key={i}
                            x1={view.place(t.value)}
                            y1={bounds.bottom.toFixed(2)}
                            x2={view.place(t.value)}
                            y2={bounds.top.toFixed(2)}
                            stroke={color}
                            strokeDasharray={t.value !== 0 ? "3,2" : undefined}
                        />
                    )
                })}
            </g>
        )
    }
}

interface AxisBoxViewProps {
    axisBox: AxisBox
    highlightValue?: { x: number; y: number }
    showTickMarks: boolean
    isInteractive: boolean
}

@observer
export class AxisBoxComponent extends React.Component<AxisBoxViewProps> {
    componentDidMount() {
        requestAnimationFrame(this.props.axisBox.setupAnimation)
    }

    render() {
        const { axisBox, showTickMarks } = this.props
        const { bounds, xAxisWithRange, yAxisWithRange, innerBounds } = axisBox

        const maxX = undefined // {chartView.tabBounds.width} todo

        return (
            <g className="AxisBoxView">
                <HorizontalAxisComponent
                    maxX={maxX}
                    bounds={bounds}
                    axisPosition={innerBounds.bottom}
                    axis={xAxisWithRange}
                    showTickMarks={showTickMarks}
                    isInteractive={this.props.isInteractive}
                />
                <VerticalAxisComponent
                    bounds={bounds}
                    axis={yAxisWithRange}
                    isInteractive={this.props.isInteractive}
                />
                {!yAxisWithRange.hideGridlines && (
                    <VerticalAxisGridLines
                        verticalAxis={yAxisWithRange}
                        bounds={innerBounds}
                    />
                )}
                {!xAxisWithRange.hideGridlines && (
                    <HorizontalAxisGridLines
                        horizontalAxis={xAxisWithRange}
                        bounds={innerBounds}
                    />
                )}
            </g>
        )
    }
}

@observer
export class VerticalAxisComponent extends React.Component<{
    bounds: Bounds
    axis: VerticalAxis
    isInteractive: boolean
}> {
    @computed get controls() {
        const { bounds, axis } = this.props
        const showControls =
            this.props.isInteractive && axis.scaleTypeOptions.length > 1
        if (!showControls) return undefined
        return (
            <ControlsOverlay id="vertical-scale-selector" paddingTop={18}>
                <ScaleSelector
                    x={bounds.left}
                    y={bounds.top - 34}
                    scaleTypeConfig={axis}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis } = this.props
        const { ticks, labelTextWrap: label } = axis
        const textColor = "#666"

        return (
            <g className="VerticalAxisBox">
                {label &&
                    label.render(
                        -bounds.centerY - label.width / 2,
                        bounds.left,
                        { transform: "rotate(-90)" }
                    )}
                {ticks.map((tick, i) => (
                    <text
                        key={i}
                        x={(bounds.left + axis.width - 5).toFixed(2)}
                        y={axis.place(tick)}
                        fill={textColor}
                        dominantBaseline="middle"
                        textAnchor="end"
                        fontSize={axis.tickFontSize}
                    >
                        {axis.formatTick(tick)}
                    </text>
                ))}
                {this.controls}
            </g>
        )
    }
}

export class HorizontalAxisComponent extends React.Component<{
    bounds: Bounds
    axis: HorizontalAxis
    axisPosition: number
    maxX?: number
    showTickMarks?: boolean
    isInteractive: boolean
    onScaleTypeChange?: (scaleType: ScaleType) => void // We need this because on DiscreteBar scaleType change behaves differently
}> {
    @computed get controls() {
        const { bounds, axis, onScaleTypeChange, maxX } = this.props
        const showControls =
            this.props.isInteractive && axis.scaleTypeOptions.length > 1
        if (!showControls) return undefined

        return (
            <ControlsOverlay id="horizontal-scale-selector" paddingBottom={10}>
                <ScaleSelector
                    maxX={maxX}
                    x={bounds.right}
                    y={bounds.bottom}
                    scaleTypeConfig={axis}
                    onScaleTypeChange={onScaleTypeChange}
                />
            </ControlsOverlay>
        )
    }

    render() {
        const { bounds, axis, axisPosition, showTickMarks } = this.props
        const { ticks, labelTextWrap: label, labelOffset } = axis
        const textColor = "#666"

        const tickMarks = showTickMarks ? (
            <AxisTickMarks
                tickMarkTopPosition={axisPosition}
                tickMarkXPositions={ticks.map(tick => axis.place(tick))}
                color="#ccc"
            />
        ) : undefined

        return (
            <g className="HorizontalAxis">
                {label &&
                    label.render(
                        bounds.centerX - label.width / 2,
                        bounds.bottom - label.height
                    )}
                {tickMarks}
                {ticks.map((tick, i) => {
                    const label = axis.formatTick(
                        tick,
                        i === 0 || i === ticks.length - 1
                    )
                    const rawXPosition = axis.place(tick)
                    // Ensure the first label does not exceed the chart viewing area
                    const xPosition =
                        i === 0
                            ? Bounds.getRightShiftForMiddleAlignedTextIfNeeded(
                                  label,
                                  axis.tickFontSize,
                                  rawXPosition
                              ) + rawXPosition
                            : rawXPosition
                    const element = (
                        <text
                            key={i}
                            x={xPosition}
                            y={bounds.bottom - labelOffset}
                            fill={textColor}
                            textAnchor="middle"
                            fontSize={axis.tickFontSize}
                        >
                            {label}
                        </text>
                    )

                    return element
                })}
                {this.controls}
            </g>
        )
    }
}

export class AxisTickMarks extends React.Component<{
    tickMarkTopPosition: number
    tickMarkXPositions: number[]
    color: string
}> {
    render() {
        const { tickMarkTopPosition, tickMarkXPositions, color } = this.props
        const tickSize = 4
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
