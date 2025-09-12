import * as _ from "lodash-es"
import * as R from "remeda"
import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    Bar,
    BarShape,
    EntityColorData,
    Item,
    MarimekkoChartManager,
    SimpleChartSeries,
    SimplePoint,
} from "./MarimekkoChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    autoDetectYColumnSlugs,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    ColorScaleConfigInterface,
    OwidVariableRow,
    SortConfig,
    SortBy,
    SortOrder,
} from "@ourworldindata/types"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { excludeUndefined } from "@ourworldindata/utils"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"
import { AxisConfig } from "../axis/AxisConfig.js"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis.js"

export class MarimekkoChartState implements ChartState, ColorScaleManager {
    manager: MarimekkoChartManager

    colorScale: ColorScale
    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = OWID_NO_DATA_GRAY

    constructor({ manager }: { manager: MarimekkoChartManager }) {
        this.manager = manager
        this.colorScale = manager.colorScaleOverride ?? new ColorScale(this)
        makeObservable(this)
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        const { inputTable } = this
        return this.manager.transformedTable ?? this.transformTable(inputTable)
    }

    transformTable(table: OwidTable): OwidTable {
        const { yColumnSlugs, manager, colorColumnSlug, xColumnSlug } = this
        if (!this.yColumnSlugs.length) return table

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(yColumnSlugs)

        yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        if (xColumnSlug)
            table = table.interpolateColumnWithTolerance(xColumnSlug)

        if (colorColumnSlug && manager.matchingEntitiesOnly)
            table = table.dropRowsWithErrorValuesForColumn(colorColumnSlug)

        if (!manager.showNoDataArea)
            table = table.dropRowsWithErrorValuesForAllColumns(yColumnSlugs)

        if (xColumnSlug)
            table = table.dropRowsWithErrorValuesForColumn(xColumnSlug)
        if (manager.isRelativeMode) {
            // TODO: this should not be necessary but we sometimes get NoMatchingValuesAfterJoin if both relative and showNoDataArea are set
            table = table.dropRowsWithErrorValuesForColumn(
                table.timeColumn.slug
            )
            if (xColumnSlug) {
                table = table.toPercentageFromEachEntityForEachTime(xColumnSlug)

                // relativized columns ditch their units, making "Population %" hard to parse. Add a sensible replacement
                Object.assign(table.get(xColumnSlug)?.def, {
                    unit: "share of total",
                })
            }
        }

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

    @computed get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    @computed get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get xColumnSlug(): string | undefined {
        return this.manager.xColumnSlug
    }

    @computed get xColumn(): CoreColumn | undefined {
        if (this.xColumnSlug === undefined) return undefined
        const columnSlugs = this.xColumnSlug ? [this.xColumnSlug] : []
        return this.transformedTable.getColumns(columnSlugs)[0]
    }

    @computed get colorColumnSlug(): string | undefined {
        // Marimekko charts only support categorical variables as color dimension
        return this.manager.categoricalColorColumnSlug
    }

    @computed get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get colorScaleColumn(): CoreColumn {
        const { manager, inputTable } = this
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            manager.colorScaleColumnOverride ??
            // We need to use filteredTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.

            // 2022-05-25: I considered using the filtered table below to get rid of Antarctica automatically
            // but the way things are currently done this leads to a shift in the colors assigned to continents
            // (i.e. they are no longer consistent cross the site). I think this downside is heavier than the
            // upside so I comment this out for now. Reconsider when we do colors differently.

            // manager.tableAfterAuthorTimelineAndActiveChartTransform?.get(
            //     this.colorColumnSlug
            // ) ??
            inputTable.get(this.colorColumnSlug)
        )
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes.get(this.manager.baseColorScheme)
                : undefined) ??
            ColorSchemes.get(ColorSchemeName["owid-distinct"])
        )
    }

    @computed private get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed private get unstackedSeries(): StackedSeries<EntityName>[] {
        const { colorScheme, yColumns } = this
        return (
            yColumns
                .map((col, i) => {
                    return {
                        seriesName: col.displayName,
                        columnSlug: col.slug,
                        color:
                            col.def.color ??
                            colorScheme.getColors(yColumns.length)[i],
                        points: col.owidRows.map((row) => ({
                            time: row.originalTime,
                            position: row.entityName,
                            value: row.value,
                            valueOffset: 0,
                        })),
                    }
                })
                // Do not plot columns without data
                .filter((series) => series.points.length > 0)
        )
    }

    @computed get series(): readonly StackedSeries<EntityName>[] {
        const valueOffsets = new Map<string, number>()
        return this.unstackedSeries.map((series) => ({
            ...series,
            points: series.points.map((point) => {
                const offset = valueOffsets.get(point.position) ?? 0
                const newPoint = { ...point, valueOffset: offset }
                valueOffsets.set(point.position, offset + point.value)
                return newPoint
            }),
        }))
    }

    @computed private get allPoints(): StackedPoint<EntityName>[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed get x0(): number {
        return 0
    }

    @computed get y0(): number {
        return 0
    }

    @computed get xSeries(): SimpleChartSeries | undefined {
        const createStackedXPoints = (
            rows: OwidVariableRow<any>[]
        ): SimplePoint[] => {
            const points: SimplePoint[] = []
            for (const row of rows) {
                points.push({
                    time: row.originalTime,
                    value: row.value,
                    entity: row.entityName,
                })
            }
            return points
        }
        if (this.xColumn === undefined) return undefined
        const column = this.xColumn
        return {
            seriesName: column.displayName,
            points: createStackedXPoints(column.owidRows),
        }
    }

    @computed get domainColorForEntityMap(): Map<string, EntityColorData> {
        const { colorColumn, colorScale, uniqueEntityNames } = this
        const hasColorColumn = !colorColumn.isMissing
        const colorRowsByEntity = hasColorColumn
            ? colorColumn.owidRowsByEntityName
            : undefined
        const domainColorMap = new Map<string, EntityColorData>()
        if (uniqueEntityNames !== undefined) {
            for (const name of uniqueEntityNames) {
                const colorDomainValue = colorRowsByEntity?.get(name)?.[0]

                if (colorDomainValue) {
                    const color = colorScale.getColor(colorDomainValue.value)
                    if (color)
                        domainColorMap.set(name, {
                            color,
                            colorDomainValue: colorDomainValue.value,
                        })
                }
            }
        }
        return domainColorMap
    }

    @computed private get uniqueEntityNames(): EntityName[] | undefined {
        return this.xColumn?.uniqEntityNames ?? this.yColumns[0].uniqEntityNames
    }

    @computed get items(): Item[] {
        const { xSeries, series, domainColorForEntityMap, uniqueEntityNames } =
            this

        if (uniqueEntityNames === undefined) return []

        const items: Item[] = uniqueEntityNames
            .map((entityName) => {
                const xPoint = xSeries
                    ? xSeries.points.find(
                          (point) => point.entity === entityName
                      )
                    : undefined
                if (xSeries && !xPoint) return undefined

                return {
                    entityName,
                    shortEntityName: getShortNameForEntity(entityName),
                    xPoint: xPoint,
                    entityColor: domainColorForEntityMap.get(entityName),
                    bars: excludeUndefined(
                        series.map((series): Bar | undefined => {
                            const point = series.points.find(
                                (point) => point.position === entityName
                            )
                            if (!point) return undefined
                            return {
                                kind: BarShape.Bar,
                                yPoint: point,
                                color: series.color,
                                seriesName: series.seriesName,
                                columnSlug: series.columnSlug,
                            }
                        })
                    ),
                    focus: this.focusArray.state(entityName),
                }
            })
            .filter((item) => item !== undefined) satisfies Item[]

        return items
    }

    @computed get sortedItems(): Item[] {
        const { items, sortConfig } = this

        let sortByFuncs: ((item: Item) => number | string | undefined)[]
        switch (sortConfig.sortBy) {
            case SortBy.custom:
                sortByFuncs = [(): undefined => undefined]
                break
            case SortBy.entityName:
                sortByFuncs = [(item: Item): string => item.entityName]
                break
            case SortBy.column: {
                const sortColumnSlug = sortConfig.sortColumnSlug
                sortByFuncs = [
                    (item: Item): number =>
                        item.bars.find((b) => b.seriesName === sortColumnSlug)
                            ?.yPoint.value ?? 0,
                    (item: Item): string => item.entityName,
                ]
                break
            }
            default:
            case SortBy.total:
                sortByFuncs = [
                    (item: Item): number => {
                        const lastPoint = R.last(item.bars)?.yPoint
                        if (!lastPoint) return 0
                        return lastPoint.valueOffset + lastPoint.value
                    },
                    (item: Item): string => item.entityName,
                ]
        }
        const sortedItems = _.sortBy(items, sortByFuncs)
        const sortOrder = sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedItems.reverse()

        const [itemsWithValues, itemsWithoutValues] = _.partition(
            sortedItems,
            (item) => item.bars.length !== 0
        )

        return [...itemsWithValues, ...itemsWithoutValues]
    }

    @computed get selectedItems(): Item[] {
        const selectedSet = this.selectionArray.selectedSet
        if (selectedSet.size === 0) return []
        return this.sortedItems.filter((item) =>
            selectedSet.has(item.entityName)
        )
    }

    @computed get yDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [
            Math.min(this.y0, _.min(maxValues) as number),
            Math.max(this.y0, _.max(maxValues) as number),
        ]
    }

    @computed get xDomainDefault(): [number, number] {
        if (this.xSeries !== undefined) {
            const sum = _.sumBy(this.xSeries.points, (point) => point.value)

            return [this.x0, sum]
        } else return [this.x0, this.items.length]
    }

    @computed private get xAxisLabelBase(): string {
        const xDimName = this.defaultXAxisLabel
        if (this.manager.xOverrideTime !== undefined)
            return `${xDimName} in ${this.manager.xOverrideTime}`
        return xDimName ?? "" // This sets the axis label to emtpy if we don't have an x column - not entirely sure this is what we want
    }

    @computed private get defaultXAxisLabel(): string | undefined {
        return this.xColumn?.displayName
    }

    @computed get horizontalAxisLabel(): string {
        const { xAxisLabelBase } = this
        const config = this.manager.xAxisConfig
        return config?.label || xAxisLabelBase
    }

    toHorizontalAxis(config: AxisConfig): HorizontalAxis {
        let axis = config.toHorizontalAxis()
        if (this.manager.isRelativeMode && this.xColumn) {
            // MobX and classes  interact in an annoying way here so we have to construct a new object via
            // an object copy of the AxisConfig class instance to be able to set a property without
            // making MobX unhappy about a mutation originating from a computed property
            axis = new HorizontalAxis(
                new AxisConfig(
                    { ...config.toObject(), maxTicks: 10 },
                    config.axisManager
                ),
                config.axisManager
            )
            axis.domain = [0, 100]
        } else {
            axis.updateDomainPreservingUserSettings(this.xDomainDefault)
        }

        axis.formatColumn = this.xColumn

        axis.label = this.horizontalAxisLabel

        return axis
    }

    toVerticalAxis(config: AxisConfig): VerticalAxis {
        const axis = config.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.yDomainDefault)

        axis.formatColumn = this.formatColumn
        axis.label = ""

        return axis
    }

    @computed get errorInfo(): ChartErrorInfo {
        const column = this.yColumns[0]
        const { yColumns } = this

        if (!column) return { reason: "No Y column to chart" }

        return yColumns.every((col) => col.isEmpty)
            ? { reason: "No matching data" }
            : { reason: "" }
    }
}
