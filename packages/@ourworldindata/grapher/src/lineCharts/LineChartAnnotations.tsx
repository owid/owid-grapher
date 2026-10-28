import React from "react"
import Tippy from "@tippyjs/react"
import { SeriesName } from "@ourworldindata/types"
import { pointsToPath, roundForSvg } from "@ourworldindata/utils"
import {
    LINE_STYLE,
    RANGE_ANNOTATION_OUTLINE_OPACITY,
    RANGE_ANNOTATION_OUTLINE_WIDTH,
    RenderPointAnnotation,
    RenderRangeAnnotation,
} from "./LineChartConstants"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"
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
                                annotations={[{ text: annotation.text }]}
                            />
                        }
                    >
                        <g
                            className="line-chart-point-annotations__marker"
                            transform={`translate(${roundForSvg(point.x)}, ${roundForSvg(point.y)})`}
                            opacity={LINE_STYLE[emphasis].opacity}
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
}

export function LineChartRangeAnnotations({
    annotations,
}: LineChartRangeAnnotationsProps): React.ReactElement {
    return (
        <g className="line-chart-range-annotations">
            {annotations.map(({ key, points, emphasis }) => (
                <path
                    key={key}
                    className="line-chart-range-annotations__outline"
                    d={pointsToPath(points)}
                    fill="none"
                    stroke={points[0].color}
                    strokeWidth={RANGE_ANNOTATION_OUTLINE_WIDTH}
                    strokeOpacity={RANGE_ANNOTATION_OUTLINE_OPACITY}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={LINE_STYLE[emphasis].opacity}
                    pointerEvents="none"
                />
            ))}
        </g>
    )
}
