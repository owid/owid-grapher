import { makeIdForHumanConsumption, PointVector } from "@ourworldindata/utils"
import { GRAPHER_OPACITY_MUTE } from "../core/GrapherConstants"
import { NON_FOCUSED_LINE_COLOR } from "../lineCharts/LineChartConstants"
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
    unfocusedStyle = "muted",
}: SlopeProps) {
    const { seriesName, startPoint, endPoint, hover, focus } = series

    const showOutline = !focus.background || hover.active
    const opacity =
        (hover.background && !focus.background) ||
        (focus.background && unfocusedStyle === "faded")
            ? GRAPHER_OPACITY_MUTE
            : 1
    const color =
        !focus.background ||
        hover.active ||
        (focus.background && unfocusedStyle === "faded")
            ? series.color
            : NON_FOCUSED_LINE_COLOR
    const lineWidth =
        hover.background || focus.background ? 0.66 * strokeWidth : strokeWidth

    return (
        <>
            {showOutline && (
                <LineWithDots
                    id={makeIdForHumanConsumption("outline", seriesName)}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    radius={dotRadius + 2 * outlineWidth}
                    color={outlineStroke}
                    lineWidth={lineWidth + 2 * outlineWidth}
                />
            )}
            <LineWithDots
                id={makeIdForHumanConsumption("slope", seriesName)}
                startPoint={startPoint}
                endPoint={endPoint}
                radius={dotRadius}
                color={color}
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
