import React from "react"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    excludeUndefined,
    GridParameters,
    HorizontalAlign,
    Color,
    makeIdForHumanConsumption,
    exposeInstanceOnWindow,
    SplitBoundsPadding,
} from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { ChartErrorInfo, Time } from "@ourworldindata/types"
import { getFontSize, getLabelPadding } from "../facetChart/FacetChartUtils"
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
import { MapChart } from "../mapCharts/MapChart"
import { MapChartManager } from "../mapCharts/MapChartConstants"

// should be the same as in MapChart
const PADDING_BETWEEN_MAP_AND_LEGEND = 8

const PADDING_BELOW_LEGEND = 4
const PADDING_BETWEEN_LEGENDS = 4

@observer
export class FacetMap
    extends React.Component<FacetMapProps>
    implements MapChart, HorizontalColorLegendManager
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

    @computed get startTime(): Time {
        return this.manager.startTime ?? 0
    }

    @computed get endTime(): Time {
        return this.manager.endTime ?? 0
    }

    @computed private get bounds(): Bounds {
        const bounds = this.props.bounds ?? DEFAULT_BOUNDS
        return bounds.padTop(4)
    }

    @computed private get facetsContainerBounds(): Bounds {
        return this.bounds
            .padTop(this.facetFontSize + this.labelPadding)
            .padBottom(this.legendHeight + PADDING_BETWEEN_MAP_AND_LEGEND)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get facetFontSize(): number {
        return getFontSize(this.series.length, this.fontSize)
    }

    @computed private get gridParams(): GridParameters {
        // TODO: optimise
        return { rows: 1, columns: 2, count: 2 }
    }

    @computed private get facetGridPadding(): SplitBoundsPadding {
        const { facetFontSize } = this
        return { columnPadding: facetFontSize }
    }

    @computed private get labelPadding(): number {
        return getLabelPadding(this.facetFontSize)
    }

    @computed get series(): MapFacetSeries[] {
        return [this.startTime, this.endTime].map((time) => ({
            seriesName: this.transformedTable.timeColumn.formatTime(time),
            // Required for a ChartSeries, but isn't meaningful for facets
            color: "none",
            // Only set overrides for this facet strategy.
            // Default properties are set elsewhere.
            manager: { targetTime: time },
        }))
    }

    // TODO: alternatively, we could only keep one map instance around for the map
    @computed private get intermediatePlacedSeries(): PlacedMapFacetSeries[] {
        const { manager, series, legendHoverBin } = this

        // We are using `bounds` instead of `facetsContainerBounds` because the legend
        // is not yet created, and it is derived from the intermediate chart series.
        const gridBoundsArr = this.bounds.grid(
            this.gridParams,
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
            // logGrapherInteractionEvent,
        } = manager

        const table = this.transformedTable
        const highlightedTimesInTooltip = [this.startTime, this.endTime] as [
            number,
            number,
        ]

        return series.map((series, index) => {
            const { bounds } = gridBoundsArr[index]
            const manager: MapChartManager = {
                table,
                fontSize: this.facetFontSize,
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
                highlightedTimesInTooltip,
                // logGrapherInteractionEvent,
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

    @computed get intermediateMapInstances(): MapChart[] {
        return this.intermediatePlacedSeries.map(({ bounds, manager }) => {
            return new MapChart({ bounds, manager })
        })
    }

    @computed get placedSeries(): PlacedMapFacetSeries[] {
        const gridBoundsArr = this.facetsContainerBounds.grid(
            this.gridParams,
            this.facetGridPadding
        )
        return this.intermediatePlacedSeries.map((series, i) => {
            const { bounds } = gridBoundsArr[i]
            return { ...series, bounds }
        })
    }

    // legend utils

    @computed private get externalLegends(): HorizontalColorLegendManager[] {
        return excludeUndefined(
            this.intermediateMapInstances.map(
                (instance) => instance.externalLegend
            )
        )
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
        if (!this.numericLegend) return 0
        return (
            this.bounds.bottom -
            this.numericLegendHeight -
            PADDING_BELOW_LEGEND -
            // If present, the category legend is placed below the numeric legend
            (this.categoryLegend
                ? this.categoryLegendHeight + PADDING_BETWEEN_LEGENDS
                : 0)
        )
    }

    @computed get categoryLegendY(): number {
        if (!this.categoryLegend) return 0
        return (
            this.bounds.bottom -
            this.categoryLegend.height -
            PADDING_BELOW_LEGEND
        )
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

    @computed get numericLegendData(): ColorScaleBin[] {
        return this.getExternalLegendProp("numericLegendData") ?? []
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.getExternalLegendProp("categoricalLegendData") ?? []
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height : 0
    }

    @observable.ref private legendHoverBin: ColorScaleBin | undefined =
        undefined

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.legendHoverBin = bin
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendHoverBin = undefined
    }

    // end of legend props

    @computed get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegend(): HorizontalNumericColorLegend | undefined {
        return this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "facet")
    }

    renderMapLegend(): React.ReactElement | null {
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
        const { facetFontSize, showLegend } = this
        return (
            <React.Fragment>
                {/* <rect {...this.bounds.toProps()} fill="none" stroke="black" />
                <rect
                    {...this.facetsContainerBounds.toProps()}
                    fill="none"
                    stroke="green"
                /> */}
                {showLegend && this.renderMapLegend()}
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
