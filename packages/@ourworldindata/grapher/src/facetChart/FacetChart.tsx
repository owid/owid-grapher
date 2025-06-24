import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    excludeUndefined,
    getIdealGridParams,
    IDEAL_PLOT_ASPECT_RATIO,
    GridParameters,
    Position,
    PositionMap,
    HorizontalAlign,
    Color,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { shortenForTargetWidth } from "@ourworldindata/components"
import { action, computed, observable } from "mobx"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import {
    GRAPHER_CHART_TYPES,
    GrapherChartType,
    FacetAxisDomain,
    FacetStrategy,
    SeriesColorMap,
    SeriesStrategy,
    AxisConfigInterface,
} from "@ourworldindata/types"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import { ChartManager } from "../chart/ChartManager"
import { ChartInterface } from "../chart/ChartInterface"
import {
    getChartPadding,
    getFontSize,
    getLabelPadding,
} from "./FacetChartUtils"
import {
    FacetSeries,
    FacetChartProps,
    PlacedFacetSeries,
    FacetChartManager,
} from "./FacetChartConstants"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { AxisConfig } from "../axis/AxisConfig"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"

const SHARED_X_AXIS_MIN_FACET_COUNT = 12

const facetBackgroundColor = "none" // we don't use color yet but may use it for background later

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
    implements ChartInterface, HorizontalColorLegendManager
{
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

    @computed private get manager(): FacetChartManager {
        return this.props.manager
    }

    @computed private get chartTypeName(): GrapherChartType {
        return this.props.chartTypeName ?? GRAPHER_CHART_TYPES.LineChart
    }

    @computed get isStatic(): boolean {
        return !!this.manager.isStatic
    }

    @computed get failMessage(): string {
        return ""
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get legendPadding(): number {
        const { isNumericLegend, fontSize } = this
        return isNumericLegend ? 1.5 * fontSize : 0.875 * fontSize
    }

    @computed private get facetsContainerBounds(): Bounds {
        const legendHeightWithPadding =
            this.showLegend && this.legend.height > 0
                ? this.legend.height + this.legendPadding
                : 0
        return this.bounds.padTop(
            legendHeightWithPadding + 1.25 * this.facetFontSize
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
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

        const aspectRatio = width / height // can be NaN if height is 0, which can happen when the chart is temporarily hidden

        return getIdealGridParams({
            count,
            containerAspectRatio: isNaN(aspectRatio) ? 1 : aspectRatio,
            idealAspectRatio: IDEAL_PLOT_ASPECT_RATIO,
        })
    }

    @computed private get facetGridPadding(): {
        rowPadding: number
        columnPadding: number
        outerPadding: number
    } {
        const { isSharedXAxis, facetFontSize } = this
        return getChartPadding({
            baseFontSize: facetFontSize,
            isSharedXAxis,
        })
    }

    @computed private get hideFacetLegends(): boolean {
        return true
    }

    // Passing this color map is important to ensure that all facets use the same entity colors
    seriesColorMap: SeriesColorMap = this.manager?.seriesColorMap ?? new Map()

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
    @computed private get intermediatePlacedSeries(): PlacedFacetSeries[] {
        const { manager, series, facetCount, seriesColorMap } = this

        // Copy properties from manager to facets
        const fontSize = this.facetFontSize
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
            colorScale,
            sortConfig,
            startHandleTimeBound,
            startTime,
            endTime,
            missingDataStrategy,
            backgroundColor,
            focusArray,
            isStatic,
        } = manager

        // Use compact labels, e.g. 50k instead of 50,000.
        const numberAbbreviation = facetCount > 2 ? "short" : "long"
        const globalXAxisConfig: AxisConfigInterface = {
            tickFormattingOptions: { numberAbbreviation },
        }
        const globalYAxisConfig: AxisConfigInterface = {
            tickFormattingOptions: { numberAbbreviation },
        }

        // We infer that the user cares about the trend if the axis is not uniform
        // and the metrics on all facets are the same
        const careAboutTrend = !this.uniformYAxis
        if (careAboutTrend) {
            // Force disable nice axes if we care about the trend,
            // because nice axes misrepresent trends.
            globalYAxisConfig.nice = false
        }

        const table = this.transformedTable

        // In order to produce consistent color scales across facets, we need to pass
        // all possible color values from `inputTable`.
        const colorScaleColumnOverride = this.inputTable.get(colorColumnSlug)

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]
            const showLegend = !this.hideFacetLegends

            const hidePoints = true
            const hideNoDataSection = true

            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager: ChartManager = {
                table,
                fontSize,
                showLegend,
                hidePoints,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
                isRelativeMode,
                seriesColorMap,
                colorScale,
                colorScaleColumnOverride,
                sortConfig,
                startHandleTimeBound,
                startTime,
                endTime,
                missingDataStrategy,
                backgroundColor,
                hideNoDataSection,
                focusArray,
                isStatic,
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
                manager,
                seriesName: series.seriesName,
                color: series.color,
            }
        })
    }

    @computed get intermediateChartInstances(): ChartInterface[] {
        return this.intermediatePlacedSeries.map(({ bounds, manager }) => {
            const ChartClass =
                ChartComponentClassMap.get(this.chartTypeName) ??
                DefaultChartClass
            return new ChartClass({ bounds, manager })
        })
    }

    @computed private get isSharedYAxis(): boolean {
        // When the Y axis is uniform for all facets:
        // - for most charts, we want to only show the axis on the left-most facet charts, and omit
        //   it on the others
        // - for bar charts the Y axis is plotted horizontally, so we don't want to omit it
        return (
            this.uniformYAxis &&
            ![
                GRAPHER_CHART_TYPES.StackedDiscreteBar,
                GRAPHER_CHART_TYPES.DiscreteBar,
            ].includes(this.chartTypeName as any)
        )
    }

    @computed private get isSharedXAxis(): boolean {
        return (
            this.uniformXAxis &&
            // TODO: do this for stacked area charts and line charts as well?
            this.chartTypeName === GRAPHER_CHART_TYPES.StackedBar &&
            this.facetCount >= SHARED_X_AXIS_MIN_FACET_COUNT
        )
    }

    // Only made public for testing
    @computed get placedSeries(): PlacedFacetSeries[] {
        const { intermediateChartInstances } = this

        // If one of the charts should use a value-based color scheme,
        // switch them all over for consistency
        const useValueBasedColorScheme = intermediateChartInstances.some(
            (instance) => instance.shouldUseValueBasedColorScheme
        )

        // Define the global axis config, shared between all facets
        const sharedAxesSizes: PositionMap<number> = {}

        const axes: AxesInfo = {
            x: {
                config: {},
                axisAccessor: (instance) => instance.xAxis,
                uniform: this.uniformXAxis,
                shared: this.isSharedXAxis,
            },
            y: {
                config: {},
                axisAccessor: (instance) => instance.yAxis,
                uniform: this.uniformYAxis,
                shared: this.isSharedYAxis,
            },
        }
        R.values(axes).forEach(({ config, axisAccessor, uniform, shared }) => {
            // max size is the width (if vertical axis) or height (if horizontal axis)
            const axisWithMaxSize = _.maxBy(
                intermediateChartInstances.map(axisAccessor),
                (axis) => axis?.size
            )
            if (uniform) {
                const axes = excludeUndefined(
                    intermediateChartInstances.map(axisAccessor)
                )

                // If the axes are uniform, we want to find the full domain extent across all facets
                const domains = axes.map((axis) => axis.domain)
                config.min = _.min(domains.map((d) => d[0]))
                config.max = _.max(domains.map((d) => d[1]))

                // Find domain values across all facets
                const domainValues = _.uniq(
                    axes.flatMap((axis) => axis.config.domainValues ?? [])
                )
                if (domainValues.length > 0) config.domainValues = domainValues

                // Find ticks across all facets
                const ticks = _.uniq(
                    axes.flatMap((axis) => axis.config.ticks ?? [])
                )
                if (ticks.length > 0) config.ticks = ticks

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
                    if (shared) {
                        const sharedAxisSize =
                            axis.orient === Position.bottom ? 0 : size
                        sharedAxesSizes[axis.orient] = sharedAxisSize
                    }
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
            const { bounds: initialGridBounds, cellEdges } = gridBoundsArr[i]
            let bounds = initialGridBounds
            // Only expand bounds if the facet is on the same edge as the shared axes
            for (const edge of cellEdges) {
                bounds = bounds.expand({
                    [edge]: sharedAxesSizes[edge],
                })
            }
            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager = {
                ...series.manager,
                useValueBasedColorScheme,
                externalLegendHoverBin: this.legendHoverBin,
                xAxisConfig: {
                    // For now, sharing an x axis means hiding the tick labels of inner facets.
                    // This means that none of the x axes are actually hidden (we just don't plot their tick labels).
                    // If we ever allow shared x axes to be actually hidden, we need to be careful with how we determine
                    // the `minSize` – in the intermediate series (at this time) all axes are shown in
                    // order to find the one with maximum size, but in the placed series, some axes are
                    // hidden. This expands the available area for the chart, which can in turn increase
                    // the number of ticks shown, which can make the size of the axis in the placed
                    // series greater than the one in the intermediate series.
                    hideTickLabels: shouldHideFacetAxis(
                        xAxis,
                        cellEdges,
                        sharedAxesSizes
                    ),
                    ...series.manager.xAxisConfig,
                    ...axes.x.config,
                },
                yAxisConfig: {
                    hideAxis: shouldHideFacetAxis(
                        yAxis,
                        cellEdges,
                        sharedAxesSizes
                    ),
                    ...series.manager.yAxisConfig,
                    ...axes.y.config,
                },
                tooltip: this.manager.tooltip,
                shouldPinTooltipToBottom: this.manager.shouldPinTooltipToBottom,
                base: this.manager.base,
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
            }
        })
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
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

    // legend utils

    @computed private get externalLegends(): HorizontalColorLegendManager[] {
        return excludeUndefined(
            this.intermediateChartInstances.map(
                (instance) => instance.externalLegend
            )
        )
    }

    @computed private get isNumericLegend(): boolean {
        return this.externalLegends.some((legend) =>
            legend.numericLegendData?.some((bin) => bin instanceof NumericBin)
        )
    }

    @computed private get LegendClass():
        | typeof HorizontalNumericColorLegend
        | typeof HorizontalCategoricalColorLegend {
        return this.isNumericLegend
            ? HorizontalNumericColorLegend
            : HorizontalCategoricalColorLegend
    }

    @computed private get showLegend(): boolean {
        const { isNumericLegend, categoricalLegendData, numericLegendData } =
            this
        const hasBins =
            categoricalLegendData.length > 0 || numericLegendData.length > 0
        if (!hasBins) return false
        if (isNumericLegend) return true
        if (
            this.props.chartTypeName ===
                GRAPHER_CHART_TYPES.StackedDiscreteBar &&
            this.facetStrategy === FacetStrategy.metric
        ) {
            return false
        }
        if (
            categoricalLegendData.length > 1 ||
            // If the facetStrategy is metric, then the legend (probably?) shows entity items.
            // If the user happens to select only a single entity, we don't want to collapse the
            // legend, because it's (probably?) the only information about what is selected.
            // This is fragile and ideally we shouldn't be making assumptions about what type of
            // items are shown on the legend, but it works for now...
            // -@danielgavrilov, 2021-09-28
            (this.facetStrategy === FacetStrategy.metric &&
                this.props.manager.canSelectMultipleEntities)
        ) {
            return true
        }
        return false
    }

    private getExternalLegendProp<
        Prop extends keyof HorizontalColorLegendManager,
    >(prop: Prop): HorizontalColorLegendManager[Prop] | undefined {
        for (const externalLegend of this.externalLegends) {
            if (externalLegend[prop] !== undefined) {
                return externalLegend[prop]
            }
        }
        return undefined
    }

    private getUniqBins<Bin extends ColorScaleBin>(bins: Bin[]): Bin[] {
        return _.uniqWith(bins, (binA, binB): boolean => {
            // For categorical bins, the `.equals()` method isn't good enough,
            // because it only compares `.index`, which in this case can be
            // identical even when the bins are not, because they are coming
            // from different charts (facets).
            if (binA instanceof CategoricalBin) {
                return binA.text === binB.text
            }
            return binA.equals(binB)
        })
    }

    // legend props

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get legendTitle(): string | undefined {
        return this.getExternalLegendProp("legendTitle")
    }

    @computed get legendHeight(): number | undefined {
        return this.getExternalLegendProp("legendHeight")
    }

    @computed get legendOpacity(): number | undefined {
        return this.getExternalLegendProp("legendOpacity")
    }

    @computed get legendTextColor(): Color | undefined {
        return this.getExternalLegendProp("legendTextColor")
    }

    @computed get legendTickSize(): number | undefined {
        return this.getExternalLegendProp("legendTickSize")
    }

    @computed get categoricalBinStroke(): Color | undefined {
        return this.getExternalLegendProp("categoricalBinStroke")
    }

    @computed get numericBinSize(): number | undefined {
        return this.getExternalLegendProp("numericBinSize")
    }

    @computed get numericBinStroke(): Color | undefined {
        return this.getExternalLegendProp("numericBinStroke")
    }

    @computed get numericBinStrokeWidth(): number | undefined {
        return this.getExternalLegendProp("numericBinStrokeWidth")
    }

    @computed get hoverColors(): Color[] | undefined {
        if (!this.legendHoverBin) return undefined
        return [this.legendHoverBin.color]
    }

    @computed get activeColors(): Color[] | undefined {
        const { focusArray } = this.manager
        if (!focusArray) return undefined

        // find colours of all currently focused series
        const activeColors = _.uniq(
            this.intermediateChartInstances.flatMap((chartInstance) =>
                chartInstance.series
                    .filter((series) => focusArray.has(series.seriesName))
                    .map((series) => series.color)
            )
        )

        return activeColors.length > 0 ? activeColors : undefined
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        if (!this.isNumericLegend || !this.hideFacetLegends) return []
        const allBins: ColorScaleBin[] = this.externalLegends.flatMap(
            (legend) => [
                ...(legend.numericLegendData ?? []),
                ...(legend.categoricalLegendData ?? []),
            ]
        )
        const uniqBins = this.getUniqBins(allBins)
        const sortedBins = _.sortBy(
            uniqBins,
            (bin) => bin instanceof CategoricalBin
        )
        return sortedBins
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        if (this.isNumericLegend || !this.hideFacetLegends) return []
        const allBins: CategoricalBin[] = this.externalLegends
            .flatMap((legend) => [
                ...(legend.numericLegendData ?? []),
                ...(legend.categoricalLegendData ?? []),
            ])
            .filter((bin) => bin instanceof CategoricalBin) as CategoricalBin[]
        const uniqBins = this.getUniqBins(allBins)
        const newBins = uniqBins.map(
            // remap index to ensure it's unique (the above procedure can lead to duplicates)
            (bin, index) =>
                new CategoricalBin({
                    ...bin.props,
                    index,
                })
        )
        if (this.facetStrategy === FacetStrategy.metric && newBins.length <= 1)
            return []
        const sortedBins = _.sortBy(newBins, (bin) => bin.label)
        return sortedBins
    }

    @observable.ref private legendHoverBin: ColorScaleBin | undefined =
        undefined

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.legendHoverBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendHoverBin = undefined
    }

    @action.bound onLegendClick(bin: ColorScaleBin): void {
        if (!this.manager.focusArray || !this.isFocusModeSupported) return

        // find all series (of all facets) that are contained in the bin
        const seriesNames = _.uniq(
            this.intermediateChartInstances.flatMap((chartInstance) =>
                chartInstance.series
                    .filter((series) => bin.contains(series.seriesName))
                    .map((series) => series.seriesName)
            )
        )
        this.manager.focusArray.toggle(...seriesNames)
    }

    // end of legend props

    @computed private get legend(): HorizontalColorLegend {
        return new this.LegendClass({ manager: this })
    }

    @computed private get isFocusModeSupported(): boolean {
        return (
            this.chartTypeName === GRAPHER_CHART_TYPES.LineChart ||
            this.chartTypeName === GRAPHER_CHART_TYPES.SlopeChart
        )
    }

    /**
     * In order to display a potentially long facet label in the potentially tight space, we
     * shrink and shorten the label as follows to prevent overlap between neighbouring labels:
     * - If the label already fits, we're happy :)
     * - Otherwise, we calculate the ideal font size where it would fit perfectly.
     *   However, in order to not make the label tiny, we cap the font size at 0.7 * baseFontSize
     * - If the label still doesn't fit, we shorten it to the number of characters that fit and append an ellispsis (…)
     * -@MarcelGerber, 2021-10-28
     */
    private shrinkAndShortenFacetLabel(
        label: string,
        availableWidth: number,
        baseFontSize: number // font size to use when we're not shrinking
    ): { fontSize: number; shortenedLabel: string } {
        // How much width would we need if we were to render the text at font size 1?
        // We calculate this to compute the ideal font size from the available width.
        const textBounds = Bounds.forText(label, {
            fontSize: 1,
        })
        const idealFontSize = availableWidth / textBounds.width

        // Clamp the ideal font size: 0.7 * baseFontSize <= fontSize <= baseFontSize
        const fontSize = Math.min(
            baseFontSize,
            Math.max(0.7 * baseFontSize, idealFontSize)
        )

        if (fontSize > idealFontSize) {
            const ellipsisWidth = Bounds.forText("…", {
                fontSize,
            }).width

            label = `${shortenForTargetWidth(
                label,
                availableWidth - ellipsisWidth,
                { fontSize }
            )}…`
        }
        return { fontSize, shortenedLabel: label }
    }

    render(): React.ReactElement {
        const { facetFontSize, LegendClass, showLegend } = this
        return (
            <React.Fragment>
                {showLegend && <LegendClass manager={this} />}
                {this.placedSeries.map((facetChart, index: number) => {
                    const ChartClass =
                        ChartComponentClassMap.get(this.chartTypeName) ??
                        DefaultChartClass
                    const { bounds, contentBounds, seriesName } = facetChart
                    const labelPadding = getLabelPadding(facetFontSize)

                    const { fontSize, shortenedLabel } =
                        this.shrinkAndShortenFacetLabel(
                            seriesName,
                            contentBounds.width,
                            facetFontSize
                        )

                    return (
                        <React.Fragment key={index}>
                            <text
                                x={contentBounds.x}
                                y={contentBounds.top - labelPadding}
                                fill={GRAPHER_DARK_TEXT}
                                fontSize={fontSize}
                                style={{ fontWeight: 700 }}
                            >
                                {shortenedLabel}
                                <title>{seriesName}</title>
                            </text>
                            <g id={makeIdForHumanConsumption(seriesName)}>
                                <ChartClass
                                    bounds={bounds}
                                    manager={facetChart.manager}
                                />
                            </g>
                        </React.Fragment>
                    )
                })}
            </React.Fragment>
        )
    }
}
