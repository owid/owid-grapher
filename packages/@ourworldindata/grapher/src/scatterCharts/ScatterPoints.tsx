import * as R from "remeda"
import { PointVector, makeIdForHumanConsumption } from "@ourworldindata/utils"
import { observer } from "mobx-react"
import * as React from "react"
import { MultiColorPolyline } from "./MultiColorPolyline"
import {
    ScatterRenderSeries,
    SCATTER_POINT_OPACITY,
    SCATTER_POINT_STROKE_WIDTH,
} from "./ScatterPlotChartConstants"
import { Triangle } from "./Triangle"

interface ScatterPointProps {
    series: ScatterRenderSeries
    isLayerMode?: boolean
    onMouseEnter?: (seriesName: string) => void
    onMouseLeave?: () => void
}

// When there's only a single point in a series (e.g. single year mode)
@observer
export class ScatterPoint extends React.Component<ScatterPointProps> {
    override render(): React.ReactElement | null {
        const { series, isLayerMode, onMouseEnter, onMouseLeave } = this.props
        const value = R.first(series.points)
        if (value === undefined) return null

        const color = series.isFocus || !isLayerMode ? value.color : "#e2e2e2"

        const isLabelled = series.allLabels.some((label) => !label.isHidden)
        const size = value.size
        const cx = value.position.x.toFixed(2)
        const cy = value.position.y.toFixed(2)
        const stroke = isLayerMode ? "#bbb" : isLabelled ? "#333" : "#666"

        return (
            <g
                id={makeIdForHumanConsumption(series.seriesName, "datapoint")}
                key={series.displayKey}
                className={series.displayKey}
                onMouseEnter={
                    onMouseEnter
                        ? (): void => onMouseEnter(series.seriesName)
                        : undefined
                }
                onMouseLeave={onMouseLeave}
            >
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
                    opacity={SCATTER_POINT_OPACITY}
                    stroke={stroke}
                    strokeWidth={SCATTER_POINT_STROKE_WIDTH}
                    style={{ transition: "fill 250ms" }}
                />
            </g>
        )
    }
}

interface ScatterLineProps {
    series: ScatterRenderSeries
    isLayerMode: boolean
    onMouseEnter?: (seriesName: string) => void
    onMouseLeave?: () => void
}

@observer
export class ScatterLine extends React.Component<ScatterLineProps> {
    override render(): React.ReactElement | null {
        const { series, isLayerMode, onMouseEnter, onMouseLeave } = this.props

        if (series.points.length === 1)
            return (
                <ScatterPoint
                    series={series}
                    isLayerMode={isLayerMode}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                />
            )

        const firstValue = R.first(series.points)
        const lastValue = R.last(series.points)
        if (firstValue === undefined || lastValue === undefined) return null

        let rotation = PointVector.angle(series.offsetVector, PointVector.up)
        if (series.offsetVector.x < 0) rotation = -rotation

        const opacity = 0.7

        return (
            <g
                id={makeIdForHumanConsumption(
                    "scatter-line",
                    series.displayKey
                )}
                key={series.displayKey}
                className={series.displayKey}
            >
                <circle
                    cx={firstValue.position.x.toFixed(2)}
                    cy={firstValue.position.y.toFixed(2)}
                    r={(1 + firstValue.size / 2).toFixed(1)}
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
                    strokeWidth={series.size.toFixed(2)}
                    opacity={opacity}
                    style={{ transition: "stroke 250ms" }}
                />
                <Triangle
                    transform={`rotate(${rotation}, ${lastValue.position.x.toFixed(
                        2
                    )}, ${lastValue.position.y.toFixed(2)})`}
                    cx={lastValue.position.x}
                    cy={lastValue.position.y}
                    r={1.5 + lastValue.size}
                    fill={isLayerMode ? "#e2e2e2" : lastValue.color}
                    opacity={opacity}
                />
            </g>
        )
    }
}
