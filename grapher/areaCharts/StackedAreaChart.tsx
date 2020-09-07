import * as React from "react"
import {
    reverse,
    clone,
    last,
    guid,
    pointsToPath,
    getRelativeMouse,
    makeSafeForCSS,
    minBy
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "grapher/core/Grapher"
import { Bounds } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import {
    LineLabelsHelper,
    LineLabel,
    LineLabelsComponent
} from "grapher/lineCharts/LineLabels"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { Tooltip } from "grapher/chart/Tooltip"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { rgb } from "d3-color"
import { EntityDimensionKey } from "grapher/core/GrapherConstants" // todo: remove

export interface StackedAreaValue {
    x: number
    y: number
    origY?: number
    time: number
    isFake?: true
}

export interface StackedAreaSeries {
    entityDimensionKey: EntityDimensionKey // todo: remove
    color: string
    values: StackedAreaValue[]
    classed?: string
    isProjection?: boolean
}

interface AreasProps extends React.SVGAttributes<SVGGElement> {
    dualAxis: DualAxis
    data: StackedAreaSeries[]
    focusKeys: EntityDimensionKey[] // todo: remove
    onHover: (hoverIndex: number | undefined) => void
}

const BLUR_COLOR = "#ddd"

@observer
class Areas extends React.Component<AreasProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @observable hoverIndex?: number

    @action.bound private onCursorMove(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ) {
        const { dualAxis, data } = this.props

        const mouse = getRelativeMouse(this.base.current, ev.nativeEvent)

        if (dualAxis.innerBounds.contains(mouse)) {
            const closestPoint = minBy(data[0].values, d =>
                Math.abs(dualAxis.xAxis.place(d.x) - mouse.x)
            )
            if (closestPoint) {
                const index = data[0].values.indexOf(closestPoint)
                this.hoverIndex = index
            } else {
                this.hoverIndex = undefined
            }
        } else {
            this.hoverIndex = undefined
        }

        this.props.onHover(this.hoverIndex)
    }

    @action.bound private onCursorLeave(
        ev: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGElement>
    ) {
        this.hoverIndex = undefined
        this.props.onHover(this.hoverIndex)
    }

    private seriesIsBlur(series: StackedAreaSeries) {
        return (
            this.props.focusKeys.length > 0 &&
            !this.props.focusKeys.includes(series.entityDimensionKey)
        )
    }

    @computed private get areas(): JSX.Element[] {
        const { dualAxis, data } = this.props
        const { xAxis, yAxis } = dualAxis
        const xBottomLeft = [xAxis.range[0], yAxis.range[0]]
        const xBottomRight = [xAxis.range[1], yAxis.range[0]]

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        let prevPoints = [xBottomLeft, xBottomRight]
        return data.map(series => {
            const mainPoints = series.values.map(
                v => [xAxis.place(v.x), yAxis.place(v.y)] as [number, number]
            )
            const points = mainPoints.concat(reverse(clone(prevPoints)) as any)
            prevPoints = mainPoints

            return (
                <path
                    className={
                        makeSafeForCSS(series.entityDimensionKey) + "-area"
                    }
                    key={series.entityDimensionKey + "-area"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    fill={this.seriesIsBlur(series) ? BLUR_COLOR : series.color}
                    fillOpacity={0.7}
                    clipPath={this.props.clipPath}
                />
            )
        })
    }

    @computed private get borders(): JSX.Element[] {
        const { dualAxis, data } = this.props
        const { xAxis, yAxis } = dualAxis

        // Stacked area chart stacks each series upon the previous series, so we must keep track of the last point set we used
        return data.map(series => {
            const points = series.values.map(
                v => [xAxis.place(v.x), yAxis.place(v.y)] as [number, number]
            )

            return (
                <path
                    className={
                        makeSafeForCSS(series.entityDimensionKey) + "-border"
                    }
                    key={series.entityDimensionKey + "-border"}
                    strokeLinecap="round"
                    d={pointsToPath(points)}
                    stroke={rgb(
                        this.seriesIsBlur(series) ? BLUR_COLOR : series.color
                    )
                        .darker(0.5)
                        .toString()}
                    strokeOpacity={0.7}
                    strokeWidth={0.5}
                    fill="none"
                    clipPath={this.props.clipPath}
                />
            )
        })
    }

    render() {
        const { dualAxis, data } = this.props
        const { xAxis, yAxis } = dualAxis
        const { hoverIndex } = this

        return (
            <g
                ref={this.base}
                className="Areas"
                onMouseMove={this.onCursorMove}
                onMouseLeave={this.onCursorLeave}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
            >
                <rect
                    x={xAxis.range[0]}
                    y={yAxis.range[1]}
                    width={xAxis.range[1] - xAxis.range[0]}
                    height={yAxis.range[0] - yAxis.range[1]}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.areas}
                {this.borders}
                {hoverIndex !== undefined && (
                    <g className="hoverIndicator">
                        {data.map(series => {
                            return this.seriesIsBlur(series) ? null : (
                                <circle
                                    key={series.entityDimensionKey}
                                    cx={xAxis.place(
                                        series.values[hoverIndex].x
                                    )}
                                    cy={yAxis.place(
                                        series.values[hoverIndex].y
                                    )}
                                    r={2}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={xAxis.place(data[0].values[hoverIndex].x)}
                            y1={yAxis.range[0]}
                            x2={xAxis.place(data[0].values[hoverIndex].x)}
                            y2={yAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}
            </g>
        )
    }
}

@observer
export class StackedAreaChart extends React.Component<{
    bounds: Bounds
    grapher: Grapher
}> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed get grapher(): Grapher {
        return this.props.grapher
    }
    @computed get bounds(): Bounds {
        return this.props.bounds
    }
    @computed get transform() {
        return this.props.grapher.stackedAreaTransform
    }

    @computed get midpoints(): number[] {
        let prevY = 0
        return this.transform.stackedData.map(series => {
            const lastValue = last(series.values)
            if (lastValue) {
                const middleY = prevY + (lastValue.y - prevY) / 2
                prevY = lastValue.y
                return middleY
            } else {
                return 0
            }
        })
    }

    @computed get legendItems(): LineLabel[] {
        const { transform, midpoints } = this
        const items = transform.stackedData
            .map((d, i) => ({
                color: d.color,
                entityDimensionKey: d.entityDimensionKey,
                label: this.grapher.getLabelForKey(d.entityDimensionKey),
                yValue: midpoints[i]
            }))
            .reverse()
        return items
    }

    @computed private get legend(): LineLabelsHelper | undefined {
        if (this.grapher.hideLegend) return undefined

        const that = this
        return new LineLabelsHelper({
            get maxWidth() {
                return Math.min(150, that.bounds.width / 3)
            },
            get fontSize() {
                return that.grapher.baseFontSize
            },
            get items() {
                return that.legendItems
            }
        })
    }

    @observable hoverIndex?: number
    @action.bound onHover(hoverIndex: number | undefined) {
        this.hoverIndex = hoverIndex
    }

    @observable hoverKey?: string
    @action.bound onLegendClick(key: EntityDimensionKey) {
        if (this.grapher.showAddEntityControls) {
            this.grapher.isSelectingData = true
        }
    }

    @computed private get dualAxis() {
        const { bounds, legend } = this
        const { xAxis, yAxis } = this.transform
        return new DualAxis({
            bounds: bounds.padRight(legend ? legend.width : 20),
            xAxis,
            yAxis
        })
    }

    @action.bound onLegendMouseOver(key: EntityDimensionKey) {
        this.hoverKey = key
    }

    @action.bound onLegendMouseLeave() {
        this.hoverKey = undefined
    }

    @computed get focusKeys(): string[] {
        return this.hoverKey ? [this.hoverKey] : []
    }

    @computed get isFocusMode(): boolean {
        return this.focusKeys.length > 0
    }

    seriesIsBlur(series: StackedAreaSeries) {
        return (
            this.focusKeys.length > 0 &&
            !this.focusKeys.includes(series.entityDimensionKey)
        )
    }

    @computed private get tooltip(): JSX.Element | undefined {
        if (this.hoverIndex === undefined) return undefined

        const { transform, hoverIndex, dualAxis, grapher } = this

        // Grab the first value to get the year from
        const refValue = transform.stackedData[0].values[hoverIndex]

        // If some data is missing, don't calculate a total
        const someMissing = transform.stackedData.some(
            g => !!g.values[hoverIndex].isFake
        )

        const legendBlockStyle = {
            width: "10px",
            height: "10px",
            display: "inline-block",
            marginRight: "2px"
        }

        return (
            <Tooltip
                tooltipContainer={this.props.grapher}
                x={dualAxis.xAxis.place(refValue.x)}
                y={dualAxis.yAxis.rangeMin + dualAxis.yAxis.rangeSize / 2}
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table style={{ fontSize: "0.9em", lineHeight: "1.4em" }}>
                    <tbody>
                        <tr>
                            <td>
                                <strong>
                                    {this.grapher.formatYearFunction(
                                        refValue.x
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {reverse(clone(transform.stackedData)).map(series => {
                            const value = series.values[hoverIndex]
                            const isBlur = this.seriesIsBlur(series)
                            const textColor = isBlur ? "#ddd" : "#333"
                            const blockColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={series.entityDimensionKey}
                                    style={{ color: textColor }}
                                >
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em"
                                        }}
                                    >
                                        <div
                                            style={{
                                                ...legendBlockStyle,
                                                backgroundColor: blockColor
                                            }}
                                        />{" "}
                                        {grapher.getLabelForKey(
                                            series.entityDimensionKey
                                        )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                        {value.isFake
                                            ? "No data"
                                            : transform.formatYTick(
                                                  value.origY!
                                              )}
                                    </td>
                                </tr>
                            )
                        })}
                        {/* Total */}
                        {!someMissing && (
                            <tr>
                                <td style={{ fontSize: "0.9em" }}>
                                    <div
                                        style={{
                                            ...legendBlockStyle,
                                            backgroundColor: "transparent"
                                        }}
                                    />{" "}
                                    <strong>Total</strong>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    <span>
                                        <strong>
                                            {transform.formatYTick(
                                                transform.stackedData[
                                                    transform.stackedData
                                                        .length - 1
                                                ].values[hoverIndex].y
                                            )}
                                        </strong>
                                    </span>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        // Fancy intro animation

        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid() {
        return guid()
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    options={this.grapher}
                    bounds={this.props.bounds}
                    message={this.transform.failMessage}
                />
            )

        const { grapher, bounds, dualAxis, legend, transform, renderUid } = this
        return (
            <g ref={this.base} className="StackedArea">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        <rect
                            x={dualAxis.innerBounds.x}
                            y={0}
                            width={bounds.width}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <DualAxisComponent
                    isInteractive={grapher.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {legend && (
                        <LineLabelsComponent
                            legend={legend}
                            x={bounds.right - legend.width}
                            yAxis={dualAxis.yAxis}
                            options={grapher}
                            focusKeys={this.focusKeys}
                            onClick={this.onLegendClick}
                            onMouseOver={this.onLegendMouseOver}
                            onMouseLeave={this.onLegendMouseLeave}
                        />
                    )}
                    <Areas
                        dualAxis={dualAxis}
                        data={transform.stackedData}
                        focusKeys={this.focusKeys}
                        onHover={this.onHover}
                    />
                </g>
                {this.tooltip}
            </g>
        )
    }
}
