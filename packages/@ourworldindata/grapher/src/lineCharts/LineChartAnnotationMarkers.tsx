import React from "react"
import Tippy from "@tippyjs/react"
import { SeriesName, Time } from "@ourworldindata/types"
import { roundForSvg } from "@ourworldindata/utils"
import { LINE_STYLE, RenderAnnotation } from "./LineChartConstants"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"
import { SeriesLabelAnnotations } from "../seriesLabel/SeriesLabelAnnotations"

interface LineChartAnnotationMarkersProps {
    annotations: RenderAnnotation[]
    radius: number
    onClick: (seriesName: SeriesName, time: Time) => void
    onTooltipClose: () => void
}

export function LineChartAnnotationMarkers({
    annotations,
    radius,
    onClick,
    onTooltipClose,
}: LineChartAnnotationMarkersProps): React.ReactElement {
    return (
        <g className="line-chart-annotation-markers">
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
                            className="line-chart-annotation-markers__marker"
                            transform={`translate(${roundForSvg(point.x)}, ${roundForSvg(point.y)})`}
                            opacity={LINE_STYLE[emphasis].opacity}
                            onClick={() => onClick(seriesName, point.time)}
                        >
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
