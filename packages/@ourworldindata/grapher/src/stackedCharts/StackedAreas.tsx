import * as React from "react"
import {
    pointsToPath,
    makeSafeForCSS,
    lastOfNonEmptyArray,
    makeFigmaId,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { SeriesName, Time } from "@ourworldindata/types"
import { observer } from "mobx-react"
import { rgb } from "d3-color"
import {
    AREA_OPACITY,
    BORDER_OPACITY,
    BORDER_WIDTH,
    StackedPlacedPoint,
    StackedPlacedSeries,
} from "./StackedConstants"

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    series: StackedPlacedSeries<Time>[]
    baselineY: number
    onAreaMouseEnter?: (seriesName: SeriesName) => void
    onAreaMouseLeave?: () => void
}

@observer
export class StackedAreas extends React.Component<AreasProps> {
    constructor(props: AreasProps) {
        super(props)
        makeObservable(this)
    }

    @computed get isHoverModeActive(): boolean {
        return this.props.series.some((series) => series.hover?.active)
    }

    @computed get isFocusModeActive(): boolean {
        return this.props.series.some((series) => series.focus?.active)
    }

    @computed private get areas(): React.ReactElement[] {
        const { baselineY } = this.props

        return this.props.series.map((series, index) => {
            const { placedPoints } = series
            let prevPoints: Array<StackedPlacedPoint>
            if (index > 0) {
                prevPoints = this.props.series[index - 1].placedPoints
            } else {
                prevPoints = [
                    [
                        placedPoints[0][0], // placed x coord of first (= leftmost) point in chart
                        baselineY,
                    ],
                    [
                        lastOfNonEmptyArray(placedPoints)[0], // placed x coord of last (= rightmost) point in chart
                        baselineY,
                    ],
                ]
            }
            const points = [...placedPoints, ...prevPoints.toReversed()]
            const opacity =
                !this.isHoverModeActive && !this.isFocusModeActive
                    ? AREA_OPACITY.DEFAULT // normal opacity
                    : series.hover?.active || series.focus?.active
                      ? AREA_OPACITY.FOCUS // hovered or focused
                      : AREA_OPACITY.MUTE // background

            return (
                <path
                    id={makeFigmaId(series.seriesName)}
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
        const { series } = this.props

        return series.map((series) => {
            const opacity =
                !this.isHoverModeActive && !this.isFocusModeActive
                    ? BORDER_OPACITY.DEFAULT // normal opacity
                    : series.hover?.active || series.focus?.active
                      ? BORDER_OPACITY.FOCUS // hovered or focused
                      : BORDER_OPACITY.MUTE // background
            const strokeWidth =
                series.hover?.active || series.focus?.active
                    ? BORDER_WIDTH.FOCUS
                    : BORDER_WIDTH.DEFAULT

            return (
                <path
                    id={makeFigmaId(series.seriesName)}
                    className={makeSafeForCSS(series.seriesName) + "-border"}
                    key={series.seriesName + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(series.placedPoints)}
                    stroke={rgb(series.color).darker(0.5).toString()}
                    strokeOpacity={opacity}
                    strokeWidth={strokeWidth}
                    fill="none"
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

    override render(): React.ReactElement {
        return (
            <g className="Areas" id={makeFigmaId("stacked-areas")}>
                <g id={makeFigmaId("areas")}>{this.areas}</g>
                <g id={makeFigmaId("borders")}>{this.borders}</g>
            </g>
        )
    }
}
