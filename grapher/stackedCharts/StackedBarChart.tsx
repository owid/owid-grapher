import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { uniq, makeSafeForCSS } from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import {
    VerticalAxisComponent,
    AxisTickMarks,
    VerticalAxisGridLines,
} from "grapher/axis/AxisViews"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import { Text } from "grapher/text/Text"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { BASE_FONT_SIZE, SeriesName } from "grapher/core/GrapherConstants"
import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import {
    AbstactStackedChart,
    AbstactStackedChartProps,
} from "./AbstractStackedChart"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { VerticalAxis } from "grapher/axis/Axis"
import { ColorSchemeName } from "grapher/color/ColorConstants"
import { stackSeries, withZeroesAsInterpolatedPoints } from "./StackedUtils"
import { makeClipPath } from "grapher/chart/ChartUtils"

interface StackedBarSegmentProps extends React.SVGAttributes<SVGGElement> {
    bar: StackedPoint
    series: StackedSeries
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver: (bar: StackedPoint, series: StackedSeries) => void
    onBarMouseLeave: () => void
}

@observer
class StackedBarSegment extends React.Component<StackedBarSegmentProps> {
    base: React.RefObject<SVGRectElement> = React.createRef()

    @observable mouseOver: boolean = false

    @computed get yPos() {
        const { bar, yAxis } = this.props
        return yAxis.place(bar.y + bar.yOffset)
    }

    @computed get barHeight() {
        const { bar, yAxis } = this.props
        return yAxis.place(bar.yOffset) - this.yPos
    }

    @computed get trueOpacity() {
        return this.mouseOver ? 1 : this.props.opacity
    }

    @action.bound onBarMouseOver() {
        this.mouseOver = true
        this.props.onBarMouseOver(this.props.bar, this.props.series)
    }

    @action.bound onBarMouseLeave() {
        this.mouseOver = false
        this.props.onBarMouseLeave()
    }

    render() {
        const { color, xOffset, barWidth } = this.props
        const { yPos, barHeight, trueOpacity } = this

        return (
            <rect
                ref={this.base}
                x={xOffset}
                y={yPos}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={trueOpacity}
                onMouseOver={this.onBarMouseOver}
                onMouseLeave={this.onBarMouseLeave}
            />
        )
    }
}

@observer
export class StackedBarChart
    extends AbstactStackedChart
    implements VerticalColorLegendManager, ColorScaleManager {
    readonly minBarSpacing = 4

    constructor(props: AbstactStackedChartProps) {
        super(props)
    }

    // currently hovered legend color
    @observable hoverColor?: string
    // current hovered individual bar
    @observable hoverBar?: StackedPoint
    @observable hoverSeries?: StackedSeries

    @computed private get baseFontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get tickFontSize() {
        return 0.9 * this.baseFontSize
    }

    @computed get barWidth() {
        const { dualAxis } = this

        return (0.8 * dualAxis.innerBounds.width) / this.xValues.length
    }

    @computed get barSpacing() {
        return (
            this.dualAxis.innerBounds.width / this.xValues.length -
            this.barWidth
        )
    }

    @computed get barFontSize() {
        return 0.75 * this.baseFontSize
    }

    @computed protected get paddingForLegend() {
        return this.sidebarWidth + 20
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys() {
        const { hoverColor } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        return hoverKeys
    }

    @computed get activeColors() {
        const { hoverKeys } = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : []

        if (!activeKeys.length)
            // No hover means they're all active by default
            return uniq(this.series.map((g) => g.color))

        return uniq(
            this.series
                .filter((g) => activeKeys.indexOf(g.seriesName) !== -1)
                .map((g) => g.color)
        )
    }

    @computed get legendItems() {
        return this.series
            .map((series) => {
                return {
                    label: series.seriesName,
                    color: series.color,
                }
            })
            .reverse() // Vertical legend orders things in the opposite direction we want
    }

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width / 5
    }
    @computed get sidebarMinWidth() {
        return 100
    }
    @computed get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legendDimensions } = this
        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get tooltip() {
        const {
            hoverBar,
            mapXValueToOffset,
            barWidth,
            dualAxis,
            yColumns,
            inputTable,
            hoverSeries,
        } = this
        if (hoverBar === undefined) return

        const xPos = mapXValueToOffset.get(hoverBar.x)
        if (xPos === undefined) return

        const yPos = dualAxis.verticalAxis.place(hoverBar.yOffset + hoverBar.y)

        const yColumn = yColumns[0] // we can just use the first column for formatting, b/c we assume all columns have same type
        return (
            <Tooltip
                tooltipManager={this.props.manager}
                x={xPos + barWidth}
                y={yPos}
                style={{ textAlign: "center" }}
            >
                <h3
                    style={{
                        padding: "0.3em 0.9em",
                        margin: 0,
                        backgroundColor: "#fcfcfc",
                        borderBottom: "1px solid #ebebeb",
                        fontWeight: "normal",
                        fontSize: "1em",
                    }}
                >
                    {hoverSeries?.seriesName}
                </h3>
                <p
                    style={{
                        margin: 0,
                        padding: "0.3em 0.9em",
                        fontSize: "0.8em",
                    }}
                >
                    <span>{yColumn.formatValueLong(hoverBar.y)}</span>
                    <br />
                    in
                    <br />
                    <span>
                        {inputTable.timeColumnFormatFunction(hoverBar.x)}
                    </span>
                </p>
            </Tooltip>
        )
    }

    @computed get mapXValueToOffset() {
        const { dualAxis, barWidth, barSpacing } = this

        const xValueToOffset = new Map<number, number>()
        let xOffset = dualAxis.innerBounds.left + barSpacing

        for (let i = 0; i < this.xValues.length; i++) {
            xValueToOffset.set(this.xValues[i], xOffset)
            xOffset += barWidth + barSpacing
        }
        return xValueToOffset
    }

    // Place ticks centered beneath the bars, before doing overlap detection
    @computed private get tickPlacements() {
        const { mapXValueToOffset, barWidth, dualAxis } = this
        const { xValues } = this
        const { horizontalAxis } = dualAxis

        return xValues.map((x) => {
            const text = horizontalAxis.formatTick(x)
            const xPos = mapXValueToOffset.get(x) as number

            const bounds = Bounds.forText(text, { fontSize: this.tickFontSize })
            return {
                text,
                bounds: bounds.extend({
                    x: xPos + barWidth / 2 - bounds.width / 2,
                    y: dualAxis.innerBounds.bottom + 5,
                }),
                isHidden: false,
            }
        })
    }

    @computed get ticks() {
        const { tickPlacements } = this

        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i],
                    t2 = tickPlacements[j]

                if (t1 === t2 || t1.isHidden || t2.isHidden) continue

                if (t1.bounds.intersects(t2.bounds.padWidth(-5))) {
                    if (i === 0) t2.isHidden = true
                    else if (j === tickPlacements.length - 1) t1.isHidden = true
                    else t2.isHidden = true
                }
            }
        }

        return tickPlacements.filter((t) => !t.isHidden)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    @action.bound onLegendClick() {}

    @action.bound onBarMouseOver(bar: StackedPoint, series: StackedSeries) {
        this.hoverBar = bar
        this.hoverSeries = series
    }

    @action.bound onBarMouseLeave() {
        this.hoverBar = undefined
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            dualAxis,
            renderUid,
            bounds,
            tooltip,
            barWidth,
            mapXValueToOffset,
            ticks,
        } = this
        const { series } = this
        const { innerBounds, verticalAxis } = dualAxis

        const textColor = "#666"

        const clipPath = makeClipPath(renderUid, innerBounds)

        return (
            <g
                className="StackedBarChart"
                width={bounds.width}
                height={bounds.height}
            >
                {clipPath.element}

                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <VerticalAxisComponent
                    bounds={bounds}
                    verticalAxis={verticalAxis}
                />
                <VerticalAxisGridLines
                    verticalAxis={verticalAxis}
                    bounds={innerBounds}
                />

                <AxisTickMarks
                    tickMarkTopPosition={innerBounds.bottom}
                    tickMarkXPositions={ticks.map(
                        (tick) => tick.bounds.centerX
                    )}
                    color={textColor}
                />

                <g>
                    {ticks.map((tick, i) => {
                        return (
                            <Text
                                key={i}
                                x={tick.bounds.x}
                                y={tick.bounds.y}
                                fill={textColor}
                                fontSize={this.tickFontSize}
                            >
                                {tick.text}
                            </Text>
                        )
                    })}
                </g>

                <g clipPath={clipPath.id}>
                    {series.map((series, index) => {
                        const isLegendHovered = this.hoverKeys.includes(
                            series.seriesName
                        )
                        const opacity =
                            isLegendHovered || this.hoverKeys.length === 0
                                ? 0.8
                                : 0.2

                        return (
                            <g
                                key={index}
                                className={
                                    makeSafeForCSS(series.seriesName) +
                                    "-segments"
                                }
                            >
                                {series.points.map((bar, index) => {
                                    const xPos = mapXValueToOffset.get(
                                        bar.x
                                    ) as number
                                    const barOpacity =
                                        bar === this.hoverBar ? 1 : opacity

                                    return (
                                        <StackedBarSegment
                                            key={index}
                                            bar={bar}
                                            color={series.color}
                                            xOffset={xPos}
                                            opacity={barOpacity}
                                            yAxis={verticalAxis}
                                            series={series}
                                            onBarMouseOver={this.onBarMouseOver}
                                            onBarMouseLeave={
                                                this.onBarMouseLeave
                                            }
                                            barWidth={barWidth}
                                        />
                                    )
                                })}
                            </g>
                        )
                    })}
                </g>

                <VerticalColorLegend manager={this} />
                {tooltip}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX() {
        return this.bounds.right - this.sidebarWidth
    }

    @computed private get xValues() {
        return uniq(this.allStackedPoints.map((bar) => bar.x))
    }

    @computed get colorScale() {
        return new ColorScale(this)
    }

    getColorForSeries(seriesName: SeriesName) {
        const table = this.transformedTable
        const color = this.isEntitySeries
            ? table.getColorForEntityName(seriesName)
            : table.getColorForColumnByDisplayName(seriesName)
        return color ?? this.colorScale.getColor(seriesName) ?? "#ddd"
    }

    @computed get colorScaleConfig() {
        return this.manager.colorScale
    }

    defaultBaseColorScheme = ColorSchemeName.stackedAreaDefault

    @computed get categoricalValues() {
        return this.rawSeries.map((series) => series.seriesName).reverse()
    }

    @computed get series() {
        return stackSeries(withZeroesAsInterpolatedPoints(this.unstackedSeries))
    }
}
