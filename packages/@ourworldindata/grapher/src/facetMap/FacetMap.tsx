import React from "react"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    excludeUndefined,
    GridParameters,
    HorizontalAlign,
    Color,
    uniq,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { ChartErrorInfo } from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { getChartPadding, getFontSize } from "../facetChart/FacetChartUtils"
import {
    FacetSeries,
    FacetMapProps,
    PlacedFacetSeries,
    FacetMapManager,
} from "./FacetMapConstants"
import { OwidTable } from "@ourworldindata/core-table"
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
import { MapChart } from "../mapCharts/MapChart"
import { MapChartManager } from "../mapCharts/MapChartConstants"

const facetBackgroundColor = "none" // we don't use color yet but may use it for background later

const PADDING_BETWEEN_MAP_AND_LEGEND = 8
const PADDING_BELOW_LEGEND = 4

@observer
export class FacetMap
    extends React.Component<FacetMapProps>
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

    @computed private get manager(): FacetMapManager {
        return this.props.manager
    }

    @computed get isStatic(): boolean {
        return !!this.manager.isStatic
    }

    @computed get errorInfo(): ChartErrorInfo {
        return { reason: "" }
    }

    @computed private get bounds(): Bounds {
        const bounds = this.props.bounds ?? DEFAULT_BOUNDS
        return bounds.padBottom(PADDING_BELOW_LEGEND)
    }

    @computed private get labelPadding(): number {
        return 0.3 * this.facetFontSize
    }

    @computed private get facetsContainerBounds(): Bounds {
        // TODO: padTop is for the labels
        return this.bounds
            .padTop(this.facetFontSize + this.labelPadding)
            .padBottom(this.legendHeight)
            .padBottom(PADDING_BETWEEN_MAP_AND_LEGEND)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get facetFontSize(): number {
        return getFontSize(this.series.length, this.fontSize)
    }

    @computed private get gridParams(): GridParameters {
        return { rows: 1, columns: 2, count: 2 }
    }

    @computed private get facetGridPadding(): {
        rowPadding: number
        columnPadding: number
        outerPadding: number
    } {
        const { facetFontSize } = this
        // TODO: rewrite for maps
        return getChartPadding({
            baseFontSize: facetFontSize,
            isSharedXAxis: false,
        })
    }

    @computed private get hideFacetLegends(): boolean {
        return true
    }

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
        const { manager, series } = this

        // Copy properties from manager to facets
        const fontSize = this.facetFontSize
        // We are using `bounds` instead of `facetsContainerBounds` because the legend
        // is not yet created, and it is derived from the intermediate chart series.
        const gridBoundsArr = this.bounds.grid(
            this.gridParams,
            this.facetGridPadding
        )

        const {
            startHandleTimeBound,
            startTime,
            endTime,
            backgroundColor,
            isStatic,
            mapColumnSlug,
            mapConfig,
            isMapSelectionEnabled,
            colorScale,
            mapRegionDropdownValue,
            resetMapRegionDropdownValue,
            globeController,
        } = manager

        const table = this.transformedTable

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]
            const showLegend = !this.hideFacetLegends

            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager: MapChartManager = {
                // TODO: remove more?
                table,
                fontSize,
                showLegend,
                startHandleTimeBound,
                startTime,
                endTime,
                backgroundColor,
                isStatic,
                mapColumnSlug: mapColumnSlug ?? "",
                mapConfig,
                isMapSelectionEnabled,
                colorScale,
                mapRegionDropdownValue,
                resetMapRegionDropdownValue,
                globeController,
                ...series.manager,
            }
            return {
                bounds,
                manager,
                seriesName: series.seriesName,
                color: series.color,
            }
        })
    }

    @computed get intermediateChartInstances(): ChartInterface[] {
        return this.intermediatePlacedSeries.map(({ bounds, manager }) => {
            return new MapChart({ bounds, manager })
        })
    }

    // Only made public for testing
    // TODO: is this needed? I don't think so
    // TODO: why are some things passed here?
    @computed get placedSeries(): PlacedFacetSeries[] {
        const gridBoundsArr = this.facetsContainerBounds.grid(
            this.gridParams,
            this.facetGridPadding
        )
        return this.intermediatePlacedSeries.map((series, i) => {
            const { bounds } = gridBoundsArr[i]
            // NOTE: The order of overrides is important!
            // We need to preserve most config coming in.
            const manager = {
                ...series.manager,
                externalLegendHoverBin: this.legendHoverBin,
                tooltip: this.manager.tooltip,
                shouldPinTooltipToBottom: this.manager.shouldPinTooltipToBottom,
                base: this.manager.base,
            }
            return {
                ...series,
                bounds,
                manager,
            }
        })
    }

    // TODO: improve?
    @computed get series(): FacetSeries[] {
        return [this.manager.startTime, this.manager.endTime].map((time) => {
            // Only set overrides for this facet strategy.
            // Default properties are set elsewhere.
            return {
                seriesName:
                    this.transformedTable.timeColumn.formatTime(time as any) ??
                    "Missing time",
                color: facetBackgroundColor,
                manager: { targetTime: time },
            }
        })
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
        return true
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

    // legend props

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get numericLegendY(): number {
        const legendHeightWithPadding =
            this.showLegend && this.legend.height > 0 ? this.legend.height : 0

        return this.bounds.bottom - legendHeightWithPadding
    }

    @computed get categoryLegendY(): number {
        const legendHeightWithPadding =
            this.showLegend && this.legend.height > 0 ? this.legend.height : 0

        return this.bounds.bottom - legendHeightWithPadding
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get legendHeight(): number {
        return this.getExternalLegendProp("legendHeight") ?? 0
    }

    @computed get hoverColors(): Color[] | undefined {
        if (!this.legendHoverBin) return undefined
        return [this.legendHoverBin.color]
    }

    @computed get activeColors(): Color[] | undefined {
        const { focusArray } = this.manager
        if (!focusArray) return undefined

        // find colours of all currently focused series
        const activeColors = uniq(
            this.intermediateChartInstances.flatMap((chartInstance) =>
                chartInstance.series
                    .filter((series) => focusArray.has(series.seriesName))
                    .map((series) => series.color)
            )
        )

        return activeColors.length > 0 ? activeColors : undefined
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        return this.getExternalLegendProp("numericLegendData") ?? []
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.getExternalLegendProp("categoricalLegendData") ?? []
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
        if (!this.manager.focusArray) return

        // find all series (of all facets) that are contained in the bin
        const seriesNames = uniq(
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

    render(): React.ReactElement {
        const { facetFontSize, LegendClass, showLegend } = this
        return (
            <React.Fragment>
                {/* <rect {...this.bounds.toProps()} fill="none" stroke="gray" />
                <rect
                    {...this.facetsContainerBounds.toProps()}
                    fill="none"
                    stroke="red"
                /> */}
                {showLegend && <LegendClass manager={this} />}
                {this.placedSeries.map((facetChart, index: number) => {
                    const { bounds, seriesName } = facetChart

                    return (
                        <React.Fragment key={index}>
                            <text
                                x={bounds.x}
                                y={bounds.top - this.labelPadding}
                                fill={GRAPHER_DARK_TEXT}
                                fontSize={facetFontSize}
                                style={{ fontWeight: 700 }}
                            >
                                {/* todo: overlaps if too long */}
                                {seriesName}
                                <title>{seriesName}</title>
                            </text>
                            <g id={makeIdForHumanConsumption(seriesName)}>
                                <MapChart
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
