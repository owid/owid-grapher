import * as _ from "lodash-es"
import React from "react"
import {
    Bounds,
    PointVector,
    makeIdForHumanConsumption,
    pointsToPath,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { GRAPHER_OPACITY_MUTE } from "../core/GrapherConstants"
import {
    DEFAULT_LINE_COLOR,
    DEFAULT_LINE_OUTLINE_WIDTH,
    DEFAULT_MARKER_RADIUS,
    DEFAULT_STROKE_WIDTH,
    LinesProps,
    PlacedLineChartSeries,
    RenderLineChartSeries,
} from "./LineChartConstants"
import { getSeriesKey } from "../chart/ChartUtils"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants"
import { MultiColorPolyline } from "../scatterCharts/MultiColorPolyline"

@observer
export class Lines extends React.Component<LinesProps> {
    constructor(props: LinesProps) {
        super(props)
        makeObservable(this)
    }

    @computed get bounds(): Bounds {
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        return Bounds.fromCorners(
            new PointVector(horizontalAxis.range[0], verticalAxis.range[0]),
            new PointVector(horizontalAxis.range[1], verticalAxis.range[1])
        )
    }

    @computed private get markerRadius(): number {
        return this.props.markerRadius ?? DEFAULT_MARKER_RADIUS
    }

    @computed private get strokeWidth(): number {
        return this.props.lineStrokeWidth ?? DEFAULT_STROKE_WIDTH
    }

    @computed private get outlineWidth(): number {
        return this.props.lineOutlineWidth ?? DEFAULT_LINE_OUTLINE_WIDTH
    }

    @computed private get outlineColor(): string {
        return this.props.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers(): boolean {
        if (this.props.hidePoints) return false
        const totalPoints = _.sum(
            this.props.series
                .filter((series) => this.seriesHasMarkers(series))
                .map((series) => series.placedPoints.length)
        )
        return totalPoints < 500
    }

    @computed private get hasMarkersOnlySeries(): boolean {
        return this.props.series.some((series) => series.plotMarkersOnly)
    }

    private seriesHasMarkers(series: RenderLineChartSeries): boolean {
        if (
            series.hover.background ||
            series.isProjection ||
            // if the series has a line, but there is another one that hasn't, then
            // don't show markers since the plotted line is likely a smoothed version
            (this.hasMarkersOnlySeries && !series.plotMarkersOnly)
        )
            return false
        return !series.focus.background || series.hover.active
    }

    private seriesIsInForeground(series: RenderLineChartSeries): boolean {
        return (
            series.hover.active ||
            series.focus.active ||
            (series.focus.idle && series.hover.idle)
        )
    }

    private renderLine(
        series: RenderLineChartSeries
    ): React.ReactElement | undefined {
        if (series.plotMarkersOnly) return
        const { isProjection } = series

        const isInForeground = this.seriesIsInForeground(series)

        const color = series.placedPoints[0]?.color ?? DEFAULT_LINE_COLOR

        const strokeDasharray = isProjection ? "2,3" : undefined
        const strokeWidth = isInForeground
            ? this.strokeWidth
            : 0.66 * this.strokeWidth
        const strokeOpacity = isInForeground ? 1 : GRAPHER_OPACITY_MUTE

        const showOutline = isInForeground
        const outlineColor = this.outlineColor
        const outlineWidth = strokeWidth + this.outlineWidth * 2

        const outline = (
            <LinePath
                id={makeIdForHumanConsumption("outline", series.displayName)}
                placedPoints={series.placedPoints}
                stroke={outlineColor}
                strokeWidth={outlineWidth.toFixed(1)}
            />
        )

        const line = this.props.multiColor ? (
            <MultiColorPolyline
                id={makeIdForHumanConsumption("line", series.seriesName)}
                points={series.placedPoints}
                strokeLinejoin="round"
                strokeWidth={strokeWidth.toFixed(1)}
                strokeDasharray={strokeDasharray}
                strokeOpacity={strokeOpacity}
            />
        ) : (
            <LinePath
                id={makeIdForHumanConsumption("line", series.seriesName)}
                placedPoints={series.placedPoints}
                stroke={color}
                strokeWidth={strokeWidth.toFixed(1)}
                strokeOpacity={strokeOpacity}
                strokeDasharray={strokeDasharray}
            />
        )

        return (
            <>
                {showOutline && outline}
                {line}
            </>
        )
    }

    private renderLineMarkers(
        series: RenderLineChartSeries
    ): React.ReactElement | undefined {
        const { horizontalAxis } = this.props.dualAxis

        const forceMarkers =
            // If the series only contains one point, then we will always want to
            // show a marker/circle because we can't draw a line.
            series.placedPoints.length === 1 ||
            // If no line is plotted, we'll always want to show markers
            series.plotMarkersOnly

        // check if we should hide markers on the chart and series level
        const hideMarkers = !this.hasMarkers || !this.seriesHasMarkers(series)

        if (hideMarkers && !forceMarkers) return

        const opacity = this.seriesIsInForeground(series)
            ? 1
            : GRAPHER_OPACITY_MUTE

        const outlineColor = series.plotMarkersOnly
            ? this.outlineColor
            : undefined
        const outlineWidth = series.plotMarkersOnly
            ? this.outlineWidth
            : undefined

        return (
            <g id={makeIdForHumanConsumption("datapoints", series.displayName)}>
                {series.placedPoints.map((value, index) => (
                    <circle
                        id={makeIdForHumanConsumption(
                            horizontalAxis.formatTick(value.time)
                        )}
                        key={index}
                        cx={value.x}
                        cy={value.y}
                        r={this.markerRadius}
                        fill={value.color}
                        stroke={outlineColor}
                        strokeWidth={outlineWidth}
                        opacity={opacity}
                    />
                ))}
            </g>
        )
    }

    private renderLines(): React.ReactElement {
        return (
            <>
                {this.props.series.map((series, index) => (
                    <React.Fragment key={getSeriesKey(series, index)}>
                        {this.renderLine(series)}
                        {this.renderLineMarkers(series)}
                    </React.Fragment>
                ))}
            </>
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("lines")}>{this.renderLines()}</g>
        )
    }

    private renderInteractive(): React.ReactElement {
        const { bounds } = this
        return (
            <g className="Lines">
                <rect
                    x={Math.round(bounds.x)}
                    y={Math.round(bounds.y)}
                    width={Math.round(bounds.width)}
                    height={Math.round(bounds.height)}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderLines()}
            </g>
        )
    }

    override render(): React.ReactElement {
        return this.props.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}

interface LinePathProps extends React.SVGProps<SVGPathElement> {
    placedPoints: PlacedLineChartSeries["placedPoints"]
}

function LinePath(props: LinePathProps): React.ReactElement {
    const { placedPoints, ...pathProps } = props
    const coords = placedPoints.map(({ x, y }) => [x, y] as [number, number])
    return (
        <path
            fill="none"
            strokeLinecap="butt"
            strokeLinejoin="round"
            stroke={DEFAULT_LINE_COLOR}
            {...pathProps}
            d={pointsToPath(coords)}
        />
    )
}
