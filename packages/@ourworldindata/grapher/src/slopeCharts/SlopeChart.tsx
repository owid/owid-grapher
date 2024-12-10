import React from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    domainExtent,
    exposeInstanceOnWindow,
    PointVector,
    clamp,
    makeIdForHumanConsumption,
    guid,
    excludeUndefined,
    getRelativeMouse,
    minBy,
    dyFromAlign,
    uniq,
    sortBy,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_OPACITY_MUTE,
} from "../core/GrapherConstants"
import {
    ScaleType,
    SeriesName,
    ColorSchemeName,
    ColumnSlug,
    MissingDataStrategy,
    Time,
    SeriesStrategy,
    EntityName,
    VerticalAlign,
    FacetStrategy,
    InteractionState,
} from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { scaleLinear, ScaleLinear } from "d3-scale"
import { select } from "d3-selection"
import {
    PlacedSlopeChartSeries,
    RawSlopeChartSeries,
    RenderSlopeChartSeries,
    SlopeChartSeries,
} from "./SlopeChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    byHoverThenFocusState,
    getDefaultFailMessage,
    getHoverStateForSeries,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { AxisConfig } from "../axis/AxisConfig"
import { VerticalAxis } from "../axis/Axis"
import { VerticalAxisComponent } from "../axis/AxisViews"
import { NoDataSection } from "../scatterCharts/NoDataSection"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import {
    LineLabelSeries,
    LineLegend,
    LineLegendProps,
} from "../lineLegend/LineLegend"
import {
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    Tooltip,
    TooltipState,
    TooltipValueRange,
} from "../tooltip/Tooltip"
import { TooltipFooterIcon } from "../tooltip/TooltipProps"
import {
    AnnotationsMap,
    getAnnotationsForSeries,
    getAnnotationsMap,
    getColorKey,
    getSeriesName,
} from "../lineCharts/LineChartHelpers"
import { SelectionArray } from "../selection/SelectionArray"
import { Halo } from "@ourworldindata/components"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import {
    OWID_NON_FOCUSED_GRAY,
    GRAPHER_BACKGROUND_DEFAULT,
    GRAPHER_DARK_TEXT,
} from "../color/ColorConstants"
import { InteractionArray } from "../selection/InteractionArray"

type SVGMouseOrTouchEvent =
    | React.MouseEvent<SVGGElement>
    | React.TouchEvent<SVGGElement>

export interface SlopeChartManager extends ChartManager {
    canSelectMultipleEntities?: boolean // used to pick an appropriate series name
    hasTimeline?: boolean // used to filter the table for the entity selector
    hideNoDataSection?: boolean
}

const NON_FOCUSED_LINE_COLOR = OWID_NON_FOCUSED_GRAY

const TOP_PADDING = 6 // leave room for overflowing dots
const LINE_LEGEND_PADDING = 4

@observer
export class SlopeChart
    extends React.Component<{
        bounds?: Bounds
        manager: SlopeChartManager
    }>
    implements ChartInterface
{
    private slopeAreaRef: React.RefObject<SVGGElement> = React.createRef()
    private defaultBaseColorScheme = ColorSchemeName.OwidDistinctLines

    private sidebarMargin = 10

    @observable hoveredSeriesName?: string
    @observable tooltipState = new TooltipState<{
        series: SlopeChartSeries
    }>({ fade: "immediate" })

    transformTable(table: OwidTable) {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        // if time selection is disabled, then filter all entities that
        // don't have data for the current time period
        if (!this.manager.hasTimeline && this.startTime !== this.endTime) {
            table = table
                .filterByTargetTimes([this.startTime, this.endTime])
                .dropEntitiesThatHaveSomeMissingOrErrorValueInAllColumns(
                    this.yColumnSlugs
                )
        }

        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy === MissingDataStrategy.hide) {
            table = table.dropEntitiesThatHaveNoDataInSomeColumn(
                this.yColumnSlugs
            )
        }

        return table
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startTime and change the timeline bounds.
        const { isRelativeMode, startTime } = this.manager
        if (isRelativeMode && startTime !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startTime,
                this.yColumnSlugs ?? []
            )
        }
        return table
    }

    @computed private get manager(): SlopeChartManager {
        return this.props.manager
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padTop(TOP_PADDING)
            .padBottom(this.bottomPadding)
            .padRight(this.sidebarWidth + this.sidebarMargin)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get isLogScale(): boolean {
        return this.yScaleType === ScaleType.log
    }

    @computed private get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed private get lineStrokeWidth(): number {
        return this.manager.isStaticAndSmall ? 3 : 1.5
    }

    @computed private get backgroundColor(): string {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            this.hoveredSeriesNames.length > 0 ||
            // if the external legend is hovered, we want to mute
            // all non-hovered series even if the chart doesn't plot
            // the currently hovered series
            !!this.manager.externalLegendHoverBin
        )
    }

    @computed get isFocusModeActive(): boolean {
        return this.focusArray.hasActiveSeries
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs(): ColumnSlug[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : null) ?? ColorSchemes.get(this.defaultBaseColorScheme)
        )
    }

    @computed private get startTime(): Time {
        return this.transformedTable.minTime ?? 0
    }

    @computed private get endTime(): Time {
        return this.transformedTable.maxTime ?? 0
    }

    @computed private get startX(): number {
        return this.xScale(this.startTime)
    }

    @computed private get endX(): number {
        return this.xScale(this.endTime)
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies: FacetStrategy[] = [FacetStrategy.none]

        if (this.selectionArray.numSelectedEntities > 1)
            strategies.push(FacetStrategy.entity)

        if (this.yColumns.length > 1) strategies.push(FacetStrategy.metric)

        return strategies
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    @computed private get annotationsMap(): AnnotationsMap | undefined {
        return getAnnotationsMap(this.inputTable, this.yColumnSlugs[0])
    }

    private constructSingleSeries(
        entityName: EntityName,
        column: CoreColumn
    ): RawSlopeChartSeries {
        const { startTime, endTime, seriesStrategy } = this
        const { canSelectMultipleEntities = false } = this.manager

        const { availableEntityNames } = this.transformedTable
        const displayEntityName =
            getShortNameForEntity(entityName) ?? entityName
        const columnName = column.nonEmptyDisplayName
        const seriesName = getSeriesName({
            entityName: displayEntityName,
            columnName,
            seriesStrategy,
            availableEntityNames,
            canSelectMultipleEntities,
        })

        const owidRowByTime = column.owidRowByEntityNameAndTime.get(entityName)
        const start = owidRowByTime?.get(startTime)
        const end = owidRowByTime?.get(endTime)

        const colorKey = getColorKey({
            entityName,
            columnName,
            seriesStrategy,
            availableEntityNames,
        })
        const color = this.categoricalColorAssigner.assign(colorKey)

        const annotation = getAnnotationsForSeries(
            this.annotationsMap,
            seriesName
        )

        return {
            column,
            seriesName,
            entityName,
            color,
            start,
            end,
            annotation,
        }
    }

    private isSeriesValid(
        series: RawSlopeChartSeries
    ): series is SlopeChartSeries {
        const {
            start,
            end,
            column: { tolerance },
        } = series

        // if the start or end value is missing, we can't draw the slope
        if (start?.value === undefined || end?.value === undefined) return false

        // sanity check (might happen if tolerance is enabled)
        if (start.originalTime >= end.originalTime) return false

        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime

        // if tolerance has been applied to one of the values, then we require
        // a minimal distance between the original times
        if (isToleranceAppliedToStartValue || isToleranceAppliedToEndValue) {
            return end.originalTime - start.originalTime >= tolerance
        }

        return true
    }

    // Usually we drop rows with missing data in the transformTable function.
    // But if we did that for slope charts, we wouldn't know whether a slope
    // has been dropped because it actually had no data or a sibling slope had
    // no data. But we need that information for the "No data" section. That's
    // why the filtering happens here, so that the noDataSeries can be populated
    // correctly.
    private shouldSeriesBePlotted(
        series: RawSlopeChartSeries
    ): series is SlopeChartSeries {
        if (!this.isSeriesValid(series)) return false

        // when the missing data strategy is set to "hide", we might
        // choose not to plot a valid series
        if (
            this.seriesStrategy === SeriesStrategy.column &&
            this.missingDataStrategy === MissingDataStrategy.hide
        ) {
            const allSeriesForEntity = this.rawSeriesByEntityName.get(
                series.entityName
            )
            return !!allSeriesForEntity?.every((series) =>
                this.isSeriesValid(series)
            )
        }

        return true
    }

    @computed private get rawSeries(): RawSlopeChartSeries[] {
        return this.yColumns.flatMap((column) =>
            this.selectionArray.selectedEntityNames.map((entityName) =>
                this.constructSingleSeries(entityName, column)
            )
        )
    }

    @computed private get rawSeriesByEntityName(): Map<
        SeriesName,
        RawSlopeChartSeries[]
    > {
        const map = new Map<SeriesName, RawSlopeChartSeries[]>()
        this.rawSeries.forEach((series) => {
            const { entityName } = series
            if (!map.has(entityName)) map.set(entityName, [])
            map.get(entityName)!.push(series)
        })
        return map
    }

    @computed get series(): SlopeChartSeries[] {
        return this.rawSeries.filter((series) =>
            this.shouldSeriesBePlotted(series)
        )
    }

    @computed private get placedSeries(): PlacedSlopeChartSeries[] {
        const { yAxis, startX, endX } = this

        return this.series.map((series) => {
            const startY = yAxis.place(series.start.value)
            const endY = yAxis.place(series.end.value)

            const startPoint = new PointVector(startX, startY)
            const endPoint = new PointVector(endX, endY)

            return { ...series, startPoint, endPoint }
        })
    }

    private hoverStateForSeries(series: SlopeChartSeries): InteractionState {
        return getHoverStateForSeries(series, {
            isHoverModeActive: this.isHoverModeActive,
            hoveredSeriesNames: this.hoveredSeriesNames,
        })
    }

    private focusStateForSeries(series: SlopeChartSeries): InteractionState {
        return this.focusArray.state(series.seriesName)
    }

    @computed get focusArray(): InteractionArray {
        return this.manager.focusArray ?? new InteractionArray()
    }

    @computed private get renderSeries(): RenderSlopeChartSeries[] {
        const series: RenderSlopeChartSeries[] = this.placedSeries.map(
            (series) => {
                return {
                    ...series,
                    hover: this.hoverStateForSeries(series),
                    focus: this.focusStateForSeries(series),
                }
            }
        )

        if (this.isHoverModeActive || this.isFocusModeActive) {
            return sortBy(series, byHoverThenFocusState)
        }

        return series
    }

    @computed
    private get noDataSeries(): RawSlopeChartSeries[] {
        return this.rawSeries.filter((series) => !this.isSeriesValid(series))
    }

    @computed private get showNoDataSection(): boolean {
        if (this.manager.hideNoDataSection) return false

        // nothing to show if there are no series with missing data
        if (this.noDataSeries.length === 0) return false

        // the No Data section is HTML and won't show up in the SVG export
        if (this.manager.isStatic) return false

        // we usually don't show the no data section if columns are plotted
        // (since columns don't appear in the entity selector there is no need
        // to explain that a column is missing – it just adds noise). but if
        // the missing data strategy is set to hide, then we do want to give
        // feedback as to why a slope is currently not rendered
        return (
            this.seriesStrategy === SeriesStrategy.entity ||
            this.missingDataStrategy === MissingDataStrategy.hide
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed get allYValues(): number[] {
        return this.series.flatMap((series) => [
            series.start.value,
            series.end.value,
        ])
    }

    @computed private get yScaleType(): ScaleType {
        return this.yAxisConfig.scaleType ?? ScaleType.linear
    }

    @computed private get yDomainDefault(): [number, number] {
        const defaultDomain: [number, number] = [Infinity, -Infinity]
        return domainExtent(this.allYValues, this.yScaleType) ?? defaultDomain
    }

    @computed private get yDomain(): [number, number] {
        const domain = this.yAxisConfig.domain || [Infinity, -Infinity]
        const domainDefault = this.yDomainDefault
        return [
            Math.min(domain[0], domainDefault[0]),
            Math.max(domain[1], domainDefault[1]),
        ]
    }

    @computed private get bottomPadding(): number {
        return 1.5 * GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get xLabelPadding(): number {
        return this.useCompactLayout ? 4 : 8
    }

    @computed private get yRange(): [number, number] {
        return this.innerBounds.yRange()
    }

    @computed get yAxis(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        axis.domain = this.yDomain
        axis.range = this.yRange
        axis.formatColumn = this.yColumns[0]
        axis.label = ""
        return axis
    }

    @computed private get yAxisWidth(): number {
        return this.yAxis.width
    }

    @computed private get xScale(): ScaleLinear<number, number> {
        const { xDomain, xRange } = this
        return scaleLinear().domain(xDomain).range(xRange)
    }

    @computed private get xDomain(): [number, number] {
        return [this.startTime, this.endTime]
    }

    @computed private get sidebarWidth(): number {
        return this.showNoDataSection
            ? clamp(this.bounds.width * 0.125, 60, 140)
            : 0
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.manager.showLegend) {
            const categoricalLegendData = this.series.map(
                (series, index) =>
                    new CategoricalBin({
                        index,
                        value: series.seriesName,
                        label: series.seriesName,
                        color: series.color,
                    })
            )
            return { categoricalLegendData }
        }
        return undefined
    }

    @computed get maxLineLegendWidth(): number {
        return 0.25 * this.innerBounds.width
    }

    @computed get lineLegendFontSize(): number {
        return LineLegend.fontSize({ fontSize: this.fontSize })
    }

    @computed get lineLegendYRange(): [number, number] {
        const top = this.bounds.top

        const bottom =
            this.bounds.bottom -
            // leave space for the x-axis labels
            this.bottomPadding +
            // but allow for a little extra space
            this.lineLegendFontSize / 2

        return [top, bottom]
    }

    @computed private get lineLegendPropsCommon(): Partial<LineLegendProps> {
        return {
            yAxis: this.yAxis,
            maxWidth: this.maxLineLegendWidth,
            fontSize: this.fontSize,
            isStatic: this.manager.isStatic,
            yRange: this.lineLegendYRange,
            verticalAlign: VerticalAlign.top,
            showTextOutlines: true,
            textOutlineColor: this.backgroundColor,
            onMouseOver: this.onLineLegendMouseOver,
            onMouseLeave: this.onLineLegendMouseLeave,
            onClick:
                this.series.length > 1 ? this.onLineLegendClick : undefined,
        }
    }

    @computed private get lineLegendPropsRight(): Partial<LineLegendProps> {
        return { xAnchor: "start" }
    }

    @computed private get lineLegendPropsLeft(): Partial<LineLegendProps> {
        return {
            xAnchor: "end",
            seriesSortedByImportance:
                this.seriesSortedByImportanceForLineLegendLeft,
        }
    }

    private formatValue(value: number): string {
        return this.formatColumn.formatValueShortWithAbbreviations(value)
    }

    @computed get lineLegendMaxLevelLeft(): number {
        if (!this.manager.showLegend) return 0

        // can't use `lineLegendSeriesLeft` due to a circular dependency
        const series = this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.start.value,
                { showSeriesName: false }
            )
        )

        return LineLegend.maxLevel({
            labelSeries: series,
            ...this.lineLegendPropsCommon,
            seriesSortedByImportance:
                this.seriesSortedByImportanceForLineLegendLeft,
            // not including `lineLegendPropsLeft` due to a circular dependency
        })
    }

    @computed get lineLegendWidthLeft(): number {
        const props = {
            labelSeries: this.lineLegendSeriesLeft,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsLeft,
        }

        // We usually use the "stable" width of the line legend, which might be
        // a bit too wide because the connector line width is always added, even
        // it no connector lines are drawn. Using the stable width prevents
        // layout shifts when the connector lines are toggled on and off.
        // However, if the chart area is very narrow (like when it's faceted),
        // the stable width of the line legend takes too much space, so we use the
        // actual width instead.
        return this.isNarrow
            ? LineLegend.width(props)
            : LineLegend.stableWidth(props)
    }

    @computed get lineLegendRight(): LineLegend {
        return new LineLegend({
            labelSeries: this.lineLegendSeriesRight,
            ...this.lineLegendPropsCommon,
            ...this.lineLegendPropsRight,
        })
    }

    @computed get lineLegendWidthRight(): number {
        // We usually use the "stable" width of the line legend, which might be
        // a bit too wide because the connector line width is always added, even
        // it no connector lines are drawn. Using the stable width prevents
        // layout shifts when the connector lines are toggled on and off.
        // However, if the chart area is very narrow (like when it's faceted),
        // the stable width of the line legend takes too much space, so we use the
        // actual width instead.
        return this.isNarrow
            ? this.lineLegendRight.width
            : this.lineLegendRight.stableWidth
    }

    @computed get visibleLineLegendLabelsRight(): Set<SeriesName> {
        return new Set(this.lineLegendRight?.visibleSeriesNames ?? [])
    }

    @computed get seriesSortedByImportanceForLineLegendLeft(): SeriesName[] {
        return this.series
            .map((s) => s.seriesName)
            .sort((s1: SeriesName, s2: SeriesName): number => {
                const PREFER_S1 = -1
                const PREFER_S2 = 1

                const s1_isLabelled = this.visibleLineLegendLabelsRight.has(s1)
                const s2_isLabelled = this.visibleLineLegendLabelsRight.has(s2)

                // prefer to show value labels for series that are already labelled
                if (s1_isLabelled && !s2_isLabelled) return PREFER_S1
                if (s2_isLabelled && !s1_isLabelled) return PREFER_S2

                return 0
            })
    }

    @computed get xRange(): [number, number] {
        const lineLegendWidthLeft =
            this.lineLegendWidthLeft + LINE_LEGEND_PADDING
        const lineLegendWidthRight =
            this.lineLegendWidthRight + LINE_LEGEND_PADDING
        const chartAreaWidth = this.innerBounds.width

        // start and end value when the slopes are as wide as possible
        const minStartX =
            this.innerBounds.x + this.yAxisWidth + lineLegendWidthLeft
        const maxEndX = this.innerBounds.right - lineLegendWidthRight

        // use all available space if the chart is narrow
        if (this.manager.isNarrow || this.isNarrow) {
            return [minStartX, maxEndX]
        }

        const offset = 0.25
        let startX = this.innerBounds.x + offset * chartAreaWidth
        let endX = this.innerBounds.right - offset * chartAreaWidth

        // make sure the start and end values are within the bounds
        startX = Math.max(startX, minStartX)
        endX = Math.min(endX, maxEndX)

        // pick a reasonable max width based on an ideal aspect ratio
        const idealAspectRatio = 0.9
        const availableWidth =
            chartAreaWidth -
            this.yAxisWidth -
            lineLegendWidthLeft -
            lineLegendWidthRight
        const idealWidth = idealAspectRatio * this.bounds.height
        const maxSlopeWidth = Math.min(idealWidth, availableWidth)

        const currentSlopeWidth = endX - startX
        if (currentSlopeWidth > maxSlopeWidth) {
            const padding = currentSlopeWidth - maxSlopeWidth
            startX += padding / 2
            endX -= padding / 2
        }

        return [startX, endX]
    }

    @computed private get isNarrow(): boolean {
        return this.bounds.width < 320
    }

    @computed get useCompactLayout(): boolean {
        return !!this.manager.isSemiNarrow || this.isNarrow
    }

    @computed get hoveredSeriesNames(): SeriesName[] {
        const hoveredSeriesNames: SeriesName[] = []

        // hovered series name (either by hovering over a slope or a line legend label)
        if (this.hoveredSeriesName)
            hoveredSeriesNames.push(this.hoveredSeriesName)

        // hovered legend item in the external facet legend
        if (this.manager.externalLegendHoverBin) {
            hoveredSeriesNames.push(
                ...this.series
                    .map((s) => s.seriesName)
                    .filter((name) =>
                        this.manager.externalLegendHoverBin?.contains(name)
                    )
            )
        }

        return hoveredSeriesNames
    }

    private constructSingleLineLegendSeries(
        series: SlopeChartSeries,
        getValue: (series: SlopeChartSeries) => number,
        {
            showSeriesName,
            showAnnotation,
        }: {
            showSeriesName?: boolean
            showAnnotation?: boolean
        }
    ): LineLabelSeries {
        const { seriesName, color, annotation } = series
        const value = getValue(series)
        const formattedValue = this.formatValue(value)
        return {
            color,
            seriesName,
            annotation: showAnnotation ? annotation : undefined,
            label: showSeriesName ? seriesName : formattedValue,
            formattedValue: showSeriesName ? formattedValue : undefined,
            placeFormattedValueInNewLine: this.useCompactLayout,
            yValue: value,
            hover: this.hoverStateForSeries(series),
            focus: this.focusStateForSeries(series),
        }
    }

    @computed get lineLegendSeriesLeft(): LineLabelSeries[] {
        const { showSeriesNamesInLineLegendLeft: showSeriesName } = this
        return this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.start.value,
                { showSeriesName }
            )
        )
    }

    @computed get lineLegendSeriesRight(): LineLabelSeries[] {
        return this.series.map((series) =>
            this.constructSingleLineLegendSeries(
                series,
                (series) => series.end.value,
                {
                    showSeriesName: this.manager.showLegend,
                    showAnnotation: !this.useCompactLayout,
                }
            )
        )
    }

    private animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    private playIntroAnimation() {
        // Nice little intro animation
        this.animSelection = select(this.slopeAreaRef.current)
            .selectAll(".slope")
            .attr("stroke-dasharray", "100%")
            .attr("stroke-dashoffset", "100%")

        this.animSelection
            .transition()
            .duration(600)
            .attr("stroke-dashoffset", "0%")
    }

    componentDidMount() {
        exposeInstanceOnWindow(this)

        if (!this.manager.disableIntroAnimation) {
            this.playIntroAnimation()
        }
    }

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed private get showSeriesNamesInLineLegendLeft(): boolean {
        return this.lineLegendMaxLevelLeft >= 4 && !!this.manager.showLegend
    }

    private updateTooltipPosition(event: SVGMouseOrTouchEvent): void {
        const ref = this.manager.base?.current
        if (ref) this.tooltipState.position = getRelativeMouse(ref, event)
    }

    private detectHoveredSlope(event: SVGMouseOrTouchEvent): void {
        const ref = this.slopeAreaRef.current
        if (!ref) return

        const mouse = getRelativeMouse(ref, event)
        this.mouseFrame = requestAnimationFrame(() => {
            if (this.placedSeries.length === 0) return

            const distanceMap = new Map<PlacedSlopeChartSeries, number>()
            for (const series of this.placedSeries) {
                distanceMap.set(
                    series,
                    PointVector.distanceFromPointToLineSegmentSq(
                        mouse,
                        series.startPoint,
                        series.endPoint
                    )
                )
            }

            const closestSlope = minBy(this.placedSeries, (s) =>
                distanceMap.get(s)
            )!
            const distanceSq = distanceMap.get(closestSlope)!
            const tolerance = 10
            const toleranceSq = tolerance * tolerance

            if (closestSlope && distanceSq < toleranceSq) {
                this.onSlopeMouseOver(closestSlope)
            } else {
                this.onSlopeMouseLeave()
            }
        })
    }

    private hoverTimer?: NodeJS.Timeout
    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        clearTimeout(this.hoverTimer)
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        clearTimeout(this.hoverTimer)
        this.hoverTimer = setTimeout(() => {
            // wait before clearing selection in case the mouse is moving quickly over neighboring labels
            this.hoveredSeriesName = undefined
        }, 200)
    }

    @action.bound onLineLegendClick(seriesName: SeriesName): void {
        this.focusArray.toggle(seriesName)
    }

    @action.bound onSlopeMouseOver(series: SlopeChartSeries): void {
        this.hoveredSeriesName = series.seriesName
        this.tooltipState.target = { series }
    }

    @action.bound onSlopeMouseLeave(): void {
        this.hoveredSeriesName = undefined
        this.tooltipState.target = null
    }

    mouseFrame?: number
    @action.bound onMouseMove(event: SVGMouseOrTouchEvent): void {
        this.updateTooltipPosition(event)
        this.detectHoveredSlope(event)
    }

    @action.bound onMouseLeave(): void {
        if (this.mouseFrame !== undefined) cancelAnimationFrame(this.mouseFrame)

        this.onSlopeMouseLeave()
    }

    @computed get failMessage(): string {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        else if (this.series.length === 0) return "No matching data"
        return ""
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get tooltip(): React.ReactElement | undefined {
        const {
            manager: { isRelativeMode },
            tooltipState: { target, position, fading },
            formatColumn,
            startTime,
            endTime,
        } = this

        const { series } = target || {}
        if (!series) return

        const formatTime = (time: Time) => formatColumn.formatTime(time)

        const title = series.seriesName
        const titleAnnotation = series.annotation

        const actualStartTime = series.start.originalTime
        const actualEndTime = series.end.originalTime
        const timeRange = `${formatTime(actualStartTime)} to ${formatTime(actualEndTime)}`
        const timeLabel = isRelativeMode
            ? `% change between ${formatColumn.formatTime(actualStartTime)} and ${formatColumn.formatTime(actualEndTime)}`
            : timeRange

        const constructTargetYearForToleranceNotice = () => {
            const isStartValueOriginal = series.start.originalTime === startTime
            const isEndValueOriginal = series.end.originalTime === endTime

            if (!isStartValueOriginal && !isEndValueOriginal) {
                return `${formatTime(startTime)} and ${formatTime(endTime)}`
            } else if (!isStartValueOriginal) {
                return formatTime(startTime)
            } else if (!isEndValueOriginal) {
                return formatTime(endTime)
            } else {
                return undefined
            }
        }

        const targetYear = constructTargetYearForToleranceNotice()
        const toleranceNotice = targetYear
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetYear),
              }
            : undefined
        const roundingNotice = series.column.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
                  text: makeTooltipRoundingNotice(
                      [series.column.numSignificantFigures],
                      { plural: !isRelativeMode }
                  ),
              }
            : undefined
        const footer = excludeUndefined([toleranceNotice, roundingNotice])

        const values = isRelativeMode
            ? [series.end.value]
            : [series.start.value, series.end.value]

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.props.manager}
                x={position.x}
                y={position.y}
                offsetX={20}
                offsetY={-16}
                style={{ maxWidth: "250px" }}
                title={title}
                titleAnnotation={titleAnnotation}
                subtitle={timeLabel}
                subtitleFormat={targetYear ? "notice" : undefined}
                dissolve={fading}
                footer={footer}
                dismiss={() => (this.tooltipState.target = null)}
            >
                <TooltipValueRange column={this.formatColumn} values={values} />
            </Tooltip>
        )
    }

    private makeMissingDataLabel(series: RawSlopeChartSeries): string {
        const { seriesName, start, end } = series

        const startTime = this.formatColumn.formatTime(this.startTime)
        const endTime = this.formatColumn.formatTime(this.endTime)

        // mention the start or end value if they're missing
        if (start?.value === undefined && end?.value === undefined) {
            return `${seriesName} (${startTime} & ${endTime})`
        } else if (start?.value === undefined) {
            return `${seriesName} (${startTime})`
        } else if (end?.value === undefined) {
            return `${seriesName} (${endTime})`
        }

        // if both values are given but the series shows up in the No Data
        // section, then tolerance has been applied to one of the values
        // in such a way that we decided not to render the slope after all
        // (e.g. when the original times are too close to each other)
        const isToleranceAppliedToStartValue =
            start.originalTime !== this.startTime
        const isToleranceAppliedToEndValue = end.originalTime !== this.endTime
        if (isToleranceAppliedToStartValue && isToleranceAppliedToEndValue) {
            return `${seriesName} (${startTime} & ${endTime})`
        } else if (isToleranceAppliedToStartValue) {
            return `${seriesName} (${startTime})`
        } else if (isToleranceAppliedToEndValue) {
            return `${seriesName} (${endTime})`
        }

        return seriesName
    }

    private renderNoDataSection(): React.ReactElement | void {
        if (!this.showNoDataSection) return

        const bounds = new Bounds(
            this.innerBounds.right + this.sidebarMargin,
            this.bounds.top,
            this.sidebarWidth,
            this.bounds.height
        )
        const seriesNames = this.noDataSeries.map((series) =>
            this.makeMissingDataLabel(series)
        )

        return (
            <NoDataSection
                seriesNames={seriesNames}
                bounds={bounds}
                baseFontSize={this.fontSize}
            />
        )
    }

    private renderSlopes() {
        return (
            <>
                {this.renderSeries.map((series) => (
                    <Slope
                        key={series.seriesName}
                        series={series}
                        strokeWidth={this.lineStrokeWidth}
                        outlineWidth={0.5}
                        outlineStroke={this.backgroundColor}
                    />
                ))}
            </>
        )
    }

    private renderYAxis(): React.ReactElement {
        return (
            <>
                {!this.yAxis.hideGridlines && (
                    <GridLines bounds={this.innerBounds} yAxis={this.yAxis} />
                )}
                {!this.yAxis.hideAxis && (
                    <VerticalAxisComponent
                        bounds={this.bounds}
                        verticalAxis={this.yAxis}
                        labelColor={this.manager.secondaryColorInStaticCharts}
                    />
                )}
            </>
        )
    }

    private renderXAxis() {
        const { xDomain, startX, endX } = this

        return (
            <>
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[0])}
                    x={startX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={this.xLabelPadding}
                    fontSize={this.yAxis.tickFontSize}
                />
                <MarkX
                    label={this.formatColumn.formatTime(xDomain[1])}
                    x={endX}
                    top={this.innerBounds.top}
                    bottom={this.innerBounds.bottom}
                    labelPadding={this.xLabelPadding}
                    fontSize={this.yAxis.tickFontSize}
                />
            </>
        )
    }

    private renderChartArea() {
        return (
            <g>
                {this.renderYAxis()}
                {this.renderXAxis()}
                <g
                    id={makeIdForHumanConsumption("slopes")}
                    ref={this.slopeAreaRef}
                    onMouseMove={this.onMouseMove}
                    onTouchMove={this.onMouseMove}
                    onTouchStart={this.onMouseMove}
                    onMouseLeave={this.onMouseLeave}
                >
                    <rect
                        x={this.startX}
                        y={this.bounds.y}
                        width={this.endX - this.startX}
                        height={this.bounds.height}
                        fillOpacity={0}
                    />
                    {this.renderSlopes()}
                </g>
            </g>
        )
    }

    private renderLineLegendRight(): React.ReactElement {
        return (
            <LineLegend
                labelSeries={this.lineLegendSeriesRight}
                x={this.xRange[1] + LINE_LEGEND_PADDING}
                {...this.lineLegendPropsCommon}
                {...this.lineLegendPropsRight}
            />
        )
    }

    private renderLineLegendLeft(): React.ReactElement {
        const uniqYValues = uniq(
            this.lineLegendSeriesLeft.map((series) => series.yValue)
        )
        const allSlopesStartFromZero =
            uniqYValues.length === 1 && uniqYValues[0] === 0

        // if all values have a start value of 0, show the 0-label only once
        if (
            // in relative mode, all slopes start from 0%
            this.manager.isRelativeMode ||
            allSlopesStartFromZero
        )
            return (
                <Halo
                    id="x-axis-zero-label"
                    outlineColor={this.backgroundColor}
                >
                    <text
                        x={this.startX}
                        y={this.yAxis.place(0)}
                        textAnchor="end"
                        dx={-LINE_LEGEND_PADDING - 4}
                        dy={dyFromAlign(VerticalAlign.middle)}
                        fontSize={this.lineLegendFontSize}
                    >
                        {this.formatValue(0)}
                    </text>
                </Halo>
            )

        return (
            <LineLegend
                labelSeries={this.lineLegendSeriesLeft}
                x={this.xRange[0] - LINE_LEGEND_PADDING}
                {...this.lineLegendPropsCommon}
                {...this.lineLegendPropsLeft}
            />
        )
    }

    private renderLineLegends(): React.ReactElement | void {
        return (
            <>
                {this.renderLineLegendLeft()}
                {this.renderLineLegendRight()}
            </>
        )
    }

    render() {
        if (this.failMessage)
            return (
                <>
                    {this.renderYAxis()}
                    <NoDataModal
                        manager={this.manager}
                        bounds={this.props.bounds}
                        message={this.failMessage}
                    />
                </>
            )

        return (
            <g>
                {this.renderChartArea()}
                {this.renderLineLegends()}
                {this.renderNoDataSection()}
                {this.tooltip}
            </g>
        )
    }
}

interface SlopeProps {
    series: RenderSlopeChartSeries
    dotRadius?: number
    strokeWidth?: number
    outlineWidth?: number
    outlineStroke?: string
}

function Slope({
    series,
    dotRadius = 2.5,
    strokeWidth = 2,
    outlineWidth = 0.5,
    outlineStroke = "#fff",
}: SlopeProps) {
    const { seriesName, startPoint, endPoint, hover, focus } = series

    const showOutline = !hover.background
    const opacity =
        hover.background && !focus.background ? GRAPHER_OPACITY_MUTE : 1
    const color =
        !focus.background || hover.active
            ? series.color
            : NON_FOCUSED_LINE_COLOR

    return (
        <g
            id={makeIdForHumanConsumption("slope", seriesName)}
            className="slope"
        >
            {showOutline && (
                <LineWithDots
                    startPoint={startPoint}
                    endPoint={endPoint}
                    radius={dotRadius}
                    color={outlineStroke}
                    lineWidth={strokeWidth + 2 * outlineWidth}
                />
            )}
            <LineWithDots
                startPoint={startPoint}
                endPoint={endPoint}
                radius={dotRadius}
                color={color}
                lineWidth={strokeWidth}
                opacity={opacity}
            />
        </g>
    )
}

/**
 * Line with two dots at the ends, drawn as a single path element.
 */
function LineWithDots({
    startPoint,
    endPoint,
    radius,
    color,
    lineWidth = 2,
    opacity = 1,
}: {
    startPoint: PointVector
    endPoint: PointVector
    radius: number
    color: string
    lineWidth?: number
    opacity?: number
}): React.ReactElement {
    const startDotPath = makeCirclePath(startPoint.x, startPoint.y, radius)
    const endDotPath = makeCirclePath(endPoint.x, endPoint.y, radius)

    const linePath = makeLinePath(
        startPoint.x,
        startPoint.y,
        endPoint.x,
        endPoint.y
    )

    return (
        <path
            d={`${startDotPath} ${endDotPath} ${linePath}`}
            fill={color}
            stroke={color}
            strokeWidth={lineWidth}
            opacity={opacity}
        />
    )
}

interface GridLinesProps {
    bounds: Bounds
    yAxis: VerticalAxis
}

function GridLines({ bounds, yAxis }: GridLinesProps) {
    return (
        <g id={makeIdForHumanConsumption("grid-lines")}>
            {yAxis.tickLabels.map((tick) => {
                const y = yAxis.place(tick.value)
                return (
                    <g
                        id={makeIdForHumanConsumption(
                            "grid-line",
                            tick.formattedValue
                        )}
                        key={tick.formattedValue}
                    >
                        <line
                            x1={bounds.left + yAxis.width}
                            y1={y}
                            x2={bounds.right}
                            y2={y}
                            stroke="#ddd"
                            strokeDasharray="3,2"
                        />
                    </g>
                )
            })}
        </g>
    )
}

function MarkX({
    label,
    x,
    top,
    bottom,
    labelPadding,
    fontSize,
}: {
    label: string
    x: number
    top: number
    bottom: number
    labelPadding: number
    fontSize: number
}) {
    return (
        <>
            <line x1={x} y1={top} x2={x} y2={bottom} stroke="#999" />
            <text
                x={x}
                y={bottom + labelPadding}
                dy={dyFromAlign(VerticalAlign.bottom)}
                textAnchor="middle"
                fill={GRAPHER_DARK_TEXT}
                fontSize={fontSize}
            >
                {label}
            </text>
        </>
    )
}

const makeCirclePath = (centerX: number, centerY: number, radius: number) => {
    const topX = centerX
    const topY = centerY - radius
    return `M ${topX},${topY} A ${radius},${radius} 0 1,1 ${topX - 0.0001},${topY}`
}

const makeLinePath = (x1: number, y1: number, x2: number, y2: number) => {
    return `M ${x1},${y1} L ${x2},${y2}`
}
