import React, { useRef, useState } from "react"
import Tippy from "@tippyjs/react"
import { detectOverflow, Modifier } from "@popperjs/core"
import { SeriesName } from "@ourworldindata/types"
import {
    Bounds,
    getRelativeMouse,
    PointVector,
    pointsToPath,
    roundForSvg,
} from "@ourworldindata/utils"
import {
    LINE_STYLE,
    RenderPointAnnotation,
    RenderRangeAnnotation,
} from "./LineChartConstants"
import { placeRangeAnnotationTooltip } from "./LineChartHelpers"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"
import { RANGE_ANNOTATION_OUTLINE_OPACITY } from "../annotations/AnnotationConstants"
import { AnnotationMarker } from "../annotations/EntityAnnotations"
import { SeriesLabelAnnotations } from "../seriesLabel/SeriesLabelAnnotations"

interface LineChartPointAnnotationsProps {
    annotations: RenderPointAnnotation[]
    radius: number
    hitRadius: number
    onClick: (seriesName: SeriesName, marker: AnnotationMarker) => void
    onTooltipClose: () => void
}

export function LineChartPointAnnotations({
    annotations,
    radius,
    hitRadius,
    onClick,
    onTooltipClose,
}: LineChartPointAnnotationsProps): React.ReactElement {
    return (
        <g className="line-chart-point-annotations">
            {annotations.map(
                ({
                    key,
                    seriesName,
                    point,
                    emphasis,
                    heading,
                    isTooltipOpen,
                    annotation,
                }) => (
                    <Tippy
                        key={key}
                        theme="grapher-explanation"
                        placement="top"
                        arrow={false}
                        offset={[0, 4]}
                        interactive
                        appendTo={() => document.body}
                        visible={isTooltipOpen}
                        onClickOutside={onTooltipClose}
                        content={
                            <SeriesLabelAnnotations
                                annotations={[
                                    {
                                        heading,
                                        text: annotation.text,
                                        timeScope: "point",
                                    },
                                ]}
                                color={point.color}
                            />
                        }
                    >
                        <g
                            className="line-chart-point-annotations__marker"
                            transform={`translate(${roundForSvg(point.x)}, ${roundForSvg(point.y)})`}
                            opacity={LINE_STYLE[emphasis].opacity}
                            // The chart would move its hovered time to the
                            // nearest point and unmount this marker mid-click
                            onTouchStart={(event) => event.stopPropagation()}
                            onMouseMove={(event) => event.stopPropagation()}
                            onClick={() =>
                                onClick(seriesName, {
                                    timeScope: "point",
                                    time: point.time,
                                })
                            }
                        >
                            <circle r={hitRadius} fill="transparent" />
                            <AnnotationInfoIcon
                                radius={radius}
                                color={point.color}
                            />
                        </g>
                    </Tippy>
                )
            )}
        </g>
    )
}

interface LineChartRangeAnnotationsProps {
    annotations: RenderRangeAnnotation[]
    hitWidth: number
    onClick: (seriesName: SeriesName, marker: AnnotationMarker) => void
    onTooltipClose: () => void
}

export function LineChartRangeAnnotations({
    annotations,
    hitWidth,
    onClick,
    onTooltipClose,
}: LineChartRangeAnnotationsProps): React.ReactElement {
    return (
        <g className="line-chart-range-annotations">
            {annotations.map((renderAnnotation) => (
                <g key={renderAnnotation.key}>
                    <RangeAnnotationOutline
                        points={renderAnnotation.points}
                        color={renderAnnotation.color}
                        emphasis={renderAnnotation.emphasis}
                        outlineWidth={renderAnnotation.outlineWidth}
                    />
                    <RangeAnnotationHitArea
                        rangeAnnotation={renderAnnotation}
                        hitWidth={hitWidth}
                        onClick={onClick}
                        onTooltipClose={onTooltipClose}
                    />
                </g>
            ))}
        </g>
    )
}

function RangeAnnotationOutline({
    points,
    color,
    emphasis,
    outlineWidth,
}: Pick<
    RenderRangeAnnotation,
    "points" | "color" | "emphasis" | "outlineWidth"
>): React.ReactElement {
    return (
        <path
            className="line-chart-range-annotations__outline"
            d={pointsToPath(points)}
            fill="none"
            stroke={color}
            strokeWidth={outlineWidth}
            strokeOpacity={RANGE_ANNOTATION_OUTLINE_OPACITY}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={LINE_STYLE[emphasis].opacity}
            pointerEvents="none"
        />
    )
}

interface RangeAnnotationHitAreaProps extends Omit<
    LineChartRangeAnnotationsProps,
    "annotations"
> {
    rangeAnnotation: RenderRangeAnnotation
}

function RangeAnnotationHitArea({
    rangeAnnotation: {
        seriesName,
        points,
        heading,
        isTooltipOpen,
        annotation,
        color,
        outlineWidth,
    },
    hitWidth,
    onClick,
    onTooltipClose,
}: RangeAnnotationHitAreaProps): React.ReactElement {
    const pathRef = useRef<SVGPathElement>(null)
    const clickOffsetRef = useRef({ x: 0, y: 0 })
    const [tooltipPlacement] = useState(createRangeAnnotationTooltipPlacement)

    const getReferenceClientRect = (): DOMRect => {
        const rect = pathRef.current?.getBoundingClientRect()
        return new DOMRect(
            (rect?.left ?? 0) + clickOffsetRef.current.x,
            (rect?.top ?? 0) + clickOffsetRef.current.y,
            0,
            0
        )
    }

    return (
        <Tippy
            theme="grapher-explanation"
            placement="top"
            arrow={false}
            interactive
            appendTo={() => document.body}
            visible={isTooltipOpen}
            onClickOutside={onTooltipClose}
            getReferenceClientRect={getReferenceClientRect}
            popperOptions={{
                modifiers: [
                    { name: "flip", enabled: false },
                    tooltipPlacement.placementModifier,
                ],
            }}
            content={
                <SeriesLabelAnnotations
                    annotations={[
                        { heading, text: annotation.text, timeScope: "range" },
                    ]}
                    color={color}
                />
            }
        >
            <path
                ref={pathRef}
                className="line-chart-range-annotations__hit-area"
                d={pointsToPath(points)}
                fill="none"
                stroke="transparent"
                strokeWidth={hitWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="stroke"
                onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    clickOffsetRef.current = {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                    }
                    const click = getRelativeMouse(event.currentTarget, event)
                    tooltipPlacement.storeClick({
                        pointsRelativeToClick: points.map(
                            (point) =>
                                new PointVector(
                                    point.x - click.x,
                                    point.y - click.y
                                )
                        ),
                        outlineWidth,
                    })
                    onClick(seriesName, {
                        timeScope: "range",
                        startTime: annotation.startTime,
                        endTime: annotation.endTime,
                    })
                }}
            />
        </Tippy>
    )
}

type RangeAnnotationTooltipPlacementModifier = Modifier<
    "rangeAnnotationTooltipPlacement",
    object
>

interface RangeAnnotationClick {
    pointsRelativeToClick: PointVector[]
    outlineWidth: number
}

interface RangeAnnotationTooltipPlacement {
    placementModifier: RangeAnnotationTooltipPlacementModifier
    storeClick: (click: RangeAnnotationClick) => void
}

function createRangeAnnotationTooltipPlacement(): RangeAnnotationTooltipPlacement {
    let click: RangeAnnotationClick | undefined
    const placementModifier: RangeAnnotationTooltipPlacementModifier = {
        name: "rangeAnnotationTooltipPlacement",
        enabled: true,
        phase: "main",
        requires: ["popperOffsets"],
        requiresIfExists: ["preventOverflow"],
        fn({ state }) {
            const { popperOffsets } = state.modifiersData
            if (!popperOffsets || !click) return

            const { reference, popper } = state.rects
            const clickPosition = new PointVector(reference.x, reference.y)
            const points = click.pointsRelativeToClick.map((point) =>
                clickPosition.add(point)
            )
            const tooltipBounds = new Bounds(
                popperOffsets.x,
                popperOffsets.y,
                popper.width,
                popper.height
            )

            const overflow = detectOverflow(state)
            const containerBounds = Bounds.fromCorners(
                new PointVector(
                    popperOffsets.x + overflow.left,
                    popperOffsets.y + overflow.top
                ),
                new PointVector(
                    popperOffsets.x + popper.width - overflow.right,
                    popperOffsets.y + popper.height - overflow.bottom
                )
            )

            popperOffsets.y = placeRangeAnnotationTooltip({
                points,
                clickPosition,
                tooltipBounds,
                containerBounds,
                outlineWidth: click.outlineWidth,
            }).y
        },
    }
    return {
        placementModifier,
        storeClick: (newClick) => {
            click = newClick
        },
    }
}
