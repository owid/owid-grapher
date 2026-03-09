import * as React from "react"
import { makeFigmaId } from "@ourworldindata/utils"
import {
    RenderDumbbellSeries,
    DUMBBELL_STYLE,
    PlacedDumbbellHead,
} from "./DumbbellChartConstants"

interface DumbbellProps {
    series: RenderDumbbellSeries
}

export function Dumbbell({ series }: DumbbellProps): React.ReactElement {
    const { left, right } = series

    const style = DUMBBELL_STYLE[series.emphasis]

    return (
        <g id={makeFigmaId("dumbbell")} opacity={style.opacity}>
            <DumbbellConnectorLine
                id={makeFigmaId("connector")}
                left={left}
                right={right}
                color={series.connector.color}
            />
            <DumbbellHead id={makeFigmaId("left")} head={left} />
            <DumbbellHead id={makeFigmaId("right")} head={right} />
        </g>
    )
}

function DumbbellConnectorLine({
    id,
    left,
    right,
    color,
}: {
    id: string
    left: PlacedDumbbellHead
    right: PlacedDumbbellHead
    color: string
}): React.ReactElement {
    return (
        <line id={id} x1={left.x} x2={right.x} stroke={color} strokeWidth={2} />
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
