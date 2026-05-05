import * as _ from "lodash-es"
import React from "react"
import {
    Bounds,
    PointVector,
    makeFigmaId,
    pointsToPath,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    DEFAULT_LINE_COLOR,
    DEFAULT_LINE_OUTLINE_WIDTH,
    DEFAULT_MARKER_RADIUS,
    DEFAULT_STROKE_WIDTH,
    DISCONNECTED_DOTS_MARKER_RADIUS,
    LINE_STYLE,
    PlacedLineChartSeries,
    RenderLineChartSeries,
} from "./LineChartConstants"
import { Emphasis } from "../interaction/Emphasis"
import { getSeriesKey } from "../chart/ChartUtils"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"
import { MultiColorPolyline } from "../scatterCharts/MultiColorPolyline"
import { DualAxis } from "../axis/Axis.js"

export interface LinesProps {
    dualAxis: DualAxis
    series: RenderLineChartSeries[]
    hidePoints?: boolean
    lineStrokeWidth?: number
    lineOutlineWidth?: number
    markerRadius?: number
    isStatic?: boolean
    multiColor?: boolean
}

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

    @computed private get baseStrokeWidth(): number {
        return this.props.lineStrokeWidth ?? DEFAULT_STROKE_WIDTH
    }

    @computed private get outlineWidth(): number {
        return this.props.lineOutlineWidth ?? DEFAULT_LINE_OUTLINE_WIDTH
    }

    @computed private get outlineColor(): string {
        return GRAPHER_BACKGROUND
    }

    /**
     * Don't display point markers if there are very many of them for
     * performance reasons
     *
     * Note that we're using circle elements instead of marker-mid because
     * marker performance in Safari 10 is very poor for some reason
     */
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
        // Don't show markers for projected data
        if (series.isProjection) return false

        // If the series has a line, but there is another one that hasn't, then
        // don't show markers since the plotted line is likely a smoothed version
        if (this.hasMarkersOnlySeries && !series.plotMarkersOnly) return false

        return series.emphasis !== Emphasis.Muted
    }

    private renderLine(
        series: RenderLineChartSeries
    ): React.ReactElement | undefined {
        if (series.plotMarkersOnly) return
        const { isProjection } = series

        const style = LINE_STYLE[series.emphasis]

        const color = series.placedPoints[0]?.color ?? DEFAULT_LINE_COLOR

        const strokeWidth = style.strokeWidthFactor * this.baseStrokeWidth
        const strokeOpacity = style.opacity
        const strokeDasharray = isProjection ? "2,3" : undefined

        const showOutline = style.showOutline
        const outlineColor = this.outlineColor
        const outlineWidth = strokeWidth + this.outlineWidth * 2

        const outline = (
            <LinePath
                id={makeFigmaId("outline", series.displayName)}
                placedPoints={series.placedPoints}
                stroke={outlineColor}
                strokeWidth={outlineWidth.toFixed(1)}
            />
        )

        const lineId = makeFigmaId("line", series.seriesName)
        const pointGroups = getAdjacentPointGroups(series.placedPoints)
        const line = this.props.multiColor ? (
            <g id={lineId}>
                <GapLines
                    pointGroups={pointGroups}
                    strokeWidth={strokeWidth.toFixed(1)}
                    strokeOpacity={strokeOpacity}
                    strokeDasharray={strokeDasharray}
                />
                {pointGroups.map((pointGroup, index) => (
                    <MultiColorPolyline
                        key={index}
                        points={pointGroup}
                        strokeLinejoin="round"
                        strokeWidth={strokeWidth.toFixed(1)}
                        strokeDasharray={strokeDasharray}
                        strokeOpacity={strokeOpacity}
                    />
                ))}
            </g>
        ) : (
            <LinePath
                id={lineId}
                placedPoints={series.placedPoints}
                pointGroups={pointGroups}
                showGapLines
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

        const opacity = LINE_STYLE[series.emphasis].opacity

        const outlineColor = series.plotMarkersOnly
            ? this.outlineColor
            : undefined
        const outlineWidth = series.plotMarkersOnly
            ? this.outlineWidth
            : undefined
        const singletonPoints = new Set(
            getSingletonPoints(getAdjacentPointGroups(series.placedPoints))
        )

        return (
            <g id={makeFigmaId("datapoints", series.displayName)}>
                {series.placedPoints.map((value, index) => (
                    <circle
                        id={makeFigmaId(horizontalAxis.formatTick(value.time))}
                        key={index}
                        cx={value.x}
                        cy={value.y}
                        r={
                            singletonPoints.has(value)
                                ? Math.max(
                                      this.markerRadius,
                                      DISCONNECTED_DOTS_MARKER_RADIUS
                                  )
                                : this.markerRadius
                        }
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
        return <g id={makeFigmaId("lines")}>{this.renderLines()}</g>
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
    pointGroups?: PlacedLineChartSeries["placedPoints"][]
    showGapLines?: boolean
}

export function getAdjacentPointGroups(
    placedPoints: PlacedLineChartSeries["placedPoints"]
): PlacedLineChartSeries["placedPoints"][] {
    const groups: PlacedLineChartSeries["placedPoints"][] = []

    for (const point of placedPoints) {
        const currentGroup = _.last(groups)
        const previousPoint = currentGroup && _.last(currentGroup)

        if (
            currentGroup === undefined ||
            previousPoint === undefined ||
            point.time !== previousPoint.time + 1
        ) {
            groups.push([point])
        } else {
            currentGroup.push(point)
        }
    }

    return groups
}

export function getGapLineSegments(
    pointGroups: PlacedLineChartSeries["placedPoints"][]
): PlacedLineChartSeries["placedPoints"][] {
    const gapLineSegments: PlacedLineChartSeries["placedPoints"][] = []

    for (let index = 0; index < pointGroups.length - 1; index++) {
        const pointGroup = pointGroups[index]
        const nextPointGroup = pointGroups[index + 1]
        const lastPoint = _.last(pointGroup)
        const firstPoint = nextPointGroup[0]

        const color = lastPoint?.color ?? firstPoint?.color
        const adaptedColor = `oklch(from ${color} calc(l * 1.5) calc(c * 0.4) h)`

        if (lastPoint && firstPoint) {
            gapLineSegments.push([
                { ...lastPoint, color: adaptedColor },
                { ...firstPoint, color: adaptedColor },
            ])
        }
    }

    return gapLineSegments
}

export function getSingletonPoints(
    pointGroups: PlacedLineChartSeries["placedPoints"][]
): PlacedLineChartSeries["placedPoints"] {
    const singletonPoints: PlacedLineChartSeries["placedPoints"] = []

    for (const pointGroup of pointGroups) {
        if (pointGroup.length === 1) singletonPoints.push(pointGroup[0])
    }

    return singletonPoints
}

function GapLines(
    props: Omit<
        React.ComponentProps<typeof MultiColorPolyline>,
        "points" | "ref"
    > & {
        pointGroups: PlacedLineChartSeries["placedPoints"][]
    }
): React.ReactElement | null {
    const { pointGroups, ...polylineProps } = props
    const gapLineSegments = getGapLineSegments(pointGroups)

    if (gapLineSegments.length === 0) return null

    return (
        <>
            {gapLineSegments.map((segment, index) => (
                <MultiColorPolyline
                    key={index}
                    points={segment}
                    strokeLinejoin="round"
                    {...polylineProps}
                />
            ))}
        </>
    )
}

function LinePath(props: LinePathProps): React.ReactElement {
    const { placedPoints, pointGroups, showGapLines, id, ...pathProps } = props
    const adjacentPointGroups =
        pointGroups ?? getAdjacentPointGroups(placedPoints)
    const commonPathProps = {
        fill: "none",
        strokeLinecap: "butt",
        strokeLinejoin: "round",
        stroke: DEFAULT_LINE_COLOR,
        ...pathProps,
    } satisfies React.SVGProps<SVGPathElement>

    if (adjacentPointGroups.length <= 1) {
        return (
            <path id={id} {...commonPathProps} d={pointsToPath(placedPoints)} />
        )
    }

    return (
        <g id={id}>
            {showGapLines && (
                <GapLines
                    pointGroups={adjacentPointGroups}
                    strokeWidth={(pathProps.strokeWidth as number) / 2.5}
                    // strokeOpacity={0.7}
                    strokeDasharray={pathProps.strokeDasharray}
                />
            )}
            {adjacentPointGroups.map((group, index) => (
                <path
                    key={index}
                    {...commonPathProps}
                    d={pointsToPath(group)}
                />
            ))}
        </g>
    )
}
