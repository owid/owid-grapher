import * as React from "react"
import Tippy from "@tippyjs/react"
import { DOD_TIPPY_PROPS, TextWrapSvg } from "@ourworldindata/components"
import { makeFigmaId, roundForSvg } from "@ourworldindata/utils"
import { SeriesName } from "@ourworldindata/types"
import { SeriesLabel } from "../seriesLabel/SeriesLabel.js"
import { darkenColorForText } from "../color/ColorUtils.js"
import { ANNOTATION_PADDING, LABEL_STYLE } from "./VerticalLabelsConstants.js"
import { getSeriesKey } from "./VerticalLabelsHelpers"
import { PlacedLabelSeries, RenderLabelSeries } from "./VerticalLabelsTypes"
import { VerticalLabelsState } from "./VerticalLabelsState"
import { Emphasis } from "../interaction/Emphasis.js"
import {
    AnnotationDodContent,
    AnnotationInfoIcon,
    getAnnotationIconRadius,
} from "../lineCharts/LineChartAnnotationExperiment"

/**
 * EXPERIMENT: a label that shows an "i" icon next to it while `showIcon` is
 * true. If it has `dodText`, it also carries a dotted underline and shows a
 * details-on-demand popup on hover.
 */
export interface AnnotatedVerticalLabel {
    seriesName: SeriesName
    dodText?: string
    showIcon: boolean
    onDodShow?: () => void
    onDodHide?: () => void
}

/** Series labels stacked vertically */
export function VerticalLabels({
    state,
    x = 0,
    outline = false,
    onMouseEnter,
    onMouseLeave,
    interactive = true,
    annotatedLabel,
}: {
    state: VerticalLabelsState
    x?: number
    outline?: boolean
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: () => void
    interactive?: boolean
    annotatedLabel?: AnnotatedVerticalLabel
}): React.ReactElement {
    const { renderSeries, annotatedSeries, textAnchor } = state
    const dodLabelSeries = annotatedLabel
        ? renderSeries.find((s) => s.seriesName === annotatedLabel.seriesName)
        : undefined

    return (
        <g
            id={makeFigmaId("vertical-labels")}
            transform={`translate(${roundForSvg(x)}, 0)`}
        >
            {interactive && (
                <InteractionOverlays
                    series={state.placedSeries}
                    anchor={textAnchor}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    annotatedLabel={annotatedLabel}
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
                outline={outline}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            />
            {annotatedLabel && dodLabelSeries && (
                <AnnotatedLabelDecoration
                    series={dodLabelSeries}
                    anchor={textAnchor}
                    showIcon={annotatedLabel.showIcon}
                    showUnderline={!!annotatedLabel.dodText}
                />
            )}
        </g>
    )
}

function AnnotatedLabelDecoration({
    series,
    anchor,
    showIcon,
    showUnderline,
}: {
    series: RenderLabelSeries
    anchor: "start" | "end"
    showIcon: boolean
    showUnderline: boolean
}): React.ReactElement {
    const { width, height } = series.seriesLabel
    const x1 =
        anchor === "start" ? series.labelCoords.x : series.labelCoords.x - width
    const y = series.labelCoords.y + height + 1
    const color = darkenColorForText(series.color)
    const emphasis = series.emphasis ?? Emphasis.Default
    const opacity = LABEL_STYLE[emphasis].opacity

    const iconRadius = getAnnotationIconRadius(
        series.seriesLabel.fontSettings.fontSize
    )
    const iconGap = 4
    const iconX =
        anchor === "start"
            ? x1 + width + iconGap + iconRadius
            : x1 - iconGap - iconRadius

    return (
        <g style={{ pointerEvents: "none" }}>
            {showUnderline && (
                <line
                    x1={roundForSvg(x1)}
                    y1={roundForSvg(y)}
                    x2={roundForSvg(x1 + width)}
                    y2={roundForSvg(y)}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray={1}
                    opacity={opacity}
                />
            )}
            {showIcon && (
                <AnnotationInfoIcon
                    x={iconX}
                    y={series.labelCoords.y + height / 2}
                    radius={iconRadius}
                    fill={color}
                    opacity={opacity}
                />
            )}
        </g>
    )
}

function Labels({
    series,
    outline = false,
    onMouseEnter,
    onMouseLeave,
}: {
    series: RenderLabelSeries[]
    outline: boolean
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: (key: SeriesName) => void
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
            id={makeFigmaId("text-annotations")}
            style={{ pointerEvents: "none" }}
        >
            {series.map((series, index) => {
                if (!series.annotationTextWrap) return null
                const emphasis = series.emphasis ?? Emphasis.Default
                return (
                    <React.Fragment key={getSeriesKey(series, index)}>
                        <TextWrapSvg
                            textWrap={series.annotationTextWrap}
                            x={series.labelCoords.x}
                            y={
                                series.labelCoords.y +
                                series.seriesLabel.height +
                                ANNOTATION_PADDING
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
    annotatedLabel,
}: {
    series: PlacedLabelSeries[]
    anchor: "start" | "end"
    onMouseEnter?: (key: SeriesName) => void
    onMouseLeave?: (key: SeriesName) => void
    annotatedLabel?: AnnotatedVerticalLabel
}): React.ReactElement {
    return (
        <g>
            {series.map((series, index) => {
                const x =
                    anchor === "start"
                        ? series.origBounds.x
                        : series.origBounds.x - series.bounds.width
                const rect = (
                    <rect
                        x={roundForSvg(x)}
                        y={roundForSvg(series.bounds.y)}
                        width={roundForSvg(series.bounds.width)}
                        height={roundForSvg(series.bounds.height)}
                        fill="#fff"
                        opacity={0}
                    />
                )
                const dodText =
                    annotatedLabel?.seriesName === series.seriesName
                        ? annotatedLabel.dodText
                        : undefined
                return (
                    <g
                        key={getSeriesKey(series, index)}
                        onMouseEnter={() => onMouseEnter?.(series.seriesName)}
                        onMouseLeave={() => onMouseLeave?.(series.seriesName)}
                        style={dodText ? { cursor: "help" } : undefined}
                    >
                        {dodText ? (
                            <Tippy
                                theme={DOD_TIPPY_PROPS.theme}
                                delay={DOD_TIPPY_PROPS.delay}
                                interactive
                                hideOnClick={false}
                                arrow={false}
                                appendTo={() => document.body}
                                placement="top"
                                onShow={annotatedLabel?.onDodShow}
                                onHide={annotatedLabel?.onDodHide}
                                content={
                                    <AnnotationDodContent text={dodText} />
                                }
                            >
                                {rect}
                            </Tippy>
                        ) : (
                            rect
                        )}
                    </g>
                )
            })}
        </g>
    )
}
