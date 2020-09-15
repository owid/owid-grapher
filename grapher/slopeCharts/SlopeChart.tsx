import * as React from "react"
import { intersection, without, uniq } from "grapher/utils/Util"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { LabelledSlopes, SlopeProps } from "./LabelledSlopes"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import {
    VerticalColorLegend,
    ScatterColorLegendView,
} from "grapher/scatterCharts/ScatterColorLegend"
import { SlopeChartOptionsProvider } from "./SlopeChartOptionsProvider"

@observer
export class SlopeChart extends React.Component<{
    bounds: Bounds
    options: SlopeChartOptionsProvider
}> {
    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

    @computed get options() {
        return this.props.options
    }

    @computed get transform() {
        return this.props.options.slopeChartTransform
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
                return that.options.baseFontSize
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
        })
    }

    @action.bound onSlopeMouseOver(slopeProps: SlopeProps) {
        this.hoverKey = slopeProps.entityDimensionKey
    }

    @action.bound onSlopeMouseLeave() {
        this.hoverKey = undefined
    }

    @action.bound onSlopeClick() {
        const { options, hoverKey } = this
        if (options.addCountryMode === "disabled" || hoverKey === undefined) {
            return
        }

        this.options.toggleKey(hoverKey)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick() {
        const { options, hoverColor } = this
        if (options.addCountryMode === "disabled" || hoverColor === undefined)
            return

        const { transform } = this
        const keysToToggle = transform.data
            .filter((g) => g.color === hoverColor)
            .map((g) => g.entityDimensionKey)
        const allKeysActive =
            intersection(keysToToggle, options.selectedKeys).length ===
            keysToToggle.length
        if (allKeysActive)
            options.selectedKeys = without(
                options.selectedKeys,
                ...keysToToggle
            )
        else
            options.selectedKeys = uniq(
                options.selectedKeys.concat(keysToToggle)
            )
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors(): string[] {
        const { colorsInUse, transform, options } = this
        return colorsInUse.filter((color) => {
            const matchingKeys = transform.data
                .filter((g) => g.color === color)
                .map((g) => g.entityDimensionKey)
            return (
                intersection(matchingKeys, options.selectedKeys).length ===
                matchingKeys.length
            )
        })
    }

    @computed get focusKeys(): string[] {
        return this.options.selectedKeys
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed.struct get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      transform.data
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityDimensionKey)
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
            return uniq(transform.data.map((g) => g.color))
        else
            return uniq(
                transform.data
                    .filter(
                        (g) => activeKeys.indexOf(g.entityDimensionKey) !== -1
                    )
                    .map((g) => g.color)
            )
    }

    // Only show colors on legend that are actually in use
    @computed get colorsInUse() {
        return uniq(this.transform.data.map((g) => g.color))
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
        const { colorsInUse } = this
        const { legendData } = this.transform.colorScale
        return legendData.some((bin) => colorsInUse.includes(bin.color))
    }

    render() {
        if (this.transform.failMessage)
            return (
                <NoDataOverlay
                    options={this.options}
                    bounds={this.props.bounds}
                    message={this.transform.failMessage}
                />
            )

        const { bounds, options } = this.props
        const { data } = this.transform
        const {
            legend,
            focusKeys,
            hoverKeys,
            focusColors,
            activeColors,
            sidebarWidth,
            innerBounds,
            showLegend,
        } = this

        return (
            <g>
                <LabelledSlopes
                    options={options}
                    bounds={innerBounds}
                    isInteractive={options.isInteractive}
                    yTickFormat={this.transform.yTickFormat}
                    yAxisOptions={options.yAxis}
                    data={data}
                    fontSize={options.baseFontSize}
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
