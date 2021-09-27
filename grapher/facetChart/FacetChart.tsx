import React from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { action, computed, observable } from "mobx"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
    SeriesColorMap,
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
    IntermediatePlacedFacetSeries,
} from "./FacetChartConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import {
    excludeUndefined,
    flatten,
    getIdealGridParams,
    max,
    maxBy,
    min,
    uniqBy,
    values,
} from "../../clientUtils/Util"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import {
    IDEAL_PLOT_ASPECT_RATIO,
    GridParameters,
    Position,
    PositionMap,
    HorizontalAlign,
} from "../../clientUtils/owidTypes"
import { AxisConfig } from "../axis/AxisConfig"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"

const facetBackgroundColor = "transparent" // we don't use color yet but may use it for background later

const getContentBounds = (
    containerBounds: Bounds,
    manager: ChartManager,
    chartInstance: ChartInterface
): Bounds => {
    let bounds = containerBounds
    const axes = [
        { config: manager.xAxisConfig, axis: chartInstance.xAxis },
        { config: manager.yAxisConfig, axis: chartInstance.yAxis },
    ]
    for (const { config, axis } of axes) {
        if (!config || !axis) continue
        if (!config.hideAxis && config.minSize !== undefined) {
            bounds = bounds.pad({ [axis.orient]: config.minSize })
        }
    }
    return bounds
}

const shouldHideFacetAxis = (
    axis: HorizontalAxis | VerticalAxis | undefined,
    edges: Set<Position>,
    sharedAxesSizes: PositionMap<number>
): boolean => {
    if (axis) {
        return axis.orient in sharedAxesSizes && !edges.has(axis.orient)
    }
    return false
}

interface AxisInfo {
    config: AxisConfigInterface
    axisAccessor: (
        instance: ChartInterface
    ) => HorizontalAxis | VerticalAxis | undefined
    uniform: boolean
    /** only considered when `uniform` is `true`, otherwise ignored */
    shared: boolean
}

interface AxesInfo {
    x: AxisInfo
    y: AxisInfo
}

@observer
export class FacetChart
    extends React.Component<FacetChartProps>
    implements ChartInterface, HorizontalColorLegendManager {
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

    @computed private get manager(): ChartManager {
        return this.props.manager
    }

    @computed get failMessage(): string {
        return ""
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get facetsContainerBounds(): Bounds {
        const fontSize = this.facetFontSize
        const legendHeightWithPadding =
            this.legend.height > 0 ? this.legend.height + fontSize * 0.875 : 0
        return this.bounds.padTop(legendHeightWithPadding + 1.8 * fontSize)
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get facetFontSize(): number {
        return getFontSize(this.series.length, this.fontSize)
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, {
            fontSize: this.facetFontSize,
        })
    }

    @computed private get uniformYAxis(): boolean {
        // default to shared
        const facetDomain =
            this.yAxisConfig.facetDomain || FacetAxisDomain.shared
        return facetDomain === FacetAxisDomain.shared
    }

    @computed private get uniformXAxis(): boolean {
        // TODO: maybe should not be the default for ScatterPlot?
        return true
    }

    @computed private get facetCount(): number {
        return this.series.length
    }

    @computed private get gridParams(): GridParameters {
        const count = this.facetCount
        const { width, height } = this.bounds
        return getIdealGridParams({
            count,
            containerAspectRatio: width / height,
            idealAspectRatio: IDEAL_PLOT_ASPECT_RATIO,
        })
    }

    @computed private get facetGridPadding(): {
        rowPadding: number
        columnPadding: number
        outerPadding: number
    } {
        return getChartPadding(this.facetCount, this.facetFontSize)
    }

    @computed private get hideFacetLegends(): boolean {
        return true
    }

    // Passing this color map is important to ensure that all facets use the same entity colors
    seriesColorMap: SeriesColorMap = new Map()

    /**
     * Holds the intermediate render properties for chart views, before axes are synchronized,
     * collapsed, aligned, etc.
     *
     * An example: a StackedArea has a Y axis domain that is the largest sum of all columns.
     * In order to avoid replicating that logic here (stacking values), we initialize StackedArea
     * instances, without rendering them. In a later method, we use those intermediate chart views to
     * determine the final axes for facets, e.g. for a uniform axis, we would iterate through all
     * instances to find the full extent of the domain.
     *
     * @danielgavrilov, 2021-07-13
     */
    @computed
    private get intermediatePlacedSeries(): IntermediatePlacedFacetSeries[] {
        const { manager, series, facetCount, seriesColorMap } = this

        // Copy properties from manager to facets
        const baseFontSize = this.facetFontSize
        // We are using `bounds` instead of `facetsContainerBounds` because the legend
        // is not yet created, and it is derived from the intermediate chart series.
        const gridBoundsArr = this.bounds.grid(
            this.gridParams,
            this.facetGridPadding
        )

        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
            isRelativeMode,
        } = manager

        // Use compact labels, e.g. 50k instead of 50,000.
        const compactLabels = facetCount > 2
        const globalXAxisConfig: AxisConfigInterface = {
            compactLabels,
        }
        const globalYAxisConfig: AxisConfigInterface = {
            compactLabels,
        }

        // We infer that the user cares about the trend if the axis is not uniform
        // and the metrics on all facets are the same
        const careAboutTrend =
            !this.uniformYAxis && this.facetStrategy === FacetStrategy.entity
        if (careAboutTrend) {
            // Force disable nice axes if we care about the trend,
            // because nice axes misrepresent trends.
            globalYAxisConfig.nice = false
        }

        const table = this.transformedTable

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]
            const chartTypeName =
                series.chartTypeName ??
                this.props.chartTypeName ??
                ChartTypeName.LineChart

            const hideLegend = this.hideFacetLegends
            const hidePoints = true

            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager: ChartManager = {
                table,
                baseFontSize,
                hideLegend,
                hidePoints,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
                isRelativeMode,
                seriesColorMap,
                ...series.manager,
                xAxisConfig: {
                    ...globalXAxisConfig,
                    ...this.manager.xAxisConfig,
                    ...series.manager.xAxisConfig,
                },
                yAxisConfig: {
                    ...globalYAxisConfig,
                    ...this.manager.yAxisConfig,
                    ...series.manager.yAxisConfig,
                },
            }
            return {
                bounds,
                contentBounds: bounds,
                chartTypeName,
                manager,
                seriesName: series.seriesName,
                color: series.color,
            }
        })
    }

    @computed private get intermediateChartInstances(): ChartInterface[] {
        return this.intermediatePlacedSeries.map(
            ({ bounds, manager, chartTypeName }) => {
                const ChartClass =
                    ChartComponentClassMap.get(chartTypeName) ??
                    DefaultChartClass
                return new ChartClass({ bounds, manager })
            }
        )
    }

    // Only made public for testing
    @computed get placedSeries(): PlacedFacetSeries[] {
        const { intermediateChartInstances } = this
        // Define the global axis config, shared between all facets
        const sharedAxesSizes: PositionMap<number> = {}
        const axes: AxesInfo = {
            x: {
                config: {},
                axisAccessor: (instance) => instance.xAxis,
                uniform: this.uniformXAxis,
                // For now, X axes are never shared for any chart.
                // If we ever allow them to be shared, we need to be careful with how we determine
                // the `minSize` – in the intermediate series (at this time) all axes are shown in
                // order to find the one with maximum size, but in the placed series, some axes are
                // hidden. This expands the available area for the chart, which can in turn increase
                // the number of ticks shown, which can make the size of the axis in the placed
                // series greater than the one in the intermediate series.
                shared: false,
            },
            y: {
                config: {},
                axisAccessor: (instance) => instance.yAxis,
                uniform: this.uniformYAxis,
                shared: this.uniformYAxis,
            },
        }
        values(axes).forEach(({ config, axisAccessor, uniform, shared }) => {
            // max size is the width (if vertical axis) or height (if horizontal axis)
            const axisWithMaxSize = maxBy(
                intermediateChartInstances.map(axisAccessor),
                (axis) => axis?.size
            )
            if (uniform) {
                // If the axes are uniform, we want to find the full domain extent across all facets
                const domains = excludeUndefined(
                    intermediateChartInstances
                        .map(axisAccessor)
                        .map((axis) => axis?.domain)
                )
                config.min = min(domains.map((d) => d[0]))
                config.max = max(domains.map((d) => d[1]))
                // If there was at least one chart with a non-undefined axis,
                // this variable will be populated
                if (axisWithMaxSize) {
                    // Create a new axis object with the full domain extent
                    const axis = axisWithMaxSize.clone()
                    const { size } = axis.updateDomainPreservingUserSettings([
                        config.min,
                        config.max,
                    ])
                    config.minSize = size
                    if (shared) sharedAxesSizes[axis.orient] = size
                }
            } else if (axisWithMaxSize) {
                config.minSize = axisWithMaxSize.size
            }
        })

        // Allocate space for shared axes, so that the content areas of charts are all equal.
        // If the axes are "shared", then an axis will only plotted on the facets that are on the
        // same side as the axis.
        // For example, a vertical Y axis would be plotted on the left-most charts only.
        // An exception is the bottom axis, which gets plotted on the top row of charts, instead of
        // the bottom row of charts.
        const fullBounds = this.facetsContainerBounds.pad(sharedAxesSizes)
        const gridBoundsArr = fullBounds.grid(
            this.gridParams,
            this.facetGridPadding
        )
        return this.intermediatePlacedSeries.map((series, i) => {
            const chartInstance = intermediateChartInstances[i]
            const { xAxis, yAxis } = chartInstance
            const { bounds: initialGridBounds, edges } = gridBoundsArr[i]
            let bounds = initialGridBounds
            // Only expand bounds if the facet is on the same edge as the shared axes
            for (const edge of edges) {
                bounds = bounds.expand({
                    [edge]: sharedAxesSizes[edge],
                })
            }
            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager = {
                ...series.manager,
                externalLegendFocusBin: this.legendFocusBin,
                xAxisConfig: {
                    hideAxis: shouldHideFacetAxis(
                        xAxis,
                        edges,
                        sharedAxesSizes
                    ),
                    ...series.manager.xAxisConfig,
                    ...axes.x.config,
                },
                yAxisConfig: {
                    hideAxis: shouldHideFacetAxis(
                        yAxis,
                        edges,
                        sharedAxesSizes
                    ),
                    ...series.manager.yAxisConfig,
                    ...axes.y.config,
                },
            }
            const contentBounds = getContentBounds(
                bounds,
                manager,
                chartInstance
            )
            return {
                ...series,
                bounds,
                contentBounds,
                manager,
                chartInstance,
            }
        })
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get entityFacets(): FacetSeries[] {
        const table = this.transformedTable.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )
        return this.selectionArray.selectedEntityNames.map((seriesName) => {
            const seriesTable = table.filterByEntityNames([seriesName])
            // Only set overrides for this facet strategy.
            // Default properties are set elsewhere.
            const manager: ChartManager = {
                table: seriesTable,
                selection: [seriesName],
                seriesStrategy: SeriesStrategy.column,
            }
            return {
                seriesName,
                color: facetBackgroundColor,
                manager,
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

    @computed private get facetStrategy(): FacetStrategy {
        return this.manager.facetStrategy ?? FacetStrategy.none
    }

    @computed get series(): FacetSeries[] {
        return this.facetStrategy === FacetStrategy.metric
            ? this.columnFacets
            : this.entityFacets
    }

    // legend props

    @computed get legendPaddingTop(): number {
        return 0
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        if (this.hideFacetLegends) {
            const bins = uniqBy(
                flatten(
                    excludeUndefined(
                        this.intermediateChartInstances.map(
                            (instance) => instance.externalLegendBins
                        )
                    )
                ),
                (bin) => bin.value
            ).map(
                // remap index to ensure it's unique (the above procedure can lead to duplicates)
                (bin, index) =>
                    new CategoricalBin({
                        ...bin.props,
                        index,
                    })
            )
            if (bins.length > 1) return bins
        }
        return []
    }

    @observable.ref legendFocusBin: CategoricalBin | undefined = undefined

    @action.bound onLegendMouseOver(bin: CategoricalBin): void {
        this.legendFocusBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendFocusBin = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    render(): JSX.Element {
        const { facetFontSize } = this
        const showLegend = this.categoricalLegendData.length > 0
        return (
            <React.Fragment>
                {showLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
                {this.placedSeries.map((facetChart, index: number) => {
                    const ChartClass =
                        ChartComponentClassMap.get(facetChart.chartTypeName) ??
                        DefaultChartClass
                    const { bounds, contentBounds, seriesName } = facetChart
                    const shiftTop = facetFontSize * 0.9
                    return (
                        <React.Fragment key={index}>
                            <text
                                x={contentBounds.x}
                                y={contentBounds.top - shiftTop}
                                fill={"#1d3d63"}
                                fontSize={facetFontSize}
                                style={{ fontWeight: 700 }}
                            >
                                {seriesName}
                            </text>
                            <ChartClass
                                bounds={bounds}
                                manager={facetChart.manager}
                            />
                        </React.Fragment>
                    )
                })}
            </React.Fragment>
        )
    }
}
