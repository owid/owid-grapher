import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis.js"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"
import {
    BASE_FONT_SIZE,
    SeriesName,
    SeriesStrategy,
} from "../core/GrapherConstants.js"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import {
    exposeInstanceOnWindow,
    flatten,
    guid,
    max,
} from "../../clientUtils/Util.js"
import { computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import {
    StackedPoint,
    StackedRawSeries,
    StackedSeries,
} from "./StackedConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { ScaleOrdinal, scaleOrdinal } from "d3-scale"
import { easeLinear } from "d3-ease"
import { select } from "d3-selection"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { CategoricalBin } from "../color/ColorScaleBin.js"
import { HorizontalColorLegendManager } from "../horizontalColorLegend/HorizontalColorLegends.js"

export interface AbstractStackedChartProps {
    bounds?: Bounds
    manager: ChartManager
    disableLinearInterpolation?: boolean // just for testing
}

@observer
export class AbstractStackedChart
    extends React.Component<AbstractStackedChartProps>
    implements ChartInterface, FontSizeManager
{
    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table
            .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
            .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        if (!this.props.disableLinearInterpolation) {
            this.yColumnSlugs.forEach((slug) => {
                table = table.interpolateColumnLinearly(slug)
            })
        }

        // Drop rows for which no valid data points exist for any display column
        // after interpolation, which most likely means they lie at the start/end
        // of the time range and were not extrapolated
        table = table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)

        if (this.manager.isRelativeMode) {
            table = this.isEntitySeries
                ? table.toPercentageFromEachEntityForEachTime(
                      this.yColumnSlugs[0]
                  )
                : table.toPercentageFromEachColumnForEachEntityAndTime(
                      this.yColumnSlugs
                  )
        }
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

    @computed get manager(): ChartManager {
        return this.props.manager
    }
    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    protected get paddingForLegend(): number {
        return 0
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed protected get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    private animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    base: React.RefObject<SVGGElement> = React.createRef()
    componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            // Fancy intro animation
            this.animSelection = select(this.base.current)
                .selectAll("clipPath > rect")
                .attr("width", 0)

            this.animSelection
                .transition()
                .duration(800)
                .ease(easeLinear)
                .attr("width", this.bounds.width)
                .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
        }
        exposeInstanceOnWindow(this)
    }

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager)
    }

    @computed protected get dualAxis(): DualAxis {
        const {
            bounds,
            horizontalAxisPart,
            verticalAxisPart,
            paddingForLegend,
        } = this
        return new DualAxis({
            bounds: bounds.padRight(paddingForLegend),
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                hideGridlines: true,
                ...this.manager.xAxisConfig,
            },
            this
        )
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        // TODO: enable nice axis ticks for linear scales
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        // const lastSeries = this.series[this.series.length - 1]
        // const yValues = lastSeries.points.map((d) => d.yOffset + d.y)
        const yValues = this.allStackedPoints.map(
            (point) => point.value + point.valueOffset
        )
        const axis = this.yAxisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings([0, max(yValues) ?? 100]) // Stacked area chart must have its own y domain)
        axis.formatColumn = this.yColumns[0]
        return axis
    }

    @computed
    private get columnsAsSeries(): readonly StackedRawSeries<number>[] {
        return this.yColumns
            .map((col) => {
                return {
                    isProjection: col.isProjection,
                    seriesName: col.displayName,
                    rows: col.owidRows,
                }
            })
            .reverse() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    private get entitiesAsSeries(): readonly StackedRawSeries<number>[] {
        const { isProjection, owidRowsByEntityName } = this.yColumns[0]
        return this.selectionArray.selectedEntityNames
            .map((seriesName) => {
                return {
                    isProjection,
                    seriesName,
                    rows: owidRowsByEntityName.get(seriesName) || [],
                }
            })
            .reverse() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    protected get rawSeries(): readonly StackedRawSeries<number>[] {
        return this.isEntitySeries
            ? this.entitiesAsSeries
            : this.columnsAsSeries
    }

    @computed
    protected get allStackedPoints(): readonly StackedPoint<number>[] {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get failMessage(): string {
        const { yColumnSlugs } = this
        if (!yColumnSlugs.length) return "Missing variable"
        if (!this.series.length) return "No matching data"
        if (!this.allStackedPoints.length) return "No matching points"
        return ""
    }

    @computed private get colorScheme(): ScaleOrdinal<string, string> {
        const scheme =
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : null) ?? ColorSchemes.stackedAreaDefault
        const seriesCount = this.isEntitySeries
            ? this.selectionArray.numSelectedEntities
            : this.yColumns.length
        const baseColors = scheme.getColors(seriesCount)
        if (this.manager.invertColorScheme) baseColors.reverse()
        return scaleOrdinal(baseColors)
    }

    getColorForSeries(seriesName: SeriesName): string {
        const table = this.transformedTable
        const color = this.isEntitySeries
            ? table.getColorForEntityName(seriesName)
            : table.getColorForColumnByDisplayName(seriesName)
        return color ?? this.colorScheme(seriesName) ?? "#ddd"
    }

    @computed protected get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed get isEntitySeries(): boolean {
        return this.seriesStrategy === SeriesStrategy.entity
    }

    @computed get seriesColors(): string[] {
        return this.series.map((series) => series.color)
    }

    /** Whether we want to display series with only zeroes. Defaults to true but e.g. StackedArea charts want to set this to false */
    get showAllZeroSeries(): boolean {
        return true
    }

    @computed get unstackedSeries(): readonly StackedSeries<number>[] {
        return this.rawSeries
            .filter(
                (series) =>
                    series.rows.length &&
                    (this.showAllZeroSeries ||
                        series.rows.some((row) => row.value !== 0))
            )
            .map((series) => {
                const { isProjection, seriesName, rows } = series
                return {
                    seriesName,
                    isProjection,
                    points: rows.map((row) => {
                        return {
                            position: row.time,
                            time: row.time,
                            value: row.value,
                            valueOffset: 0,
                        }
                    }),
                    color: this.getColorForSeries(seriesName),
                }
            }) as StackedSeries<number>[]
    }

    @computed get series(): readonly StackedSeries<number>[] {
        return this.unstackedSeries
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.manager.hideLegend) {
            const categoricalLegendData = this.series
                .map(
                    (series, index) =>
                        new CategoricalBin({
                            index,
                            value: series.seriesName,
                            label: series.seriesName,
                            color: series.color,
                        })
                )
                .reverse()
            return { categoricalLegendData }
        }
        return undefined
    }
}
