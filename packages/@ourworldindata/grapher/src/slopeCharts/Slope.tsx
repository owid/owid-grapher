import { makeIdForHumanConsumption, PointVector } from "@ourworldindata/utils"
import { GRAPHER_OPACITY_MUTE } from "../core/GrapherConstants"
import { RenderSlopeChartSeries } from "./SlopeChartConstants"

interface SlopeProps {
    series: RenderSlopeChartSeries
    dotRadius?: number
    strokeWidth?: number
    outlineWidth?: number
    outlineStroke?: string
    unfocusedStyle?: "muted" | "faded"
}

export function Slope({
    series,
    dotRadius = 3.5,
    strokeWidth = 2,
    outlineWidth = 0.5,
    outlineStroke = "#fff",
}: SlopeProps) {
    const { displayName, startPoint, endPoint } = series

    const isInForeground =
        series.hover.active ||
        series.focus.active ||
        (series.focus.idle && series.hover.idle)

    const showOutline = isInForeground

    const opacity = isInForeground ? 1 : GRAPHER_OPACITY_MUTE
    const lineWidth = isInForeground ? strokeWidth : 0.66 * strokeWidth

    return (
        <>
            {showOutline && (
                <LineWithDots
                    id={makeIdForHumanConsumption("outline", displayName)}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    radius={dotRadius + 2 * outlineWidth}
                    color={outlineStroke}
                    lineWidth={lineWidth + 2 * outlineWidth}
                />
            )}
            <LineWithDots
                id={makeIdForHumanConsumption("slope", displayName)}
                startPoint={startPoint}
                endPoint={endPoint}
                radius={dotRadius}
                color={series.color}
                lineWidth={lineWidth}
                opacity={opacity}
            />
        </>
    )
}

function LineWithDots({
    id,
    startPoint,
    endPoint,
    radius,
    color,
    lineWidth = 2,
    opacity = 1,
}: {
    id?: string
    startPoint: PointVector
    endPoint: PointVector
    radius: number
    color: string
    lineWidth?: number
    opacity?: number
}): React.ReactElement {
    return (
        <g id={id} opacity={opacity} className="slope">
            <circle
                id={makeIdForHumanConsumption("start-point")}
                cx={startPoint.x}
                cy={startPoint.y}
                r={radius}
                fill={color}
            />
            <circle
                id={makeIdForHumanConsumption("end-point")}
                cx={endPoint.x}
                cy={endPoint.y}
                r={radius}
                fill={color}
            />
            <line
                id={makeIdForHumanConsumption("line")}
                x1={startPoint.x}
                y1={startPoint.y}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke={color}
                strokeWidth={lineWidth.toFixed(1)}
            />
        </g>
    )
}
