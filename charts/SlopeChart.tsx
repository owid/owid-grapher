import * as React from "react"
import { intersection, without, uniq } from "./Util"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { LabelledSlopes, SlopeProps } from "./LabelledSlopes"
import { NoData } from "./NoData"
import {
    VerticalColorLegend,
    ScatterColorLegendView
} from "./ScatterColorLegend"
import { isString } from "util"

@observer
export class SlopeChart extends React.Component<{
    bounds: Bounds
    chart: ChartConfig
}> {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get chart(): ChartConfig {
        return this.props.chart
    }

    @computed get transform() {
        return this.props.chart.slopeChart
    }

    @computed.struct get bounds(): Bounds {
        return this.props.bounds
    }

    @computed get legend(): VerticalColorLegend {
        const that = this
        return new VerticalColorLegend({
            get maxWidth() {
                return that.sidebarMaxWidth
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get colorables() {
                return that.transform.colors.colorables.filter(c =>
                    that.colorsInUse.includes(c.color)
                )
            }
        })
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.entityDimensionKey
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onSlopeClick() {
        const { chart, hoverKey } = this
        if (chart.addCountryMode === "disabled" || hoverKey === undefined) {
            return
        }

        this.chart.data.toggleKey(hoverKey)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { chart, hoverColor } = this
        if (chart.addCountryMode === "disabled" || hoverColor === undefined)
            return

        const { transform } = this
        const keysToToggle = transform.data
            .filter(g => g.color === hoverColor)
            .map(g => g.entityDimensionKey)
        const allKeysActive =
            intersection(keysToToggle, chart.data.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            chart.data.selectedKeys = without(
                chart.data.selectedKeys,
                ...keysToToggle
            )
        else
            chart.data.selectedKeys = uniq(
                chart.data.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors(): string[] {
        const { colorsInUse: legendColors, transform, chart } = this
        return legendColors.filter(color => {
            const matchingKeys = transform.data
                .filter(g => g.color === color)
                .map(g => g.entityDimensionKey)
            return (
                intersection(matchingKeys, chart.data.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    @computed get focusKeys(): string[] {
        return this.chart.data.selectedKeys
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed.struct get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      transform.data
                          .filter(g => g.color === hoverColor)
                          .map(g => g.entityDimensionKey)
                  )

        if (hoverKey !== undefined) hoverKeys.push(hoverKey)

        return hoverKeys
    }

    // Colors currently on the chart and not greyed out
    @computed get activeColors(): string[] {
        const { hoverKeys, focusKeys, transform } = this
        const activeKeys = hoverKeys.concat(focusKeys)

        if (activeKeys.length === 0)
            // No hover or focus means they're all active by default
            return uniq(transform.data.map(g => g.color))
        else
            return uniq(
                transform.data
                    .filter(
                        g => activeKeys.indexOf(g.entityDimensionKey) !== -1
                    )
                    .map(g => g.color)
            )
    }

    // Only show colors on legend that are actually in use
    @computed get colorsInUse() {
        return uniq(this.transform.data.map(g => g.color))
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width * 0.5
    }
    @computed get sidebarMinWidth() {
        return 100
    }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(
            Math.min(legend.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    // correction is to account for the space taken by the legend
    @computed get innerBounds() {
        const { sidebarWidth, showLegend } = this

        return showLegend
            ? this.props.bounds.padRight(sidebarWidth + 20)
            : this.props.bounds
    }

    // verify the validity of data used to show legend
    // this is for backwards compatibility with charts that were added without legend
    // eg: https://ourworldindata.org/grapher/mortality-rate-improvement-by-cohort
    @computed get showLegend(): boolean {
        const { colorsInUse: legendColors } = this
        const { colorScale } = this.transform.colors

        return colorScale.domain().some(value => {
            if (!isString(value)) {
                return false
            } else {
                return legendColors.indexOf(colorScale(value)) > -1
            }
        })
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoData
                    bounds={this.props.bounds}
                    message={this.transform.failMessage}
                />
            )

        const { bounds, chart } = this.props
        const { yAxis } = chart
        const { data } = this.transform
        const {
            legend,
            focusKeys,
            hoverKeys,
            focusColors,
            activeColors,
            sidebarWidth,
            innerBounds,
            showLegend
        } = this

        return (
            <g>
                <LabelledSlopes
                    bounds={innerBounds}
                    yDomain={yAxis.domain}
                    yTickFormat={this.transform.yTickFormat}
                    yScaleType={yAxis.scaleType}
                    yScaleTypeOptions={yAxis.scaleTypeOptions}
                    onScaleTypeChange={scaleType => {
                        chart.yAxis.scaleType = scaleType
                    }}
                    data={data}
                    fontSize={chart.baseFontSize}
                    focusKeys={focusKeys}
                    hoverKeys={hoverKeys}
                    onMouseOver={this.onSlopeMouseOver}
                    onMouseLeave={this.onSlopeMouseLeave}
                    onClick={this.onSlopeClick}
                />
                {showLegend ? (
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
                ) : (
                    <div></div>
                )}
            </g>
        )
    }
}
