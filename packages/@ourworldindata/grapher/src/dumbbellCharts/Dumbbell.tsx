import * as React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import {
    RenderDumbbellSeries,
    DUMBBELL_STYLE,
    PlacedDumbbellHead,
} from "./DumbbellChartConstants"
import { GRAY_90 } from "../color/ColorConstants.js"
import { HorizontalArrow } from "../arrows/Arrows.js"

export function TimeRangeDumbbell({
    series,
}: {
    series: RenderDumbbellSeries
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const { start, end } = series

    return (
        <g id={makeFigmaId("dumbbell")} opacity={style.opacity}>
            <DumbbellArrow
                startX={start.x}
                endX={end.x}
                color={series.color}
                width={2}
                headLength={start.radius}
            />
            <DumbbellHead id={makeFigmaId("start")} head={start} />
        </g>
    )
}

export function TwoColumnDumbbell({
    series,
}: {
    series: RenderDumbbellSeries
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const { start, end } = series

    const sign = end.x >= start.x ? 1 : -1
    const arrowPadding = start.radius
    const arrowStartX = start.x + sign * (start.radius + arrowPadding)
    const arrowEndX = end.x - sign * (end.radius + arrowPadding)

    return (
        <g id={makeFigmaId("dumbbell")} opacity={style.opacity}>
            <DumbbellArrow
                startX={arrowStartX}
                endX={arrowEndX}
                color={GRAY_90}
                headLength={Math.min(4.5, 0.6 * start.radius)}
            />
            <DumbbellHead id={makeFigmaId("start")} head={start} />
            <DumbbellHead id={makeFigmaId("end")} head={end} />
        </g>
    )
}

function DumbbellArrow({
    startX,
    endX,
    width,
    color,
    headLength,
}: {
    startX: number
    endX: number
    width?: number
    color?: string
    headLength?: number
}): React.ReactElement {
    return (
        <HorizontalArrow
            y={0}
            startX={startX}
            endX={endX}
            width={width}
            color={color}
            headStyle="solid"
            headLength={headLength}
            headAngle={35}
            lineCaps="sharp"
        />
    )
}

function DumbbellHead({
    id,
    head,
}: {
    id: string
    head: PlacedDumbbellHead
}): React.ReactElement {
    return <circle id={id} cx={head.x} r={head.radius} fill={head.color} />
}
