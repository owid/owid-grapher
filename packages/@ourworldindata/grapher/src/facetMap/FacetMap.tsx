import React from "react"
import { observer } from "mobx-react"
import {
    Bounds,
    GridParameters,
    HorizontalAlign,
    Color,
    makeIdForHumanConsumption,
    exposeInstanceOnWindow,
    SplitBoundsPadding,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import {
    ChartErrorInfo,
    GRAPHER_MAP_TYPE,
    MapRegionName,
    Time,
} from "@ourworldindata/types"
import {
    calculateAspectRatio,
    getFacetGridPadding,
    getLabelPadding as getFacetLabelPadding,
} from "../facetChart/FacetChartUtils"
import {
    FacetMapManager,
    MapFacetSeries,
    FacetMapProps,
    PlacedMapFacetSeries,
} from "./FacetMapConstants"
import { OwidTable } from "@ourworldindata/core-table"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import {
    MAP_LEGEND_MAX_WIDTH_RATIO,
    MapChart,
    PADDING_BELOW_MAP_LEGEND,
    PADDING_BETWEEN_MAP_AND_LEGEND,
    PADDING_BETWEEN_MAP_LEGENDS,
} from "../mapCharts/MapChart"
import { MAP_VIEWPORTS, MapChartManager } from "../mapCharts/MapChartConstants"
import { GrapherInteractionEvent } from "../core/GrapherAnalytics"
import { ChartComponent, makeChartInstance } from "../chart/ChartTypeMap"

@observer // todo: implements ChartState?
export class FacetMap
    extends React.Component<FacetMapProps>
    implements HorizontalColorLegendManager
{
    constructor(props: FacetMapProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): FacetMapManager {
        return this.props.manager
    }

    @computed private get table(): OwidTable {
        return this.manager.table
    }

    @computed private get transformedTableFromGrapher(): OwidTable | undefined {
        return this.manager.transformedTable
    }

    @computed get isStatic(): boolean {
        return !!this.manager.isStatic
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.manager.startTime === undefined)
            return { reason: "No start time selected" }

        if (this.manager.endTime === undefined)
            return { reason: "No end time selected" }

        return { reason: "" }
    }

    @computed private get startTime(): Time {
        return this.manager.startTime!
    }

    @computed private get endTime(): Time {
        return this.manager.endTime!
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get facetsContainerBounds(): Bounds {
        return (
            this.bounds
                // make space for facet labels
                .padTop(this.labelHeight + this.labelPadding)
                // make space for the legend
                .padBottom(
                    this.legendHeight +
                        PADDING_BETWEEN_MAP_AND_LEGEND +
                        PADDING_BELOW_MAP_LEGEND
                )
        )
    }

    @computed private get targetTimes(): [Time, Time] {
        return [this.startTime, this.endTime]
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get facetFontSize(): number {
        return Math.floor(this.fontSize * GRAPHER_FONT_SCALE_14)
    }

    private getGridParams(bounds: Bounds): GridParameters {
        const horizontalLayout = { rows: 1, columns: 2, count: 2 }
        const verticalLayout = { rows: 2, columns: 1, count: 2 }

        // We determine the preferred layout (horizontal vs vertical)
        // by comparing which orientation produces an aspect ratio closest to
        // the map's natural aspect ratio. The globe uses the same layout
        // as the corresponding 2d map.

        const region = this.manager.mapConfig?.region ?? MapRegionName.World
        const mapAspectRatio = MAP_VIEWPORTS[region].ratio

        // If faceted maps are side-by-side
        const horizontalLayoutAspectRatio = calculateAspectRatio(
            bounds.width / 2,
            bounds.height
        )

        // If faceted maps are stacked vertically
        const verticalLayoutAspectRatio = calculateAspectRatio(
            bounds.width,
            bounds.height / 2
        )

        const horizontalDiff = Math.abs(
            mapAspectRatio - horizontalLayoutAspectRatio
        )
        const verticalDiff = Math.abs(
            mapAspectRatio - verticalLayoutAspectRatio
        )

        return horizontalDiff - verticalDiff <= 0
            ? horizontalLayout
            : verticalLayout
    }

    @computed private get facetGridPadding(): SplitBoundsPadding {
        return getFacetGridPadding({
            baseFontSize: this.facetFontSize,
            shouldAddRowPadding: false,
        })
    }

    @computed private get labelHeight(): number {
        return this.facetFontSize
    }

    @computed private get labelPadding(): number {
        return getFacetLabelPadding(this.facetFontSize)
    }

    @computed private get series(): MapFacetSeries[] {
        return this.targetTimes.map((time) => ({
            seriesName: this.table.timeColumn.formatTime(time),
            // Required for a ChartSeries, but isn't meaningful for facets
            color: "none",
            // Only set overrides for this facet. Default properties are set elsewhere.
            manager: { targetTime: time },
        }))
    }

    @action.bound logGrapherInteractionEvent(
        action: GrapherInteractionEvent,
        target?: string
    ): void {
        this.manager.analytics?.logGrapherInteractionEvent(action, {
            ...this.manager.analyticsContext,
            target,
        })
    }

    @computed private get intermediatePlacedSeries(): PlacedMapFacetSeries[] {
        const {
            manager,
            series,
            table,
            transformedTableFromGrapher,
            targetTimes,
            facetFontSize,
            legendHoverBin,
            logGrapherInteractionEvent,
        } = this

        // We are using `bounds` instead of `facetsContainerBounds` because the legend
        // is not yet created, and it is derived from the intermediate chart series.
        const bounds = this.bounds
        const gridBoundsArr = bounds.grid(
            this.getGridParams(bounds),
            this.facetGridPadding
        )

        const {
            backgroundColor,
            isStatic,
            mapColumnSlug = "",
            mapConfig,
            isMapSelectionEnabled,
            colorScale,
            mapRegionDropdownValue,
            resetMapRegionDropdownValue,
            globeController,
            base,
            tooltip,
            shouldPinTooltipToBottom,
            projectionColumnInfoBySlug,
        } = manager

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]

            const manager: MapChartManager = {
                table,
                transformedTable: transformedTableFromGrapher,
                fontSize: facetFontSize,
                showLegend: false,
                backgroundColor,
                isStatic,
                mapColumnSlug,
                mapConfig,
                isMapSelectionEnabled,
                colorScale,
                mapRegionDropdownValue,
                resetMapRegionDropdownValue,
                globeController,
                base,
                tooltip,
                shouldPinTooltipToBottom,
                externalLegendHoverBin: legendHoverBin,
                logGrapherInteractionEvent,
                disableIntroAnimation: true,
                projectionColumnInfoBySlug,
                highlightedTimesInTooltip: targetTimes,
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

    /**
     * Used to construct the shared legend for all map facets.
     *
     * Unlike in FacetChart, we only need a single MapChart instance to construct
     * the legend since all facets share the same legend.
     */
    @computed get intermediateMapInstance(): MapChart {
        const { bounds, manager } = this.intermediatePlacedSeries[0]
        return makeChartInstance({
            manager,
            bounds,
            chartType: GRAPHER_MAP_TYPE,
            renderMode: this.manager.renderMode,
        }) as MapChart
    }

    @computed get placedSeries(): PlacedMapFacetSeries[] {
        const bounds = this.facetsContainerBounds
        const gridBoundsArr = bounds.grid(
            this.getGridParams(bounds),
            this.facetGridPadding
        )
        return this.intermediatePlacedSeries.map((series, i) => {
            const { bounds } = gridBoundsArr[i]
            return { ...series, bounds }
        })
    }

    @computed private get externalLegend():
        | HorizontalColorLegendManager
        | undefined {
        return this.intermediateMapInstance.externalLegend
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get numericLegendY(): number {
        if (!this.numericLegend) return 0
        return (
            this.bounds.bottom -
            this.numericLegendHeight -
            PADDING_BELOW_MAP_LEGEND -
            // If present, the category legend is placed below the numeric legend
            (this.categoryLegend
                ? this.categoryLegendHeight + PADDING_BETWEEN_MAP_LEGENDS
                : 0)
        )
    }

    @computed get categoryLegendY(): number {
        if (!this.categoryLegend) return 0
        return (
            this.bounds.bottom -
            this.categoryLegend.height -
            PADDING_BELOW_MAP_LEGEND
        )
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width * MAP_LEGEND_MAX_WIDTH_RATIO
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get hoverColors(): Color[] | undefined {
        if (!this.legendHoverBin) return undefined
        return [this.legendHoverBin.color]
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        return this.externalLegend?.numericLegendData ?? []
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.externalLegend?.categoricalLegendData ?? []
    }

    @computed get categoricalBinStroke(): Color | undefined {
        return this.externalLegend?.categoricalBinStroke
    }

    @computed private get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed private get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height : 0
    }

    @computed get legendHeight(): number {
        return this.categoryLegendHeight + this.numericLegendHeight
    }

    @observable.ref private legendHoverBin: ColorScaleBin | undefined =
        undefined

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.legendHoverBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendHoverBin = undefined
    }

    @computed private get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "facet")
    }

    private renderMapLegend(): React.ReactElement {
        return (
            <>
                {this.numericLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                {this.categoryLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
            </>
        )
    }

    render(): React.ReactElement {
        const { facetFontSize, labelPadding } = this
        return (
            <React.Fragment>
                {this.renderMapLegend()}
                {this.placedSeries.map((series) => {
                    const { bounds, seriesName } = series

                    return (
                        <React.Fragment key={seriesName}>
                            <text
                                x={bounds.centerX}
                                y={bounds.top - labelPadding}
                                fill={GRAPHER_DARK_TEXT}
                                fontSize={facetFontSize}
                                textAnchor="middle"
                                style={{ fontWeight: 700 }}
                            >
                                {seriesName}
                                <title>{seriesName}</title>
                            </text>
                            <g id={makeIdForHumanConsumption(seriesName)}>
                                <ChartComponent
                                    manager={series.manager}
                                    chartType={GRAPHER_MAP_TYPE}
                                    renderMode={this.manager.renderMode}
                                    bounds={bounds}
                                />
                            </g>
                        </React.Fragment>
                    )
                })}
            </React.Fragment>
        )
    }
}
