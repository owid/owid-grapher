import { PointVector } from "grapher/utils/PointVector"
import { first, last } from "lodash"
import { observer } from "mobx-react"
import React from "react"
import { MultiColorPolyline } from "./MultiColorPolyline"
import { ScatterRenderSeries } from "./ScatterPlotChartConstants"
import { Triangle } from "./Triangle"

// When there's only a single point in a series (e.g. single year mode)
@observer
export class ScatterPoint extends React.Component<{
    series: ScatterRenderSeries
    isLayerMode?: boolean
    isConnected?: boolean
}> {
    render() {
        const { series, isLayerMode, isConnected } = this.props
        const value = first(series.points)
        if (value === undefined) return null

        const color = series.isFocus || !isLayerMode ? value.color : "#e2e2e2"

        const isLabelled = series.allLabels.some((label) => !label.isHidden)
        const size =
            !series.isFocus && isConnected ? 1 + value.size / 16 : value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = isLayerMode ? "#bbb" : isLabelled ? "#333" : "#666"

        return (
            <g key={series.displayKey} className={series.displayKey}>
                {series.isFocus && (
                    <circle
                        cx={cx}
                        cy={cy}
                        fill="none"
                        stroke={color}
                        r={(size + 3).toFixed(2)}
                    />
                )}
                <circle
                    cx={cx}
                    cy={cy}
                    r={size.toFixed(2)}
                    fill={color}
                    opacity={0.8}
                    stroke={stroke}
                    strokeWidth={0.5}
                />
            </g>
        )
    }
}

@observer
export class ScatterLine extends React.Component<{
    series: ScatterRenderSeries
    isLayerMode: boolean
    isConnected: boolean
}> {
    render() {
        const { series, isLayerMode, isConnected } = this.props

        if (series.points.length === 1)
            return (
                <ScatterPoint
                    series={series}
                    isLayerMode={isLayerMode}
                    isConnected={isConnected}
                />
            )

        const firstValue = first(series.points)
        const lastValue = last(series.points)
        if (firstValue === undefined || lastValue === undefined) return null

        let rotation = PointVector.angle(series.offsetVector, PointVector.up)
        if (series.offsetVector.x < 0) rotation = -rotation

        const opacity = 0.7

        return (
            <g key={series.displayKey} className={series.displayKey}>
                <circle
                    cx={firstValue.position.x.toFixed(2)}
                    cy={firstValue.position.y.toFixed(2)}
                    r={(1 + firstValue.size / 25).toFixed(1)}
                    fill={isLayerMode ? "#e2e2e2" : firstValue.color}
                    stroke="none"
                    opacity={opacity}
                />
                <MultiColorPolyline
                    points={series.points.map((v) => ({
                        x: v.position.x,
                        y: v.position.y,
                        color: isLayerMode ? "#ccc" : v.color,
                    }))}
                    strokeWidth={(0.3 + series.size / 16).toFixed(2)}
                    opacity={opacity}
                />
                <Triangle
                    transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                        2
                    )}, ${lastValue.position.y.toFixed(2)})`}
                    cx={lastValue.position.x}
                    cy={lastValue.position.y}
                    r={1.5 + lastValue.size / 16}
                    fill={isLayerMode ? "#e2e2e2" : lastValue.color}
                    opacity={opacity}
                />
            </g>
        )
    }
}
