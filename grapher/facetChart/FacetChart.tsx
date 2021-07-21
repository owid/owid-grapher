import React from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { computed } from "mobx"
import {
    ChartTypeName,
    FacetAxisRange,
    FacetStrategy,
    SeriesStrategy,
} from "../core/GrapherConstants"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import { ChartManager } from "../chart/ChartManager"
import { ChartInterface } from "../chart/ChartInterface"
import { getChartPadding, getFontSize } from "./FacetChartUtils"
import {
    FacetSeries,
    FacetChartProps,
    PlacedFacetSeries,
} from "./FacetChartConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { extent } from "d3-array"
import { excludeUndefined, flatten, maxBy } from "../../clientUtils/Util"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import { Position, PositionMap } from "../../clientUtils/owidTypes"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig"

const facetBackgroundColor = "transparent" // we don't use color yet but may use it for background later

const moveBottomToTop = (posMap: PositionMap<number>): PositionMap<number> => {
    if (posMap.bottom) {
        const { top, right, bottom, left } = posMap
        return {
            top: (top ?? 0) + bottom,
            right,
            left,
        }
    }
    return posMap
}

@observer
export class FacetChart
    extends React.Component<FacetChartProps>
    implements ChartInterface, FontSizeManager {
    transformTable(table: OwidTable): OwidTable {
        return table
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get fontSize(): number {
        return getFontSize(this.series.length, this.manager.baseFontSize)
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    /**
     * Holds the intermediate render properties for chart views, as well as the intermediate chart
     * views themselves.
     *
     * An example: a StackedArea has a Y axis domain that is the largest sum of all columns.
     * In order to avoid replicating that logic here (stacking values), we initialize StackedArea
     * instances, without rendering them. In a later method, we use those intermediate chart views to
     * determine the final axes for facets, e.g. for a uniform axis, we would iterate through all
     * instances to find the domain.
     *
     * @danielgavrilov, 2021-07-13
     */
    @computed private get intermediatePlacedSeries(): PlacedFacetSeries[] {
        const { manager, series } = this
        const count = series.length

        // Copy properties from manager to facets
        const baseFontSize = this.fontSize
        const lineStrokeWidth = count > 16 ? 1.5 : undefined
        const gridBoundsArr = this.bounds.grid(
            count,
            getChartPadding(count, baseFontSize)
        )
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
            isRelativeMode,
        } = manager
        const xAxisConfig = this.manager.xAxisConfig
        const yAxisConfig = this.manager.yAxisConfig

        const table = this.transformedTable

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]
            const chartTypeName =
                series.chartTypeName ??
                this.props.chartTypeName ??
                ChartTypeName.LineChart
            const hideLegend = false // !(column !== columns - 1) // todo: only show 1?
            const hidePoints = true

            const manager: ChartManager = {
                table,
                baseFontSize,
                lineStrokeWidth,
                hideLegend,
                hidePoints,
                xAxisConfig,
                yAxisConfig,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
                isRelativeMode,
                ...series.manager,
            }
            return {
                bounds,
                chartTypeName,
                manager,
                seriesName: series.seriesName,
                color: series.color,
            }
        })
    }

    @computed private get placedSeries(): PlacedFacetSeries[] {
        // Create intermediate chart views to determine some of the properties
        const chartInstances = this.intermediatePlacedSeries.map(
            ({ manager, chartTypeName }) => {
                const ChartClass =
                    ChartComponentClassMap.get(chartTypeName) ??
                    DefaultChartClass
                return new ChartClass({ manager })
            }
        )
        const sharedAxisPadding: PositionMap<number> = {}
        const globalXAxisConfig: AxisConfigInterface = {}
        const globalYAxisConfig: AxisConfigInterface = {}
        // set the axis minSize
        const chartInstanceWithLargestXAxis = maxBy(
            chartInstances,
            (chartInstance) => chartInstance.xAxis?.size
        )
        if (chartInstanceWithLargestXAxis) {
            const { size } = chartInstanceWithLargestXAxis.xAxis!
            globalXAxisConfig.minSize = size
        }
        const chartInstanceWithLargestYAxis = maxBy(
            chartInstances,
            (chartInstance) => chartInstance.yAxis?.size
        )
        if (chartInstanceWithLargestYAxis) {
            const { size } = chartInstanceWithLargestYAxis.yAxis!
            globalYAxisConfig.minSize = size
        }
        // Uniform X axis
        const uniformXAxis = true
        if (uniformXAxis) {
            // set the domain
            const [min, max] = extent(
                excludeUndefined(
                    flatten(
                        chartInstances.map(
                            (chartInstance) => chartInstance.xAxis?.domain
                        )
                    )
                )
            )
            globalXAxisConfig.min = min
            globalXAxisConfig.max = max
            // xAxisConfig.labelPadding = 8
            if (chartInstanceWithLargestXAxis) {
                const axis = chartInstanceWithLargestXAxis.xAxis!.clone()
                axis.updateDomainPreservingUserSettings([min, max]).size
                sharedAxisPadding[axis.position] = axis.size
            }
        }

        // Uniform Y axis
        const uniformYAxis =
            this.yAxisConfig.facetAxisRange === FacetAxisRange.shared
        if (uniformYAxis) {
            const [min, max] = extent(
                excludeUndefined(
                    flatten(
                        chartInstances.map(
                            (chartInstance) => chartInstance.yAxis?.domain
                        )
                    )
                )
            )
            globalYAxisConfig.min = min
            globalYAxisConfig.max = max
            globalYAxisConfig.labelPadding = 8
            if (chartInstanceWithLargestYAxis) {
                const axis = chartInstanceWithLargestYAxis.yAxis!.clone()
                axis.updateDomainPreservingUserSettings([min, max]).size
                sharedAxisPadding[axis.position] = axis.size
            }
        }
        // Allocate space for axes
        const bounds = this.bounds.pad(moveBottomToTop(sharedAxisPadding))
        const count = this.intermediatePlacedSeries.length
        const gridBoundsArr = bounds.grid(
            count,
            getChartPadding(count, this.fontSize)
        )
        // Overwrite properties (without mutating original)
        return this.intermediatePlacedSeries.map((series, i) => {
            const { bounds, edges } = gridBoundsArr[i]
            const { xAxis, yAxis } = chartInstances[i]
            const expand: PositionMap<number> = {}
            for (const edge of edges) {
                if (edge === Position.top) {
                    expand[Position.top] =
                        (sharedAxisPadding[Position.top] ?? 0) +
                        (sharedAxisPadding[Position.bottom] ?? 0)
                } else if (edge === Position.bottom) {
                    // do nothing
                } else if (edge in sharedAxisPadding) {
                    expand[edge] = sharedAxisPadding[edge]
                }
            }
            return {
                ...series,
                bounds: bounds.expand(expand),
                manager: {
                    ...series.manager,
                    xAxisConfig: {
                        ...series.manager.xAxisConfig,
                        ...globalXAxisConfig,
                        hideAxis:
                            xAxis &&
                            xAxis.position in sharedAxisPadding &&
                            !edges.has(
                                xAxis.position === Position.bottom
                                    ? Position.top
                                    : xAxis.position
                            ),
                    },
                    yAxisConfig: {
                        ...series.manager.yAxisConfig,
                        ...globalYAxisConfig,
                        hideAxis:
                            yAxis &&
                            yAxis.position in sharedAxisPadding &&
                            !edges.has(
                                yAxis.position === Position.bottom
                                    ? Position.top
                                    : yAxis.position
                            ),
                    },
                },
            }
        })
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get countryFacets(): FacetSeries[] {
        const table = this.transformedTable.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )
        const hideLegend = this.manager.yColumnSlugs?.length === 1
        return this.selectionArray.selectedEntityNames.map((seriesName) => {
            const seriesTable = table.filterByEntityNames([seriesName])
            // Only set overrides for this facet strategy.
            // Default properties are set elsewhere.
            return {
                seriesName,
                color: facetBackgroundColor,
                manager: {
                    table: seriesTable,
                    selection: [seriesName],
                    seriesStrategy: SeriesStrategy.column,
                    hideLegend,
                },
            }
        })
    }

    @computed private get columnFacets(): FacetSeries[] {
        return this.yColumns.map((col) => {
            // Only set overrides for this facet strategy.
            // Default properties are set elsewhere.
            return {
                seriesName: col.displayName,
                color: facetBackgroundColor,
                manager: {
                    selection: this.selectionArray,
                    yColumnSlug: col.slug,
                    yColumnSlugs: [col.slug],
                    seriesStrategy: SeriesStrategy.entity,
                },
            }
        })
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.inputTable.get(slug))
    }

    @computed private get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get series(): FacetSeries[] {
        const { facetStrategy } = this.manager
        return facetStrategy === FacetStrategy.column
            ? this.columnFacets
            : this.countryFacets
    }

    @computed protected get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padTop(this.fontSize + 10)
    }

    @computed protected get manager(): ChartManager {
        return this.props.manager
    }

    @computed get failMessage(): string {
        return ""
    }

    render(): JSX.Element[] {
        const { fontSize } = this
        return this.placedSeries.map((smallChart, index: number) => {
            const ChartClass =
                ChartComponentClassMap.get(smallChart.chartTypeName) ??
                DefaultChartClass
            const { bounds, seriesName } = smallChart
            const shiftTop = fontSize * 0.9
            return (
                <React.Fragment key={index}>
                    <text
                        x={bounds.x}
                        y={bounds.top - shiftTop}
                        fill={"#1d3d63"}
                        fontSize={fontSize}
                        style={{ fontWeight: 700 }}
                    >
                        {seriesName}
                    </text>
                    <ChartClass bounds={bounds} manager={smallChart.manager} />
                </React.Fragment>
            )
        })
    }
}
