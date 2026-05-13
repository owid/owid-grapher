import * as React from "react"
import * as R from "remeda"
import { match } from "ts-pattern"
import { makeFigmaId } from "@ourworldindata/utils"
import { DumbbellConnectorStyle } from "@ourworldindata/types"
import {
    RenderDumbbellSeries,
    DUMBBELL_STYLE,
    PlacedDumbbellHead,
} from "./DumbbellChartConstants"
import { GRAY_50, GRAY_90 } from "../color/ColorConstants.js"
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
                headLength={series.end.radius}
            />
        </g>
    )
}

export function TwoColumnDumbbell({
    series,
    connectorStyle,
}: {
    series: RenderDumbbellSeries
    connectorStyle: DumbbellConnectorStyle
}): React.ReactElement {
    return match(connectorStyle)
        .with(DumbbellConnectorStyle.Arrow, () => (
            <TwoColumnArrowDumbbell series={series} />
        ))
        .with(DumbbellConnectorStyle.Line, () => (
            <TwoColumnLineDumbbell series={series} />
        ))
        .exhaustive()
}

function TwoColumnLineDumbbell({
    series,
}: {
    series: RenderDumbbellSeries
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const { start, end } = series

    const yOffset = getOverlappingHeadsYOffset(start, end)

    return (
        <g id={makeFigmaId("dumbbell")} opacity={style.opacity}>
            <line x1={start.x} x2={end.x} stroke={GRAY_50} strokeWidth={2} />
            <DumbbellHead
                id={makeFigmaId("start")}
                head={start}
                y={-yOffset}
                outline
            />
            <DumbbellHead
                id={makeFigmaId("end")}
                head={end}
                y={yOffset}
                outline
            />
        </g>
    )
}

function TwoColumnArrowDumbbell({
    series,
}: {
    series: RenderDumbbellSeries
}): React.ReactElement {
    const style = DUMBBELL_STYLE[series.emphasis]
    const { start, end } = series

    const distance = Math.abs(end.x - start.x)
    const gap = Math.max(0, distance - (start.radius + end.radius))

    const minArrowPadding = 1
    const arrowPadding = R.clamp(gap / 8, { min: 1, max: start.radius / 2 })

    const sign = end.x >= start.x ? 1 : -1
    const arrowStartX = start.x + sign * (start.radius + arrowPadding)
    const arrowEndX = end.x - sign * (end.radius + arrowPadding)

    // Don't show the arrow if the heads are too close together
    const minArrowLength = 3
    const shouldShowArrow = gap > minArrowLength + 2 * minArrowPadding

    const yOffset = getOverlappingHeadsYOffset(start, end)

    return (
        <g id={makeFigmaId("dumbbell")} opacity={style.opacity}>
            {shouldShowArrow ? (
                <DumbbellArrow
                    startX={arrowStartX}
                    endX={arrowEndX}
                    color={GRAY_90}
                    headLength={Math.min(4.5, 0.6 * start.radius)}
                />
            ) : (
                <line x1={arrowStartX} x2={arrowEndX} stroke={GRAY_90} />
            )}
            <DumbbellHead
                id={makeFigmaId("start")}
                head={start}
                y={-yOffset}
                outline
            />
            <DumbbellHead
                id={makeFigmaId("end")}
                head={end}
                y={yOffset}
                outline
            />
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

function getOverlappingHeadsYOffset(
    start: PlacedDumbbellHead,
    end: PlacedDumbbellHead
): number {
    // If the heads overlap by more than 50%, add a small vertical offset
    // to prevent the circles from completely obscuring each other
    const distance = Math.abs(end.x - start.x)
    const overlap = start.radius + end.radius - distance
    const overlapRatio = overlap / (start.radius + end.radius)

    return overlapRatio > 0.6 ? 2 : 0
}

function DumbbellHead({
    id,
    head,
    outline = false,
    y = 0,
}: {
    id: string
    head: PlacedDumbbellHead
    outline?: boolean
    y?: number
}): React.ReactElement {
    return (
        <circle
            id={id}
            cx={head.x}
            cy={y}
            r={head.radius}
            fill={head.color}
            stroke={outline ? "white" : undefined}
        />
    )
}
