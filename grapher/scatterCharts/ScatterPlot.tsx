/* ScatterPlot.tsx
 * ================
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as React from "react"
import { observable, computed, action } from "mobx"
import {
    intersection,
    without,
    compact,
    uniq,
    first,
    last,
    excludeUndefined,
    flatten,
} from "grapher/utils/Util"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import {
    PointsWithLabels,
    ScatterSeries,
    ScatterValue,
} from "./PointsWithLabels"
import { TextWrap } from "grapher/text/TextWrap"
import { ConnectedScatterLegend } from "./ConnectedScatterLegend"
import {
    VerticalColorLegend,
    ScatterColorLegendView,
} from "./ScatterColorLegend"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { ComparisonLine } from "./ComparisonLine"
import { EntityDimensionKey } from "grapher/core/GrapherConstants"
import { TimeBound } from "grapher/utils/TimeBounds"

@observer
export class ScatterPlot extends React.Component<{
    bounds: Bounds
    grapher: Grapher
}> {
    // Set default props
    static defaultProps = {
        bounds: new Bounds(0, 0, 640, 480),
    }

    // currently hovered individual series key
    @observable hoverKey?: EntityDimensionKey
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get grapher(): Grapher {
        return this.props.grapher
    }

    @computed get transform() {
        return this.grapher.scatterTransform
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @action.bound onSelectEntity(key: EntityDimensionKey) {
        if (this.grapher.addCountryMode !== "disabled")
            this.grapher.toggleKey(key)
    }

    // Only want to show colors on legend that are actually on the chart right now
    @computed get colorsInUse(): string[] {
        return excludeUndefined(
            uniq(
                this.transform.allPoints.map((point) =>
                    this.transform.colorScale.getColor(point.color)
                )
            )
        )
    }

    @computed get legend(): VerticalColorLegend {
        const that = this
        return new VerticalColorLegend({
            get maxWidth() {
                return that.sidebarMaxWidth
            },
            get fontSize() {
                return that.grapher.baseFontSize
            },
            get colorables() {
                return that.transform.colorScale.legendData
                    .filter((bin) => that.colorsInUse.includes(bin.color))
                    .map((bin) => {
                        return {
                            key: bin.label ?? "",
                            label: bin.label ?? "",
                            color: bin.color,
                        }
                    })
            },
            get title() {
                return that.transform.colorScale.legendDescription
            },
        })
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { grapher, hoverColor } = this
        if (grapher.addCountryMode === "disabled" || hoverColor === undefined)
            return

        const { transform } = this
        const keysToToggle = transform.currentData
            .filter((g) => g.color === hoverColor)
            .map((g) => g.entityDimensionKey)
        const allKeysActive =
            intersection(keysToToggle, grapher.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            grapher.selectedKeys = without(
                grapher.selectedKeys,
                ...keysToToggle
            )
        else
            grapher.selectedKeys = uniq(
                grapher.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed private get focusColors(): string[] {
        const { colorsInUse, transform, grapher } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = transform.currentData
                .filter((g) => g.color === color)
                .map((g) => g.entityDimensionKey)
            return (
                intersection(matchingKeys, grapher.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed private get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      transform.currentData
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityDimensionKey)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    @computed private get focusKeys(): string[] {
        return this.grapher.selectedKeys
    }

    @computed private get arrowLegend(): ConnectedScatterLegend | undefined {
        const { transform } = this
        const { startTime, endTime } = transform

        if (startTime === endTime || transform.isRelativeMode) return undefined

        const that = this
        const formatFn = this.grapher.table.timeColumnFormatFunction
        return new ConnectedScatterLegend({
            get maxWidth() {
                return that.sidebarWidth
            },
            get fontSize() {
                return that.grapher.baseFontSize
            },
            get startTime() {
                return formatFn(that.transform.startTime)
            },
            get endTime() {
                return formatFn(that.transform.endTime)
            },
            get endpointsOnly() {
                return that.transform.compareEndPointsOnly
            },
        })
    }

    @action.bound onScatterMouseOver(series: ScatterSeries) {
        this.hoverKey = series.entityDimensionKey
    }

    @action.bound onScatterMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onScatterClick() {
        if (this.hoverKey) this.onSelectEntity(this.hoverKey)
    }

    @computed get tooltipSeries(): ScatterSeries | undefined {
        const { hoverKey, focusKeys, transform } = this
        if (hoverKey !== undefined)
            return transform.currentData.find(
                (g) => g.entityDimensionKey === hoverKey
            )
        else if (focusKeys && focusKeys.length === 1)
            return transform.currentData.find(
                (g) => g.entityDimensionKey === focusKeys[0]
            )
        else return undefined
    }

    @computed get sidebarMaxWidth() {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }
    @computed get sidebarMinWidth() {
        return Math.max(this.bounds.width * 0.1, 60)
    }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(
            Math.min(legend.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    // todo: Refactor
    @computed private get dualAxis() {
        const { xAxis, yAxis } = this.transform
        const axis = new DualAxis({
            bounds: this.bounds.padRight(this.sidebarWidth + 20),
            xAxis,
            yAxis,
        })

        return axis
    }

    @computed get comparisonLines() {
        return this.grapher.comparisonLines
    }

    @action.bound onToggleEndpoints() {
        this.transform.compareEndPointsOnly = !this.transform
            .compareEndPointsOnly
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoverKeys, focusKeys, transform } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        let series = transform.currentData

        if (activeKeys.length) {
            series = series.filter((g) =>
                activeKeys.includes(g.entityDimensionKey)
            )
        }

        const colorValues = uniq(
            flatten(series.map((s) => s.values.map((p) => p.color)))
        )
        return excludeUndefined(colorValues.map(transform.colorScale.getColor))
    }

    @computed get hideLines(): boolean {
        return !!this.grapher.hideConnectedScatterLines
    }

    @computed private get scatterPointLabelFormatFunction() {
        const scatterPointLabelFormatFunctions = {
            year: (scatterValue: ScatterValue) =>
                this.grapher.table.timeColumnFormatFunction(scatterValue.year),
            y: (scatterValue: ScatterValue) =>
                this.transform.yFormatTooltip(scatterValue.y),
            x: (scatterValue: ScatterValue) =>
                this.transform.xFormatTooltip(scatterValue.x),
        }

        return scatterPointLabelFormatFunctions[
            this.grapher.scatterPointLabelStrategy || "year"
        ]
    }
    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    options={this.grapher}
                    bounds={this.bounds}
                    message={this.transform.failMessage}
                />
            )

        const {
            transform,
            bounds,
            dualAxis,
            legend,
            focusKeys,
            hoverKeys,
            focusColors,
            activeColors,
            arrowLegend,
            sidebarWidth,
            tooltipSeries,
            comparisonLines,
            hideLines,
            grapher,
        } = this
        const { currentData, sizeDomain, colorScale } = transform

        return (
            <g className="ScatterPlot">
                <DualAxisComponent
                    isInteractive={grapher.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={false}
                />
                {comparisonLines &&
                    comparisonLines.map((line, i) => (
                        <ComparisonLine
                            key={i}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                <PointsWithLabels
                    grapher={grapher}
                    hideLines={hideLines}
                    data={currentData}
                    dualAxis={dualAxis}
                    colorScale={
                        this.transform.colorDimension ? colorScale : undefined
                    }
                    sizeDomain={sizeDomain}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onScatterMouseOver}
                    onMouseLeave={this.onScatterMouseLeave}
                    onClick={this.onScatterClick}
                    formatLabel={this.scatterPointLabelFormatFunction}
                />
                <ScatterColorLegendView
                    legend={legend}
                    x={bounds.right - sidebarWidth}
                    y={bounds.top}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                    onClick={this.onLegendClick}
                    focusColors={focusColors}
                    activeColors={activeColors}
                />
                {(arrowLegend || tooltipSeries) && (
                    <line
                        x1={bounds.right - sidebarWidth}
                        y1={bounds.top + legend.height + 2}
                        x2={bounds.right - 5}
                        y2={bounds.top + legend.height + 2}
                        stroke="#ccc"
                    />
                )}
                {arrowLegend && (
                    <g className="clickable" onClick={this.onToggleEndpoints}>
                        {arrowLegend.render(
                            bounds.right - sidebarWidth,
                            bounds.top + legend.height + 11
                        )}
                    </g>
                )}
                {tooltipSeries && (
                    <ScatterTooltip
                        formatY={transform.yFormatTooltip}
                        formatX={transform.xFormatTooltip}
                        formatYYear={transform.yFormatYear}
                        formatXYear={transform.xFormatYear}
                        series={tooltipSeries}
                        maxWidth={sidebarWidth}
                        fontSize={this.grapher.baseFontSize}
                        x={bounds.right - sidebarWidth}
                        y={
                            bounds.top +
                            legend.height +
                            11 +
                            (arrowLegend ? arrowLegend.height + 10 : 0)
                        }
                    />
                )}
            </g>
        )
    }
}

interface ScatterTooltipProps {
    formatY: (value: number) => string
    formatX: (value: number) => string
    formatYYear: (value: number) => string
    formatXYear: (value: number) => string
    series: ScatterSeries
    maxWidth: number
    fontSize: number
    x: number
    y: number
}

@observer
class ScatterTooltip extends React.Component<ScatterTooltipProps> {
    formatValueY(value: ScatterValue) {
        return "Y Axis: " + this.props.formatY(value.y)
        //        if (value.year != value.time.y)
        //            s += " (data from " + value.time.y + ")"
        // return s
    }

    formatValueX(value: ScatterValue) {
        let s = "X Axis: " + this.props.formatX(value.x)
        const formatYear = this.props.formatXYear
        if (!value.time.span && value.time.y !== value.time.x)
            s += ` (data from ${formatYear(value.time.x)})`
        return s
    }

    render() {
        const { x, y, maxWidth, fontSize, series } = this.props
        const lineHeight = 5

        const firstValue = first(series.values)
        const lastValue = last(series.values)
        const values = compact(uniq([firstValue, lastValue]))

        const elements: Array<{ x: number; y: number; wrap: TextWrap }> = []
        let offset = 0

        const heading = {
            x: x,
            y: y + offset,
            wrap: new TextWrap({
                maxWidth: maxWidth,
                fontSize: 0.75 * fontSize,
                text: series.label,
            }),
        }
        elements.push(heading)
        offset += heading.wrap.height + lineHeight

        const { formatYYear } = this.props

        values.forEach((v) => {
            const year = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.65 * fontSize,
                    text: v.time.span
                        ? `${formatYYear(v.time.span[0])} to ${formatYYear(
                              v.time.span[1]
                          )}`
                        : formatYYear(v.time.y),
                }),
            }
            offset += year.wrap.height
            const line1 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueY(v),
                }),
            }
            offset += line1.wrap.height
            const line2 = {
                x: x,
                y: y + offset,
                wrap: new TextWrap({
                    maxWidth: maxWidth,
                    fontSize: 0.55 * fontSize,
                    text: this.formatValueX(v),
                }),
            }
            offset += line2.wrap.height + lineHeight
            elements.push(...[year, line1, line2])
        })

        return (
            <g className="scatterTooltip">
                {elements.map((el, i) =>
                    el.wrap.render(el.x, el.y, { key: i })
                )}
            </g>
        )
    }
}
