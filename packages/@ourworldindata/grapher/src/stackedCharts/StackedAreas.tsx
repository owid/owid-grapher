import * as _ from "lodash-es"
import * as React from "react"
import {
    pointsToPath,
    makeSafeForCSS,
    Time,
    lastOfNonEmptyArray,
    makeIdForHumanConsumption,
    bind,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { SeriesName } from "@ourworldindata/types"
import { observer } from "mobx-react"
import { DualAxis } from "../axis/Axis"
import { rgb } from "d3-color"
import {
    AREA_OPACITY,
    BORDER_OPACITY,
    BORDER_WIDTH,
    StackedPlacedPoint,
    StackedPlacedSeries,
    StackedPoint,
    StackedSeries,
} from "./StackedConstants"

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    seriesArr: readonly StackedSeries<Time>[]
    hoveredSeriesName?: SeriesName
    onAreaMouseEnter?: (seriesName: SeriesName) => void
    onAreaMouseLeave?: () => void
}

@observer
export class StackedAreas extends React.Component<AreasProps> {
    constructor(props: AreasProps) {
        super(props)
        makeObservable(this)
    }

    @bind placePoint(point: StackedPoint<number>): StackedPlacedPoint {
        const { dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis
        return [
            horizontalAxis.place(point.position),
            verticalAxis.place(point.value + point.valueOffset),
        ]
    }

    // This places a whole series, but the points only represent the top of the area.
    // Later steps are necessary to display them as a filled area.
    @bind placeSeries(
        series: StackedSeries<number>
    ): Array<StackedPlacedPoint> {
        const { dualAxis } = this.props
        const { horizontalAxis, verticalAxis } = dualAxis

        if (series.points.length > 1) {
            return series.points.map(this.placePoint)
        } else if (series.points.length === 1) {
            // We only have one point, so make it so it stretches out over the whole x axis range
            // There are two cases here that we need to consider:
            // (1) In unfaceted charts, the x domain will be a single year, so we need to ensure that the area stretches
            //     out over the full range of the x axis.
            // (2) In faceted charts, the x domain may span multiple years, so we need to ensure that the area stretches
            //     out only over year - 0.5 to year + 0.5, additionally making sure we don't put points outside the x range.
            //
            // -@marcelgerber, 2023-04-24
            const point = series.points[0]
            const y = verticalAxis.place(point.value + point.valueOffset)
            const singleValueXDomain =
                horizontalAxis.domain[0] === horizontalAxis.domain[1]

            if (singleValueXDomain) {
                // Case (1)
                return [
                    [horizontalAxis.range[0], y],
                    [horizontalAxis.range[1], y],
                ]
            } else {
                // Case (2)
                const leftX = Math.max(
                    horizontalAxis.place(point.position - 0.5),
                    horizontalAxis.range[0]
                )
                const rightX = Math.min(
                    horizontalAxis.place(point.position + 0.5),
                    horizontalAxis.range[1]
                )

                return [
                    [leftX, y],
                    [rightX, y],
                ]
            }
        } else return []
    }

    @computed get placedSeriesArr(): StackedPlacedSeries<number>[] {
        const { seriesArr } = this.props
        return seriesArr
            .filter((series) => !series.isAllZeros)
            .map((series) => ({
                ...series,
                placedPoints: this.placeSeries(series),
            }))
    }

    @computed get isHoverModeActive(): boolean {
        return this.props.hoveredSeriesName !== undefined
    }

    @computed get isFocusModeActive(): boolean {
        return this.props.seriesArr.some((series) => series.focus?.active)
    }

    @computed private get areas(): React.ReactElement[] {
        const { placedSeriesArr } = this
        const { dualAxis, hoveredSeriesName } = this.props
        const { verticalAxis } = dualAxis

        return placedSeriesArr.map((series, index) => {
            const { placedPoints } = series
            let prevPoints: Array<StackedPlacedPoint>
            if (index > 0) {
                prevPoints = placedSeriesArr[index - 1].placedPoints
            } else {
                prevPoints = [
                    [
                        placedPoints[0][0], // placed x coord of first (= leftmost) point in chart
                        verticalAxis.range[0],
                    ],
                    [
                        lastOfNonEmptyArray(placedPoints)[0], // placed x coord of last (= rightmost) point in chart
                        verticalAxis.range[0],
                    ],
                ]
            }
            const points = [...placedPoints, ...prevPoints.toReversed()]
            const opacity =
                !this.isHoverModeActive && !this.isFocusModeActive
                    ? AREA_OPACITY.DEFAULT // normal opacity
                    : hoveredSeriesName === series.seriesName ||
                        series.focus?.active
                      ? AREA_OPACITY.FOCUS // hovered or focused
                      : AREA_OPACITY.MUTE // background

            return (
                <path
                    id={makeIdForHumanConsumption(series.seriesName)}
                    className={makeSafeForCSS(series.seriesName) + "-area"}
                    key={series.seriesName + "-area"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    fill={series.color}
                    fillOpacity={opacity}
                    clipPath={this.props.clipPath}
                    onMouseEnter={(): void => {
                        this.props.onAreaMouseEnter?.(series.seriesName)
                    }}
                    onMouseLeave={(): void => {
                        this.props.onAreaMouseLeave?.()
                    }}
                />
            )
        })
    }

    @computed private get borders(): React.ReactElement[] {
        const { placedSeriesArr } = this
        const { hoveredSeriesName } = this.props

        return placedSeriesArr.map((placedSeries) => {
            const opacity =
                !this.isHoverModeActive && !this.isFocusModeActive
                    ? BORDER_OPACITY.DEFAULT // normal opacity
                    : hoveredSeriesName === placedSeries.seriesName ||
                        placedSeries.focus?.active
                      ? BORDER_OPACITY.FOCUS // hovered or focused
                      : BORDER_OPACITY.MUTE // background
            const strokeWidth =
                hoveredSeriesName === placedSeries.seriesName ||
                placedSeries.focus?.active
                    ? BORDER_WIDTH.FOCUS
                    : BORDER_WIDTH.DEFAULT

            return (
                <path
                    id={makeIdForHumanConsumption(placedSeries.seriesName)}
                    className={
                        makeSafeForCSS(placedSeries.seriesName) + "-border"
                    }
                    key={placedSeries.seriesName + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(placedSeries.placedPoints)}
                    stroke={rgb(placedSeries.color).darker(0.5).toString()}
                    strokeOpacity={opacity}
                    strokeWidth={strokeWidth}
                    fill="none"
                    clipPath={this.props.clipPath}
                    onMouseEnter={(): void => {
                        this.props.onAreaMouseEnter?.(placedSeries.seriesName)
                    }}
                    onMouseLeave={(): void => {
                        this.props.onAreaMouseLeave?.()
                    }}
                />
            )
        })
    }

    override render(): React.ReactElement {
        return (
            <g
                className="Areas"
                id={makeIdForHumanConsumption("stacked-areas")}
            >
                <g id={makeIdForHumanConsumption("areas")}>{this.areas}</g>
                <g id={makeIdForHumanConsumption("borders")}>{this.borders}</g>
            </g>
        )
    }
}
