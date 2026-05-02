import React, { Component, PointerEvent, createRef } from "react"
import { observer } from "mobx-react"
import { action, computed, makeObservable, observable } from "mobx"
import {
    Bounds,
    HorizontalAlign,
    getRelativeMouse,
    guid,
    makeFigmaId,
} from "@ourworldindata/utils"
import { LoadingIndicator } from "@ourworldindata/components"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../legend/HorizontalColorLegends"
import { TooltipState } from "../tooltip/Tooltip"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_MAX_TOOLTIP_WIDTH,
    Patterns,
} from "../core/GrapherConstants"
import {
    BLUR_FILL_OPACITY,
    BLUR_STROKE_OPACITY,
    DEFAULT_STROKE_COLOR,
    HOVER_STROKE_COLOR,
    HOVER_STROKE_WIDTH,
    MapBracket,
    MapChartManager,
    PROJECTED_DATA_LEGEND_COLOR,
} from "../mapCharts/MapChartConstants"
import { MapConfig } from "../mapCharts/MapConfig"
import { MapTooltip } from "../mapCharts/MapTooltip"
import {
    NoDataPattern,
    ProjectedDataPattern,
    makeProjectedDataPatternId,
} from "../mapCharts/MapComponents"
import {
    CategoricalBin,
    ColorScaleBin,
    isCategoricalBin,
    isNoDataBin,
    isNumericBin,
    isProjectedDataBin,
    NumericBin,
} from "../color/ColorScaleBin"
import { ColorScale } from "../color/ColorScale"
import { LegendStyleConfig } from "../legend/LegendStyleConfig"
import { Emphasis } from "../interaction/Emphasis"
import { InteractionState } from "../interaction/InteractionState"
import { MapSelectionArray } from "../selection/MapSelectionArray"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { CartogramChartState, CartogramSeries } from "./CartogramChartState"
import { CartogramLayout, CartogramRenderFeature } from "./CartogramFeatures"
import { findClosestCartogramLayout } from "./CartogramLayouts"
import { loadCartogramLayout } from "./CartogramDataLoader"

export type CartogramChartProps = ChartComponentProps<CartogramChartState>

const CARTOGRAM_CHART_CLASSNAME = "CartogramChart"
const CARTOGRAM_FEATURES_CLASSNAME = "CartogramFeatures"
const PADDING_BETWEEN_CARTOGRAM_AND_LEGEND = 8
const PADDING_BELOW_CARTOGRAM_LEGEND = 4
const PADDING_BETWEEN_CARTOGRAM_LEGENDS = 4
const CARTOGRAM_LEGEND_MAX_WIDTH_RATIO = 0.95
const DEFAULT_CARTOGRAM_STROKE_WIDTH = 0.35
const SELECTED_CARTOGRAM_STROKE_WIDTH = 1.2

@observer
export class CartogramChart
    extends Component<CartogramChartProps>
    implements ChartInterface, HorizontalColorLegendManager
{
    constructor(props: CartogramChartProps) {
        super(props)
        makeObservable<CartogramChart, "layout" | "layoutError">(this, {
            hoverBracket: observable,
            tooltipState: observable,
            layout: observable.ref,
            layoutError: observable.ref,
        })
    }

    hoverBracket: MapBracket | undefined = undefined
    tooltipState = new TooltipState<{ featureId: string }>()
    private layout: CartogramLayout | undefined = undefined
    private layoutError: Error | undefined = undefined
    private requestedLayoutUrl: string | undefined = undefined

    base = createRef<SVGGElement>()

    @computed get chartState(): CartogramChartState {
        return this.props.chartState
    }

    @computed private get manager(): MapChartManager {
        return this.chartState.manager
    }

    @computed get mapConfig(): MapConfig {
        return this.chartState.mapConfig
    }

    @computed get selectionArray(): MapSelectionArray {
        return this.chartState.selectionArray
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get colorScale(): ColorScale {
        return this.chartState.colorScale
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    override componentDidMount(): void {
        void this.loadLayoutIfNeeded()
    }

    override componentDidUpdate(): void {
        void this.loadLayoutIfNeeded()
    }

    override componentWillUnmount(): void {
        this.onCartogramMouseLeave()
        this.onLegendMouseLeave()
    }

    @computed private get targetLayoutDefinition() {
        return findClosestCartogramLayout(this.chartState.targetTime)
    }

    @action.bound private async loadLayoutIfNeeded(): Promise<void> {
        const layoutDefinition = this.targetLayoutDefinition
        if (this.layout?.url === layoutDefinition.url) return
        if (this.requestedLayoutUrl === layoutDefinition.url) return

        this.requestedLayoutUrl = layoutDefinition.url
        this.layoutError = undefined

        try {
            const layout = await loadCartogramLayout(layoutDefinition)
            if (this.requestedLayoutUrl !== layout.url) return
            this.setLayout(layout)
        } catch (error) {
            if (this.requestedLayoutUrl !== layoutDefinition.url) return
            this.setLayoutError(
                error instanceof Error ? error : new Error(`${error}`)
            )
        }
    }

    @action.bound private setLayout(layout: CartogramLayout): void {
        this.layout = layout
        this.layoutError = undefined
    }

    @action.bound private setLayoutError(error: Error): void {
        this.layout = undefined
        this.layoutError = error
    }

    @action.bound onCartogramMouseOver(featureId: string): void {
        this.mapConfig.hoverCountry = featureId
        this.tooltipState.target = { featureId }
        this.manager.logGrapherInteractionEvent?.(
            "map_country_hover",
            featureId
        )
    }

    @action.bound onCartogramPointerMove(ev: PointerEvent): void {
        const ref = this.manager?.base?.current
        if (ref) this.tooltipState.position = getRelativeMouse(ref, ev)
    }

    @action.bound onCartogramMouseLeave(): void {
        this.mapConfig.hoverCountry = undefined
        this.tooltipState.target = null
    }

    @action.bound onLegendMouseEnter(bracket: MapBracket): void {
        this.manager.logGrapherInteractionEvent?.(
            "map_legend_hover",
            bracket.label
        )
    }

    @action.bound onLegendMouseOver(bracket: MapBracket): void {
        this.hoverBracket = bracket
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoverBracket = undefined
    }

    @computed private get legendData(): ColorScaleBin[] {
        return this.colorScale.legendBins.filter((bin) => !bin.isHidden)
    }

    private maybeAddPatternRefToBin<Bin extends ColorScaleBin>(bin: Bin): Bin {
        if (isNoDataBin(bin))
            return new CategoricalBin({
                ...bin.props,
                patternRef: Patterns.noDataPattern,
            }) as Bin

        if (isProjectedDataBin(bin)) {
            const patternRef = makeProjectedDataPatternId(
                PROJECTED_DATA_LEGEND_COLOR,
                { forLegend: true }
            )
            return new CategoricalBin({ ...bin.props, patternRef }) as Bin
        }

        if (this.chartState.hasProjectedData) {
            const patternRef = makeProjectedDataPatternId(bin.color, {
                forLegend: true,
            })
            return (
                bin instanceof CategoricalBin
                    ? new CategoricalBin({ ...bin.props, patternRef })
                    : new NumericBin({ ...bin.props, patternRef })
            ) as Bin
        }

        return bin
    }

    @computed get numericLegendData(): ColorScaleBin[] {
        const hasNoDataBin = this.legendData.some((bin) => isNoDataBin(bin))
        if (this.hasCategoricalLegendData || !hasNoDataBin)
            return this.legendData
                .filter((bin) => isNumericBin(bin))
                .map((bin) => this.maybeAddPatternRefToBin(bin))

        const bins = this.legendData
            .filter((bin) => isNumericBin(bin) || isNoDataBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))

        return [bins[bins.length - 1], ...bins.slice(0, -1)]
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.legendData
            .filter((bin) => isCategoricalBin(bin))
            .map((bin) => this.maybeAddPatternRefToBin(bin))
    }

    @computed private get hasCategoricalLegendData(): boolean {
        return this.categoricalLegendData.length > 1
    }

    @computed get binColors(): string[] {
        return this.legendData.map((bin) => bin.color)
    }

    @computed private get hoverValue(): string | number | undefined {
        if (!this.mapConfig.hoverCountry) return undefined
        const series = this.chartState.getSeriesForCartogramEntity(
            this.mapConfig.hoverCountry
        )
        return series?.value ?? "No data"
    }

    @computed private get numericHoverBracket(): ColorScaleBin | undefined {
        const { hoverBracket, hoverValue, numericLegendData } = this
        const { externalLegendHoverBin } = this.manager

        if (hoverBracket) return hoverBracket
        if (hoverValue !== undefined)
            return numericLegendData.find((bin) => bin.contains(hoverValue))
        return externalLegendHoverBin
    }

    @computed private get categoricalHoverBracket():
        | CategoricalBin
        | undefined {
        const { hoverBracket, hoverValue, categoricalLegendData } = this

        if (hoverBracket && hoverBracket instanceof CategoricalBin)
            return hoverBracket
        if (hoverValue !== undefined)
            return categoricalLegendData.find((bin) => bin.contains(hoverValue))
        return undefined
    }

    resolveLegendBinEmphasis(bin: ColorScaleBin): Emphasis {
        if (!this.categoricalHoverBracket && !this.numericHoverBracket)
            return Emphasis.Default
        if (
            this.categoricalHoverBracket &&
            bin.equals(this.categoricalHoverBracket)
        )
            return Emphasis.Highlighted
        if (this.numericHoverBracket && bin.equals(this.numericHoverBracket))
            return Emphasis.Highlighted
        return Emphasis.Muted
    }

    legendStyleConfig: LegendStyleConfig = {
        marker: {
            default: { stroke: DEFAULT_STROKE_COLOR },
            highlighted: {
                stroke: HOVER_STROKE_COLOR,
                strokeWidth: HOVER_STROKE_WIDTH,
            },
        },
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width * CARTOGRAM_LEGEND_MAX_WIDTH_RATIO
    }

    @computed get legendX(): number {
        return this.bounds.x + (this.bounds.width - this.legendMaxWidth) / 2
    }

    @computed get legendHeight(): number {
        return this.categoryLegendHeight + this.numericLegendHeight
    }

    @computed private get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed private get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height : 0
    }

    @computed private get categoryLegend():
        | HorizontalCategoricalColorLegend
        | undefined {
        return this.manager.showLegend && this.categoricalLegendData.length > 1
            ? new HorizontalCategoricalColorLegend({ manager: this })
            : undefined
    }

    @computed private get numericLegend():
        | HorizontalNumericColorLegend
        | undefined {
        return this.manager.showLegend && this.numericLegendData.length > 1
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get categoryLegendY(): number {
        if (!this.categoryLegend) return 0
        return (
            this.bounds.bottom -
            this.categoryLegend.height -
            PADDING_BELOW_CARTOGRAM_LEGEND
        )
    }

    @computed get numericLegendY(): number {
        if (!this.numericLegend) return 0
        return (
            this.bounds.bottom -
            this.numericLegendHeight -
            PADDING_BELOW_CARTOGRAM_LEGEND -
            (this.categoryLegend
                ? this.categoryLegendHeight + PADDING_BETWEEN_CARTOGRAM_LEGENDS
                : 0)
        )
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    @computed get numericBinSize(): number {
        return 0.625 * this.fontSize
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.manager.showLegend) return undefined
        return {
            numericLegendData: this.numericLegendData,
            categoricalLegendData: this.categoricalLegendData,
            legendMaxWidth: this.legendMaxWidth,
            legendStyleConfig: this.legendStyleConfig,
        }
    }

    private isHovered(featureId: string): boolean {
        const { hoverBracket } = this
        const { externalLegendHoverBin } = this.manager

        if (this.mapConfig.hoverCountry === featureId) return true

        const series = this.chartState.getSeriesForCartogramEntity(featureId)
        if (
            hoverBracket?.contains(series?.value, {
                isProjection: series?.isProjection,
            })
        )
            return true

        if (externalLegendHoverBin?.contains(series?.value)) return true

        return false
    }

    isSelected(featureId: string): boolean {
        return this.selectionArray.selectedSet.has(featureId)
    }

    getHoverState(featureId: string): InteractionState {
        const isHovered = this.isHovered(featureId)
        const isHoverModeActive = !!(
            this.hoverBracket || this.manager.externalLegendHoverBin
        )
        return new InteractionState(isHovered, isHoverModeActive)
    }

    @computed get cartogramBounds(): Bounds {
        return this.bounds.padBottom(
            this.legendHeight
                ? this.legendHeight +
                      PADDING_BETWEEN_CARTOGRAM_AND_LEGEND +
                      PADDING_BELOW_CARTOGRAM_LEGEND
                : 0
        )
    }

    @computed private get cartogramTransform(): string | undefined {
        if (!this.layout) return undefined
        const { bounds } = this.layout
        if (bounds.width === 0 || bounds.height === 0) return undefined

        const scale = Math.min(
            this.cartogramBounds.width / bounds.width,
            this.cartogramBounds.height / bounds.height
        )
        const x =
            this.cartogramBounds.x +
            (this.cartogramBounds.width - bounds.width * scale) / 2 -
            bounds.x * scale
        const y =
            this.cartogramBounds.y +
            (this.cartogramBounds.height - bounds.height * scale) / 2 -
            bounds.y * scale

        return `translate(${x},${y}) scale(${scale})`
    }

    @computed private get cartogramScale(): number {
        if (!this.layout) return 1
        return Math.min(
            this.cartogramBounds.width / this.layout.bounds.width,
            this.cartogramBounds.height / this.layout.bounds.height
        )
    }

    @computed private get cartogramStrokeScale(): number {
        return Math.sqrt(this.cartogramScale)
    }

    private getStrokeWidth({
        isHovered,
        isSelected,
    }: {
        isHovered: boolean
        isSelected: boolean
    }): number {
        if (isHovered) return HOVER_STROKE_WIDTH / this.cartogramStrokeScale
        if (isSelected)
            return SELECTED_CARTOGRAM_STROKE_WIDTH / this.cartogramStrokeScale
        return DEFAULT_CARTOGRAM_STROKE_WIDTH / this.cartogramStrokeScale
    }

    private renderFeature({
        feature,
        series,
        patternId,
    }: {
        feature: CartogramRenderFeature
        series?: CartogramSeries
        patternId: string
    }): React.ReactElement {
        const hover = this.getHoverState(feature.id)
        const isHovered = hover.active
        const isSelected = this.isSelected(feature.id)
        const stroke =
            isHovered || isSelected ? HOVER_STROKE_COLOR : DEFAULT_STROKE_COLOR
        const strokeWidth = this.getStrokeWidth({ isHovered, isSelected })
        const fillOpacity = hover.background ? BLUR_FILL_OPACITY : 1
        const strokeOpacity = hover.background ? BLUR_STROKE_OPACITY : 1
        const fill = series
            ? series.isProjection
                ? `url(#${makeProjectedDataPatternId(series.color)})`
                : series.color
            : `url(#${patternId})`

        return (
            <g
                key={feature.id}
                id={makeFigmaId(feature.id)}
                data-feature-id={feature.id}
                cursor="pointer"
                onClick={(event) => {
                    event.stopPropagation()
                    this.onClick(feature)
                }}
                onPointerEnter={(event) => {
                    if (event.pointerType === "touch") return
                    this.onCartogramMouseOver(feature.id)
                }}
                onPointerLeave={(event) => {
                    if (event.pointerType === "touch") return
                    this.onCartogramMouseLeave()
                }}
            >
                <path
                    d={feature.fillPath}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke="none"
                />
                <path
                    d={feature.outlinePath}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    pointerEvents="none"
                />
            </g>
        )
    }

    @action.bound private onClick(feature: CartogramRenderFeature): void {
        this.onCartogramMouseOver(feature.id)
        if (this.manager.isMapSelectionEnabled)
            this.selectionArray.toggleSelection(feature.id)
    }

    @computed private get featuresWithSeries(): {
        feature: CartogramRenderFeature
        series?: CartogramSeries
    }[] {
        if (!this.layout) return []
        return this.layout.features.map((feature) => ({
            feature,
            series: this.chartState.getSeriesForCartogramEntity(feature.id),
        }))
    }

    @computed private get sortedFeaturesWithSeries(): {
        feature: CartogramRenderFeature
        series?: CartogramSeries
    }[] {
        return this.featuresWithSeries.slice().sort((a, b) => {
            const aHovered = this.getHoverState(a.feature.id).active ? 1 : 0
            const bHovered = this.getHoverState(b.feature.id).active ? 1 : 0
            if (aHovered !== bHovered) return aHovered - bHovered
            const aSelected = this.isSelected(a.feature.id) ? 1 : 0
            const bSelected = this.isSelected(b.feature.id) ? 1 : 0
            if (aSelected !== bSelected) return aSelected - bSelected
            return b.feature.bounds.area - a.feature.bounds.area
        })
    }

    private renderCartogram(): React.ReactElement {
        const patternId = Patterns.noDataPatternForMap
        const transform = this.cartogramTransform

        return (
            <g className={CARTOGRAM_FEATURES_CLASSNAME} transform={transform}>
                <defs>
                    <NoDataPattern
                        patternId={patternId}
                        scale={1 / this.cartogramScale}
                    />
                    {this.chartState.hasProjectedData && (
                        <>
                            <ProjectedDataPattern
                                color={PROJECTED_DATA_LEGEND_COLOR}
                                forLegend
                            />
                            {this.binColors.map((color, index) => (
                                <ProjectedDataPattern
                                    key={`${color}-${index}-legend`}
                                    color={color}
                                    forLegend
                                />
                            ))}
                            {this.binColors.map((color, index) => (
                                <ProjectedDataPattern
                                    key={`${color}-${index}`}
                                    color={color}
                                    scale={1 / this.cartogramScale}
                                />
                            ))}
                        </>
                    )}
                </defs>
                {this.sortedFeaturesWithSeries.map(({ feature, series }) =>
                    this.renderFeature({ feature, series, patternId })
                )}
            </g>
        )
    }

    renderCartogramLegend(): React.ReactElement {
        const { numericLegend, categoryLegend } = this
        return (
            <>
                {numericLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                {categoryLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
            </>
        )
    }

    private renderLoading(): React.ReactElement {
        return (
            <foreignObject {...this.cartogramBounds.toProps()}>
                <LoadingIndicator title="Loading cartogram…" />
            </foreignObject>
        )
    }

    renderStatic(): React.ReactElement {
        if (!this.layout) return this.renderLoading()
        return (
            <>
                {this.renderCartogram()}
                {this.renderCartogramLegend()}
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        const { tooltipState } = this

        if (!this.layout) return this.renderLoading()

        let sparklineWidth: number | undefined
        if (this.manager.shouldPinTooltipToBottom) {
            const windowWidth = window?.innerWidth ?? 240
            sparklineWidth = Math.min(
                GRAPHER_MAX_TOOLTIP_WIDTH,
                windowWidth - 8
            )
        }

        const tooltipFeatureId = tooltipState.target?.featureId
        const tooltipSeries = tooltipFeatureId
            ? this.chartState.getSeriesForCartogramEntity(tooltipFeatureId)
            : undefined
        const tooltipDataEntityName =
            tooltipSeries?.dataEntityName ?? tooltipFeatureId

        return (
            <g
                ref={this.base}
                className={CARTOGRAM_CHART_CLASSNAME}
                onPointerMove={this.onCartogramPointerMove}
            >
                <rect
                    x={this.cartogramBounds.x}
                    y={this.cartogramBounds.y}
                    width={this.cartogramBounds.width}
                    height={this.cartogramBounds.height}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderCartogram()}
                {this.renderCartogramLegend()}
                {tooltipFeatureId && tooltipDataEntityName && (
                    <MapTooltip
                        mapColumnSlug={this.chartState.mapColumnSlug}
                        mapColumnInfo={this.chartState.mapColumnInfo}
                        entityName={tooltipDataEntityName}
                        titleEntityName={tooltipFeatureId}
                        valueSourceEntityName={
                            tooltipDataEntityName !== tooltipFeatureId
                                ? tooltipDataEntityName
                                : undefined
                        }
                        position={tooltipState.position}
                        fading={tooltipState.fading}
                        timeSeriesTable={this.chartState.inputTable}
                        formatValueForTooltip={
                            this.chartState.formatValueForTooltip
                        }
                        manager={this.manager}
                        lineColorScale={this.colorScale}
                        targetTime={this.chartState.targetTime}
                        targetTimes={this.manager.highlightedTimesInTooltip}
                        sparklineWidth={sparklineWidth}
                        dismissTooltip={action(() => {
                            this.mapConfig.hoverCountry = undefined
                            this.tooltipState.target = null
                        })}
                    />
                )}
            </g>
        )
    }

    @computed private get renderUid(): number {
        return guid()
    }

    override render(): React.ReactElement {
        // Keep renderUid referenced so repeated chart renders don't share defs ids
        void this.renderUid

        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        if (this.layoutError)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message="Unable to load cartogram layout"
                />
            )

        return this.isStatic ? this.renderStatic() : this.renderInteractive()
    }
}
