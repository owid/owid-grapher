import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    EntityColorData,
    MARIMEKKO_SORT_KEYS,
    MarimekkoChartManager,
    MarimekkoSeries,
    MarimekkoSortKey,
} from "./MarimekkoChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    autoDetectYColumnSlugs,
    getShortNameForEntity,
    keepInputOrder,
    makeSelectionArray,
    SortKey,
    sortByConfig,
} from "../chart/ChartUtils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    ColorScaleConfigInterface,
    SortConfig,
    SortBy,
    ScaleType,
    Color,
} from "@ourworldindata/types"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"
import { excludeUndefined } from "@ourworldindata/utils"
import { SelectionArray } from "../selection/SelectionArray"
import { FocusArray } from "../focus/FocusArray"
import { AxisConfig } from "../axis/AxisConfig.js"
import { HorizontalAxis, VerticalAxis } from "../axis/Axis.js"
import { makeToleranceNotice } from "../chart/ToleranceNotice.js"

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
        const { yColumnSlug, manager, colorColumnSlug, xColumnSlug } = this
        if (yColumnSlug === undefined) return table

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues([yColumnSlug])

        if (colorColumnSlug && manager.matchingEntitiesOnly)
            table = table.dropRowsWithErrorValuesForColumn(colorColumnSlug)

        // We want to "chop off" any rows outside the time domain for X and Y to avoid creating
        // leading and trailing timeline times that don't really exist in the dataset.
        const xySlugs = xColumnSlug ? [xColumnSlug, yColumnSlug] : [yColumnSlug]
        const [timeDomainStart, timeDomainEnd] = table.timeDomainFor(xySlugs)
        table = table.filterByTimeRange(
            timeDomainStart ?? -Infinity,
            timeDomainEnd ?? Infinity
        )

        table = table.interpolateColumnWithTolerance(yColumnSlug)

        if (xColumnSlug)
            table = table.interpolateColumnWithTolerance(xColumnSlug)

        if (!manager.showNoDataArea)
            table = table.dropRowsWithErrorValuesForAllColumns([yColumnSlug])

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

    /** Marimekko plots a single y indicator; a config naming several keeps the first */
    @computed get yColumnSlug(): string | undefined {
        const slugs =
            this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
        return slugs[0]
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get formatColumn(): CoreColumn {
        return this.yColumn
    }

    @computed get xColumnSlug(): string | undefined {
        return this.manager.xColumnSlug
    }

    @computed get xColumn(): CoreColumn | undefined {
        if (this.xColumnSlug === undefined) return undefined
        return this.transformedTable.get(this.xColumnSlug)
    }

    @computed get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed get toleranceNotice(): string | undefined {
        return makeToleranceNotice({
            inputTable: this.inputTable,
            transformedTable: this.transformedTable,
            columns: excludeUndefined([this.yColumn, this.xColumn]),
        })
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

    /** Fallback bar color for entities the color column says nothing about */
    @computed get yColumnColor(): Color {
        return this.yColumn.def.color ?? this.colorScheme.getColors(1)[0]
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed get x0(): number {
        return 0
    }

    @computed get y0(): number {
        return 0
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
        return this.xColumn?.uniqEntityNames ?? this.yColumn.uniqEntityNames
    }

    @computed get series(): readonly MarimekkoSeries[] {
        const {
            xColumn,
            yColumn,
            yColumnColor,
            domainColorForEntityMap,
            uniqueEntityNames,
        } = this

        if (uniqueEntityNames === undefined) return []

        const yRowsByEntity = yColumn.owidRowsByEntityName
        const xRowsByEntity = xColumn?.owidRowsByEntityName

        return excludeUndefined(
            uniqueEntityNames.map((entityName) => {
                const xRow = xRowsByEntity?.get(entityName)?.[0]
                // An entity the x indicator says nothing about has no bar width
                if (xColumn && !xRow) return undefined

                const yRow = yRowsByEntity.get(entityName)?.[0]
                const entityColor = domainColorForEntityMap.get(entityName)

                return {
                    seriesName: entityName,
                    entityName,
                    shortEntityName: getShortNameForEntity(entityName),
                    xPoint: xRow
                        ? { value: xRow.value, time: xRow.originalTime }
                        : undefined,
                    yPoint: yRow
                        ? { value: yRow.value, time: yRow.originalTime }
                        : undefined,
                    color: entityColor?.color ?? yColumnColor,
                    entityColor,
                    focus: this.focusArray.state(entityName),
                }
            })
        )
    }

    @computed get sortedSeries(): MarimekkoSeries[] {
        const byYValue = (series: MarimekkoSeries): number =>
            series.yPoint?.value ?? 0
        const byEntityName = (series: MarimekkoSeries): string =>
            series.entityName

        const keyFns: Record<
            MarimekkoSortKey | SortBy.column,
            SortKey<MarimekkoSeries>
        > = {
            [SortBy.custom]: keepInputOrder,
            [SortBy.entityName]: byEntityName,
            [SortBy.total]: [byYValue, byEntityName],
            // With a single y indicator, sorting by column is sorting by total
            [SortBy.column]: [byYValue, byEntityName],
        }
        const sortedSeries = sortByConfig(this.series, this.sortConfig, keyFns)

        // The no-data area is drawn as one rectangle spanning the entities without a
        // value, and MarimekkoBars asserts they are contiguous, so they go last.
        const [seriesWithValues, seriesWithoutValues] = _.partition(
            sortedSeries,
            (series) => series.yPoint !== undefined
        )

        return [...seriesWithValues, ...seriesWithoutValues]
    }

    @computed get availableSortKeys(): MarimekkoSortKey[] {
        return [...MARIMEKKO_SORT_KEYS]
    }

    @computed get selectedSeries(): MarimekkoSeries[] {
        const selectedSet = this.selectionArray.selectedSet
        if (selectedSet.size === 0) return []
        return this.sortedSeries.filter((series) =>
            selectedSet.has(series.entityName)
        )
    }

    @computed get yDomainDefault(): [number, number] {
        // Every row, not one per entity: the domain covers the whole column
        const values = this.yColumn.owidRows.map((row) => row.value)
        return [
            Math.min(this.y0, _.min(values) as number),
            Math.max(this.y0, _.max(values) as number),
        ]
    }

    @computed get xDomainDefault(): [number, number] {
        const { xColumn } = this
        if (xColumn !== undefined) {
            const sum = _.sumBy(xColumn.owidRows, (row) => row.value)
            return [this.x0, sum]
        } else return [this.x0, this.series.length]
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

        // Marimekko charts should always use linear scale
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.xColumn

        axis.label = this.horizontalAxisLabel

        return axis
    }

    toVerticalAxis(config: AxisConfig): VerticalAxis {
        const axis = config.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.yDomainDefault)

        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.formatColumn
        axis.label = ""

        return axis
    }

    @computed get errorInfo(): ChartErrorInfo {
        if (this.yColumnSlug === undefined)
            return { reason: "No Y column to chart" }

        return this.yColumn.isEmpty
            ? { reason: "No matching data" }
            : { reason: "" }
    }
}
