import { makeFigmaId, PointVector } from "@ourworldindata/utils"
import { RenderSlopeChartSeries } from "./SlopeChartConstants"
import { LINE_STYLE } from "../lineCharts/LineChartConstants.js"

interface SlopeProps {
    series: RenderSlopeChartSeries
    dotRadius?: number
    strokeWidth?: number
    outlineWidth?: number
    outlineStroke?: string
}

export function Slope({
    series,
    dotRadius = 3.5,
    strokeWidth = 2,
    outlineWidth = 0.5,
    outlineStroke = "#fff",
}: SlopeProps) {
    const { displayName, startPoint, endPoint } = series

    const style = LINE_STYLE[series.emphasis]
    const lineWidth = style.strokeWidthFactor * strokeWidth

    return (
        <>
            {style.showOutline && (
                <LineWithDots
                    id={makeFigmaId("outline", displayName)}
                    startPoint={startPoint}
                    endPoint={endPoint}
                    radius={dotRadius + 2 * outlineWidth}
                    color={outlineStroke}
                    lineWidth={lineWidth + 2 * outlineWidth}
                />
            )}
            <LineWithDots
                id={makeFigmaId("slope", displayName)}
                startPoint={startPoint}
                endPoint={endPoint}
                radius={dotRadius}
                color={series.color}
                lineWidth={lineWidth}
                opacity={style.opacity}
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
                id={makeFigmaId("start-point")}
                cx={startPoint.x}
                cy={startPoint.y}
                r={radius}
                fill={color}
            />
            <circle
                id={makeFigmaId("end-point")}
                cx={endPoint.x}
                cy={endPoint.y}
                r={radius}
                fill={color}
            />
            <line
                id={makeFigmaId("line")}
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
