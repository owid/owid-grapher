import * as React from "react"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"
import { SeriesName } from "@ourworldindata/types"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"
import { darkenColorForText } from "../color/ColorUtils.js"
import { ANNOTATION_PADDING } from "./VerticalLabelsConstants.js"
import { getSeriesKey } from "./VerticalLabelsHelpers"
import { PlacedLabelSeries, RenderLabelSeries } from "./VerticalLabelsTypes"
import { VerticalLabelsState } from "./VerticalLabelsState"

/**
 * Series labels stacked vertically, with connector lines,
 * entity annotations, and interactive hover/focus states
 */
export function VerticalLabels({
    state,
    x = 0,
    onMouseEnter,
    onMouseLeave,
    interactive = true,
}: {
    state: VerticalLabelsState
    x?: number
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: () => void
    interactive?: boolean
}): React.ReactElement {
    const { renderSeries, annotatedSeries, textAnchor } = state

    return (
        <g
            id={makeIdForHumanConsumption("vertical-labels")}
            transform={`translate(${x}, 0)`}
        >
            {interactive && (
                <InteractionOverlays
                    series={state.placedSeries}
                    anchor={textAnchor}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                />
            )}
            {state.needsConnectorLines && (
                <ConnectorLines series={renderSeries} />
            )}
            {state.hasAnnotatedSeries && (
                <Annotations series={annotatedSeries} anchor={textAnchor} />
            )}
            <Labels
                series={renderSeries}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            />
        </g>
    )
}

function Labels({
    series,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderLabelSeries[]
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: (key: SeriesName) => void
}): React.ReactElement {
    return (
        <g
            id={makeIdForHumanConsumption("text-labels")}
            style={{ pointerEvents: "none" }}
        >
            {series.map((series, index) => {
                const color = darkenColorForText(series.color)
                return (
                    <SeriesLabel
                        key={getSeriesKey(series, index)}
                        id={makeIdForHumanConsumption(
                            "label",
                            series.seriesName
                        )}
                        state={series.seriesLabel}
                        x={series.labelCoords.x}
                        y={series.labelCoords.y}
                        color={{ name: color, value: color }}
                        opacity={series.opacity}
                        onMouseEnter={() => onMouseEnter?.(series.seriesName)}
                        onMouseLeave={() => onMouseLeave?.(series.seriesName)}
                    />
                )
            })}
        </g>
    )
}

function Annotations({
    series,
    anchor,
}: {
    series: RenderLabelSeries[]
    anchor: "start" | "end"
}): React.ReactElement | null {
    return (
        <g
            id={makeIdForHumanConsumption("text-annotations")}
            style={{ pointerEvents: "none" }}
        >
            {series.map((series, index) => {
                if (!series.annotationTextWrap) return null
                return (
                    <React.Fragment key={getSeriesKey(series, index)}>
                        {series.annotationTextWrap.renderSVG(
                            series.labelCoords.x,
                            series.labelCoords.y +
                                series.seriesLabel.height +
                                ANNOTATION_PADDING,
                            {
                                textProps: {
                                    fill: "#333",
                                    opacity: series.opacity,
                                    textAnchor: anchor,
                                    style: { fontWeight: 300 },
                                },
                            }
                        )}
                    </React.Fragment>
                )
            })}
        </g>
    )
}

function ConnectorLines({
    series,
}: {
    series: RenderLabelSeries[]
}): React.ReactElement {
    return (
        <g
            id={makeIdForHumanConsumption("connectors")}
            style={{ pointerEvents: "none" }}
        >
            {series.map((series, index) => {
                const { startX, endX } = series.connectorLineCoords
                const {
                    level,
                    totalLevels,
                    origBounds: { centerY: leftCenterY },
                    bounds: { centerY: rightCenterY },
                } = series

                const step = (endX - startX) / (totalLevels + 1)
                const markerXMid = startX + step + level * step
                const d = `M${startX},${leftCenterY} H${markerXMid} V${rightCenterY} H${endX}`
                const lineColor =
                    series.hover?.background || series.focus?.background
                        ? "#eee"
                        : "#999"

                return (
                    <path
                        id={makeIdForHumanConsumption(series.seriesName)}
                        key={getSeriesKey(series, index)}
                        d={d}
                        stroke={lineColor}
                        strokeWidth={0.5}
                        fill="none"
                    />
                )
            })}
        </g>
    )
}

function InteractionOverlays({
    series,
    anchor,
    onMouseEnter,
    onMouseLeave,
}: {
    series: PlacedLabelSeries[]
    anchor: "start" | "end"
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: (key: SeriesName) => void
}): React.ReactElement {
    return (
        <g>
            {series.map((series, index) => {
                const x =
                    anchor === "start"
                        ? series.origBounds.x
                        : series.origBounds.x - series.bounds.width
                return (
                    <g
                        key={getSeriesKey(series, index)}
                        onMouseEnter={() => onMouseEnter?.(series.seriesName)}
                        onMouseLeave={() => onMouseLeave?.(series.seriesName)}
                    >
                        <rect
                            x={x}
                            y={series.bounds.y}
                            width={series.bounds.width}
                            height={series.bounds.height}
                            fill="#fff"
                            opacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
