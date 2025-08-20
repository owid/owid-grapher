import * as _ from "lodash-es"
import * as R from "remeda"
import {
    CoreColumn,
    defaultIfErrorValue,
    isNotErrorValue,
    OwidTable,
} from "@ourworldindata/core-table"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    SCATTER_POINT_DEFAULT_COLOR,
    ScatterPlotManager,
    ScatterSeries,
    SeriesPoint,
} from "./ScatterPlotChartConstants"
import { computed, makeObservable } from "mobx"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    ScaleType,
    ScatterPointLabelStrategy,
    ColorScaleConfigInterface,
    SeriesName,
    ValueRange,
} from "@ourworldindata/types"
import {
    domainExtent,
    intersection,
    lowerCaseFirstLetterUnlessAbbreviation,
} from "@ourworldindata/utils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { AxisConfig } from "../axis/AxisConfig"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { computeSizeDomain } from "./ScatterUtils"
import { FocusArray } from "../focus/FocusArray"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis.js"

export class ScatterPlotChartState implements ChartState, ColorScaleManager {
    manager: ScatterPlotManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = OWID_NO_DATA_GRAY

    constructor({ manager }: { manager: ScatterPlotManager }) {
        this.manager = manager
        this.colorScale = manager.colorScaleOverride ?? new ColorScale(this)
        makeObservable(this)
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    // TODO chunk this up into multiple computeds for better performance?
    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // We don't want to apply this transform when relative mode is also enabled, it has a
        // slightly different endpoints logic that drops initial zeroes to avoid DivideByZero error.
        if (this.compareEndPointsOnly && !this.manager.isRelativeMode) {
            table = table.keepMinTimeAndMaxTimeForEachEntityOnly()
        }
        if (this.manager.isRelativeMode) {
            table = table.toAverageAnnualChangeForEachEntity([
                this.xColumnSlug,
                this.yColumnSlug,
            ])
        }
        return table
    }

    transformTable(table: OwidTable): OwidTable {
        // Drop all entities that have no data in either the X or Y column.
        // For some charts, this can drop more than 50% of rows, so we do it first.
        // If there's no data at all for an entity, then tolerance can also not "recover" any data, so this is safe to do.
        table = table.dropEntitiesThatHaveNoDataInSomeColumn([
            this.xColumnSlug,
            this.yColumnSlug,
        ])

        if (this.xScaleType === ScaleType.log && this.xColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.xColumnSlug])

        if (this.yScaleType === ScaleType.log && this.yColumnSlug)
            table = table.replaceNonPositiveCellsForLogScale([this.yColumnSlug])

        if (this.colorColumnSlug && this.manager.matchingEntitiesOnly)
            table = table.dropRowsWithErrorValuesForColumn(this.colorColumnSlug)

        // We want to "chop off" any rows outside the time domain for X and Y to avoid creating
        // leading and trailing timeline times that don't really exist in the dataset.
        const [timeDomainStart, timeDomainEnd] = table.timeDomainFor([
            this.xColumnSlug,
            this.yColumnSlug,
        ])
        table = table.filterByTimeRange(
            timeDomainStart ?? -Infinity,
            timeDomainEnd ?? Infinity
        )

        if (this.xOverrideTime !== undefined) {
            table = table.interpolateColumnWithTolerance(this.yColumnSlug)
        } else {
            table = table.interpolateColumnsByClosestTimeMatch(
                this.xColumnSlug,
                this.yColumnSlug
            )
        }

        // Drop any rows which have non-number values for X or Y.
        // This needs to be done after the tolerance, because the tolerance may fill in some gaps.
        table = table
            .columnFilter(
                this.xColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in X column"
            )
            .columnFilter(
                this.yColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in Y column"
            )

        // The tolerance application might lead to some data being dropped for some years.
        // For example, if X times are [2000, 2005, 2010], and Y times are [2005], then for all 3
        // rows we have the same match [[2005, 2005], [2005, 2005], [2005, 2005]].
        // This means we can drop 2000 and 2010 from the timeline.
        // It might not make a huge difference here, but it makes a difference when there are more
        // entities covering different time periods.
        const [originalTimeDomainStart, originalTimeDomainEnd] =
            table.originalTimeDomainFor([this.xColumnSlug, this.yColumnSlug])
        table = table.filterByTimeRange(
            originalTimeDomainStart ?? -Infinity,
            originalTimeDomainEnd ?? Infinity
        )

        return table
    }

    transformTableForDisplay(table: OwidTable): OwidTable {
        // Drop any rows which have non-number values for X or Y.
        table = table
            .columnFilter(
                this.xColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in X column"
            )
            .columnFilter(
                this.yColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in Y column"
            )
        return table
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get focusArray(): FocusArray {
        return this.manager.focusArray ?? new FocusArray()
    }

    @computed get isFocusModeActive(): boolean {
        return this.focusArray.hasFocusedSeries
    }

    // todo: remove. do this at table filter level
    @computed get seriesNamesToHighlight(): Set<SeriesName> {
        const seriesNames = this.selectionArray.selectedEntityNames

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing)
            return new Set(
                intersection(seriesNames, this.colorColumn.uniqEntityNames)
            )

        return new Set(seriesNames)
    }

    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime(): number | undefined {
        return this.manager.xOverrideTime
    }

    @computed get compareEndPointsOnly(): boolean {
        return !!this.manager.compareEndPointsOnly
    }

    @computed get xScaleType(): ScaleType {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : (this.manager.xAxisConfig?.scaleType ?? ScaleType.linear)
    }

    @computed get yScaleType(): ScaleType {
        return this.manager.isRelativeMode
            ? ScaleType.linear
            : (this.manager.yAxisConfig?.scaleType ?? ScaleType.linear)
    }

    @computed get yColumnSlug(): string {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get xColumnSlug(): string {
        const { xColumnSlug } = this.manager
        return xColumnSlug ?? this.manager.table.timeColumn.slug
    }

    @computed get xColumn(): CoreColumn {
        return this.transformedTable.get(this.xColumnSlug)
    }

    @computed get sizeColumnSlug(): string | undefined {
        return this.manager.sizeColumnSlug
    }

    @computed get sizeColumn(): CoreColumn {
        return this.transformedTable.get(this.sizeColumnSlug)
    }

    @computed get colorColumnSlug(): string | undefined {
        // Scatter plots only support categorical variables as color dimension
        return this.manager.categoricalColorColumnSlug
    }

    @computed get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ?? // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get hasNoDataBin(): boolean {
        if (this.colorColumn.isMissing) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    @computed private get allEntityNamesWithXAndY(): EntityName[] {
        return intersection(
            this.yColumn.uniqEntityNames,
            this.xColumn.uniqEntityNames
        )
    }

    private assignColorToSeries(
        entityName: EntityName,
        series: ScatterSeries
    ): void {
        if (series.points.length) {
            const keyColor =
                this.transformedTable.getColorForEntityName(entityName)
            if (keyColor !== undefined) series.color = keyColor
            else if (!this.colorColumn.isMissing) {
                const colorValue = R.last(series.points)?.color
                const color = this.colorScale.getColor(colorValue)
                if (color !== undefined) {
                    series.color = color
                    series.isScaleColor = true
                }
            }
        }
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    private removePointsOutsidePlane(points: SeriesPoint[]): SeriesPoint[] {
        const { xAxisConfig, yAxisConfig } = this

        if (
            yAxisConfig.removePointsOutsideDomain ||
            xAxisConfig.removePointsOutsideDomain
        ) {
            return points.filter((point) => {
                return (
                    !xAxisConfig.shouldRemovePoint(point.x) &&
                    !yAxisConfig.shouldRemovePoint(point.y)
                )
            })
        }
        return points
    }

    private getPointLabel(rowIndex: number): string | undefined {
        const strat = this.manager.scatterPointLabelStrategy
        const { xColumn, yColumn } = this
        const { timeColumn } = this.transformedTable
        let label
        if (strat === ScatterPointLabelStrategy.y) {
            label = yColumn?.formatValue(
                yColumn.valuesIncludingErrorValues[rowIndex]
            )
        } else if (strat === ScatterPointLabelStrategy.x) {
            label = xColumn?.formatValue(
                xColumn.valuesIncludingErrorValues[rowIndex]
            )
        } else {
            label = timeColumn.formatTime(
                timeColumn.valuesIncludingErrorValues[rowIndex] as number
            )
        }
        return label
    }

    @computed private get allPointsBeforeEndpointsFilter(): SeriesPoint[] {
        const { entityNameColumn, timeColumn } = this.transformedTable
        const { xColumn, yColumn, sizeColumn, colorColumn } = this

        // We are running this filter first because it only depends on author-specified config, not
        // on any user interaction.
        return this.removePointsOutsidePlane(
            this.transformedTable.indices.map((rowIndex) => {
                return {
                    x: xColumn.valuesIncludingErrorValues[rowIndex] as number,
                    y: yColumn.valuesIncludingErrorValues[rowIndex] as number,
                    size: defaultIfErrorValue(
                        sizeColumn.valuesIncludingErrorValues[rowIndex],
                        undefined
                    ) as number | undefined,
                    color: defaultIfErrorValue(
                        colorColumn.valuesIncludingErrorValues[rowIndex],
                        undefined
                    ) as string | number | undefined,
                    entityName: entityNameColumn.valuesIncludingErrorValues[
                        rowIndex
                    ] as EntityName,
                    label: this.getPointLabel(rowIndex) ?? "",
                    timeValue: timeColumn.valuesIncludingErrorValues[
                        rowIndex
                    ] as number,
                    time: {
                        x: xColumn.originalTimeColumn
                            .valuesIncludingErrorValues[rowIndex] as number,
                        y: yColumn.originalTimeColumn
                            .valuesIncludingErrorValues[rowIndex] as number,
                    },
                }
            })
        )
    }

    @computed get series(): ScatterSeries[] {
        return Object.entries(
            _.groupBy(this.allPointsBeforeEndpointsFilter, (p) => p.entityName)
        ).map(([entityName, points]) => {
            const series: ScatterSeries = {
                seriesName: entityName,
                label: entityName,
                color: SCATTER_POINT_DEFAULT_COLOR, // Default color, used when no color dimension is present
                points,
                focus: this.focusArray.state(entityName),
            }
            this.assignColorToSeries(entityName, series)
            return series
        })
    }

    /** Whether series are shown as lines (instead of single points) */
    @computed get isConnected(): boolean {
        return this.series.some((s) => s.points.length > 1)
    }

    @computed get allPoints(): SeriesPoint[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed private get selectedPoints(): SeriesPoint[] {
        const seriesNamesSet = this.seriesNamesToHighlight
        return this.allPoints.filter(
            (point) => point.entityName && seriesNamesSet.has(point.entityName)
        )
    }

    @computed get pointsForAxisDomains(): SeriesPoint[] {
        if (
            !this.selectionArray.numSelectedEntities ||
            !this.manager.zoomToSelection
        )
            return this.allPoints

        return this.selectedPoints.length ? this.selectedPoints : this.allPoints
    }

    // domains across the entire timeline
    private domainDefault(property: "x" | "y"): [number, number] {
        const scaleType = property === "x" ? this.xScaleType : this.yScaleType
        const defaultDomain: [number, number] =
            scaleType === ScaleType.log ? [1, 100] : [-1, 1]
        return (
            domainExtent(
                this.pointsForAxisDomains.map((point) => point[property]),
                scaleType,
                this.manager.zoomToSelection && this.selectedPoints.length
                    ? 1.1
                    : 1
            ) ?? defaultDomain
        )
    }

    @computed get xDomainDefault(): [number, number] {
        return this.domainDefault("x")
    }

    @computed get yDomainDefault(): [number, number] {
        return this.domainDefault("y")
    }

    @computed get sizeDomain(): [number, number] {
        if (this.sizeColumn.isMissing) return [1, 100]
        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.size
        ) {
            return this.domainsForAnimation.size
        }
        return computeSizeDomain(this.transformedTable, this.sizeColumn.slug)
    }

    @computed get domainsForAnimation(): {
        x?: ValueRange
        y?: ValueRange
        size?: ValueRange
    } {
        const { inputTable } = this
        const { animationStartTime, animationEndTime } = this.manager

        if (!animationStartTime || !animationEndTime) return {}

        let table = inputTable.filterByTimeRange(
            animationStartTime,
            animationEndTime
        )

        if (this.manager.matchingEntitiesOnly && !this.colorColumn.isMissing) {
            table = table.filterByEntityNames(
                table.get(this.colorColumnSlug).uniqEntityNames
            )
        }

        table = table
            .columnFilter(
                this.xColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in X column"
            )
            .columnFilter(
                this.yColumnSlug,
                _.isNumber,
                "Drop rows with non-number values in Y column"
            )

        const xValues = table.get(this.xColumnSlug).uniqValues
        const yValues = table.get(this.yColumnSlug).uniqValues

        return {
            x: domainExtent(xValues, this.xScaleType),
            y: domainExtent(yValues, this.yScaleType),
            size: computeSizeDomain(table, this.sizeColumn.slug),
        }
    }

    @computed get validValuesForAxisDomainX(): number[] {
        const { xScaleType, pointsForAxisDomains } = this

        const values = pointsForAxisDomains.map((point) => point.x)
        return xScaleType === ScaleType.log
            ? values.filter((v) => v > 0)
            : values
    }

    @computed get validValuesForAxisDomainY(): number[] {
        const { yScaleType, pointsForAxisDomains } = this

        const values = pointsForAxisDomains.map((point) => point.y)
        return yScaleType === ScaleType.log
            ? values.filter((v) => v > 0)
            : values
    }

    @computed get verticalAxisLabel(): string {
        const yAxisConfig = this.manager.yAxisConfig

        let label = yAxisConfig?.label || this.yColumn?.displayName || ""

        if (this.manager.isRelativeMode && label && label.length > 1) {
            label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                label
            )}`
        }

        return label.trim()
    }

    @computed private get horizontalAxisLabelBase(): string {
        const xDimName = this.xColumn?.displayName ?? ""
        if (this.xOverrideTime !== undefined)
            return `${xDimName} in ${this.xOverrideTime}`
        return xDimName
    }

    @computed get horizontalAxisLabel(): string {
        const xAxisConfig = this.manager.xAxisConfig

        let label = xAxisConfig?.label || this.horizontalAxisLabelBase
        if (this.manager.isRelativeMode && label && label.length > 1) {
            label = `Average annual change in ${lowerCaseFirstLetterUnlessAbbreviation(
                label
            )}`
        }

        return label.trim()
    }

    toHorizontalAxis(config: AxisConfig): HorizontalAxis {
        const axis = config.toHorizontalAxis()

        axis.formatColumn = this.xColumn
        axis.scaleType = this.xScaleType

        if (this.horizontalAxisLabel) axis.label = this.horizontalAxisLabel

        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.x
        ) {
            axis.updateDomainPreservingUserSettings(this.domainsForAnimation.x)
        } else if (this.manager.isRelativeMode) {
            axis.domain = this.xDomainDefault // Overwrite author's min/max
        } else {
            const isAnyValueOutsideUserDomain =
                this.validValuesForAxisDomainX.some(
                    (value) => value < axis.domain[0] || value > axis.domain[1]
                )

            // only overwrite the authors's min/max if there is more than one unique value along the x-axis
            // or if respecting the author's setting would hide data points
            if (
                new Set(this.validValuesForAxisDomainX).size > 1 ||
                isAnyValueOutsideUserDomain
            ) {
                axis.updateDomainPreservingUserSettings(this.xDomainDefault)
            }
        }

        return axis
    }

    toVerticalAxis(config: AxisConfig): VerticalAxis {
        const axis = config.toVerticalAxis()

        axis.formatColumn = this.yColumn
        axis.scaleType = this.yScaleType
        if (this.verticalAxisLabel) axis.label = this.verticalAxisLabel

        if (
            this.manager.isSingleTimeScatterAnimationActive &&
            this.domainsForAnimation.y
        ) {
            axis.updateDomainPreservingUserSettings(this.domainsForAnimation.y)
        } else if (this.manager.isRelativeMode) {
            axis.domain = this.yDomainDefault // Overwrite author's min/max
        } else {
            const isAnyValueOutsideUserDomain =
                this.validValuesForAxisDomainY.some(
                    (value) => value < axis.domain[0] || value > axis.domain[1]
                )

            // only overwrite the authors's min/max if there is more than one unique value along the y-axis
            // or if respecting the author's setting would hide data points
            if (
                new Set(this.validValuesForAxisDomainY).size > 1 ||
                isAnyValueOutsideUserDomain
            ) {
                axis.updateDomainPreservingUserSettings(this.yDomainDefault)
            }
        }

        return axis
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.yColumn.isMissing) return { reason: "Missing Y axis variable" }

        if (this.xColumn.isMissing) return { reason: "Missing X axis variable" }

        if (_.isEmpty(this.allEntityNamesWithXAndY)) {
            if (
                this.manager.isRelativeMode &&
                this.manager.hasTimeline &&
                this.manager.startTime === this.manager.endTime
            ) {
                return {
                    reason: "Please select a start and end point on the timeline below",
                }
            }
            return { reason: "No entities with data for both X and Y" }
        }

        if (_.isEmpty(this.series)) return { reason: "No matching data" }

        return { reason: "" }
    }
}
