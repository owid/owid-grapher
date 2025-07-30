import { computed, makeObservable } from "mobx"
import { ChartState } from "../chart/ChartInterface"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    EntityColorData,
    MarimekkoChartManager,
} from "./MarimekkoChartConstants"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { autoDetectYColumnSlugs } from "../chart/ChartUtils"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    ChartErrorInfo,
    ColorSchemeName,
    EntityName,
    ColorScaleConfigInterface,
} from "@ourworldindata/types"
import { OWID_NO_DATA_GRAY } from "../color/ColorConstants"
import { StackedSeries } from "./StackedConstants"
import { ColorScheme } from "../color/ColorScheme"
import { ColorSchemes } from "../color/ColorSchemes"

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

    @computed get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    @computed get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
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

    @computed get uniqueEntityNames(): EntityName[] | undefined {
        return this.xColumn?.uniqEntityNames ?? this.yColumns[0].uniqEntityNames
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

    @computed get errorInfo(): ChartErrorInfo {
        const column = this.yColumns[0]
        const { yColumns } = this

        if (!column) return { reason: "No Y column to chart" }

        return yColumns.every((col) => col.isEmpty)
            ? { reason: "No matching data" }
            : { reason: "" }
    }
}
