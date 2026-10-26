import * as React from "react"
import { TextWrapSvg } from "@ourworldindata/components"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { SeriesName } from "@ourworldindata/types"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"
import { darkenColorForText } from "../color/ColorUtils.js"
import {
    INLINE_ANNOTATION_PADDING,
    LABEL_STYLE,
} from "./VerticalLabelsConstants.js"
import { getSeriesKey } from "./VerticalLabelsHelpers"
import { PlacedLabelSeries, RenderLabelSeries } from "./VerticalLabelsTypes"
import { VerticalLabelsState } from "./VerticalLabelsState"
import { Emphasis } from "../interaction/Emphasis.js"

/** Series labels stacked vertically */
export function VerticalLabels({
    state,
    x = 0,
    outline = false,
    onMouseEnter,
    onMouseLeave,
    onTooltipShow,
    onTooltipHide,
}: {
    state: VerticalLabelsState
    x?: number
    outline?: boolean
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: () => void
    onTooltipShow?: (seriesName: SeriesName) => void
    onTooltipHide?: (seriesName: SeriesName) => void
}): React.ReactElement {
    const { renderSeries, seriesWithInlineAnnotation, textAnchor } = state

    return (
        <g
            id={makeFigmaId("vertical-labels")}
            transform={`translate(${roundForSvg(x)}, 0)`}
        >
            {state.isInteractive && (
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
            {state.hasInlineAnnotations && (
                <InlineAnnotations
                    series={seriesWithInlineAnnotation}
                    anchor={textAnchor}
                />
            )}
            <Labels
                series={renderSeries}
                outline={outline}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onTooltipShow={onTooltipShow}
                onTooltipHide={onTooltipHide}
            />
        </g>
    )
}

function Labels({
    series,
    outline = false,
    onMouseEnter,
    onMouseLeave,
    onTooltipShow,
    onTooltipHide,
}: {
    series: RenderLabelSeries[]
    outline: boolean
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: (key: SeriesName) => void
    onTooltipShow?: (key: SeriesName) => void
    onTooltipHide?: (key: SeriesName) => void
}): React.ReactElement {
    return (
        <g id={makeFigmaId("text-labels")} style={{ pointerEvents: "none" }}>
            {series.map((series, index) => {
                const color = darkenColorForText(series.color)
                const emphasis = series.emphasis ?? Emphasis.Default
                return (
                    <SeriesLabel
                        key={getSeriesKey(series, index)}
                        id={makeFigmaId("label", series.seriesName)}
                        state={series.seriesLabel}
                        x={series.labelCoords.x}
                        y={series.labelCoords.y}
                        color={{ name: color, value: color }}
                        opacity={LABEL_STYLE[emphasis].opacity}
                        outline={outline}
                        onMouseEnter={() => onMouseEnter?.(series.seriesName)}
                        onMouseLeave={() => onMouseLeave?.(series.seriesName)}
                        onTooltipShow={() => onTooltipShow?.(series.seriesName)}
                        onTooltipHide={() => onTooltipHide?.(series.seriesName)}
                    />
                )
            })}
        </g>
    )
}

function InlineAnnotations({
    series,
    anchor,
}: {
    series: RenderLabelSeries[]
    anchor: "start" | "end"
}): React.ReactElement | null {
    return (
        <g
            id={makeFigmaId("text-annotations")}
            style={{ pointerEvents: "none" }}
        >
            {series.map((series, index) => {
                if (!series.inlineAnnotationTextWrap) return null
                const emphasis = series.emphasis ?? Emphasis.Default
                return (
                    <React.Fragment key={getSeriesKey(series, index)}>
                        <TextWrapSvg
                            textWrap={series.inlineAnnotationTextWrap}
                            x={series.labelCoords.x}
                            y={
                                series.labelCoords.y +
                                series.seriesLabel.height +
                                INLINE_ANNOTATION_PADDING
                            }
                            fill="#333"
                            opacity={LABEL_STYLE[emphasis].opacity}
                            textAnchor={anchor}
                            style={{ fontWeight: 300 }}
                        />
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
        <g id={makeFigmaId("connectors")} style={{ pointerEvents: "none" }}>
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
                const d =
                    `M${roundForSvg(startX)},${roundForSvg(leftCenterY)}` +
                    ` H${roundForSvg(markerXMid)}` +
                    ` V${roundForSvg(rightCenterY)}` +
                    ` H${roundForSvg(endX)}`

                const emphasis = series.emphasis ?? Emphasis.Default
                const lineColor = LABEL_STYLE[emphasis].connectorLineColor

                return (
                    <path
                        id={makeFigmaId(series.seriesName)}
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
                            x={roundForSvg(x)}
                            y={roundForSvg(series.bounds.y)}
                            width={roundForSvg(series.bounds.width)}
                            height={roundForSvg(series.bounds.height)}
                            fill="#fff"
                            opacity={0}
                        />
                    </g>
                )
            })}
        </g>
    )
}
