import React from "react"
import Tippy from "@tippyjs/react"
import { SeriesName, Time } from "@ourworldindata/types"
import { roundForSvg } from "@ourworldindata/utils"
import { LINE_STYLE, RenderPointAnnotation } from "./LineChartConstants"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"
import { SeriesLabelAnnotations } from "../seriesLabel/SeriesLabelAnnotations"

interface LineChartPointAnnotationsProps {
    annotations: RenderPointAnnotation[]
    radius: number
    hitRadius: number
    onClick: (seriesName: SeriesName, time: Time) => void
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
                            // The chart would move its hovered time to the
                            // nearest point and unmount this marker mid-click
                            onTouchStart={(event) => event.stopPropagation()}
                            onMouseMove={(event) => event.stopPropagation()}
                            onClick={() => onClick(seriesName, point.time)}
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
