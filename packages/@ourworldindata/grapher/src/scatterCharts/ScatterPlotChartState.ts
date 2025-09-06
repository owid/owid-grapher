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
    ScatterPlotManager,
    ScatterSeries,
    SeriesPoint,
} from "./ScatterPlotChartConstants"
import { computed, makeObservable } from "mobx"
import { autoDetectYColumnSlugs } from "../chart/ChartUtils"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    ScaleType,
    ScatterPointLabelStrategy,
    ColorScaleConfigInterface,
} from "@ourworldindata/types"
import { intersection } from "@ourworldindata/utils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { AxisConfig } from "../axis/AxisConfig"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"

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
                color: "#932834", // Default color, used when no color dimension is present
                points,
            }
            this.assignColorToSeries(entityName, series)
            return series
        })
    }

    @computed get allPoints(): SeriesPoint[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.yColumn.isMissing) return { reason: "Missing Y axis variable" }

        if (this.xColumn.isMissing) return { reason: "Missing X axis variable" }

        const { entityTypePlural = "entities" } = this.manager
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
            return {
                reason: `No ${entityTypePlural} with data for both X and Y`,
            }
        }

        if (_.isEmpty(this.series))
            return {
                reason: `No data for any ${entityTypePlural}`,
            }

        return { reason: "" }
    }
}
