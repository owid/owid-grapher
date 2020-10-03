import React from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { computed } from "mobx"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    FacetStrategy,
    SeriesStrategy,
} from "grapher/core/GrapherConstants"
import { getChartComponent } from "grapher/chart/ChartTypeMap"
import { ChartManager } from "grapher/chart/ChartManager"
import { makeGrid } from "grapher/utils/Util"
import { getElementWithHalo } from "grapher/scatterCharts/Halos"

interface FacetChartProps {
    bounds?: Bounds
    chartTypeName?: ChartTypeName
    manager: ChartManager
}

// Facet by columnSlug. If the columnSlug is entityName than will do one chart per country. If it is an array of column slugs, then will do
// one chart per slug with series broken out.

interface SmallChart {
    bounds: Bounds
    chartTypeName: ChartTypeName
    manager: ChartManager
    title: string
}

interface Facet {
    name: string
    manager: Partial<ChartManager>
    chartTypeName?: ChartTypeName
}

// not sure if we want to do something more sophisticated
const getFontSize = (
    count: number,
    baseFontSize: number = BASE_FONT_SIZE,
    min = 8
) => {
    if (count === 2) return baseFontSize
    if (count < 5) return baseFontSize - 2
    if (count < 10) return baseFontSize - 4
    if (count < 17) return baseFontSize - 6
    if (count < 36) return baseFontSize - 8
    return min
}

const getChartPadding = (count: number) => {
    if (count > 9) {
        return {
            rowPadding: 20,
            columnPadding: 20,
            outerPadding: 20,
        }
    }

    return {
        rowPadding: 40,
        columnPadding: 40,
        outerPadding: 20,
    }
}

@observer
export class FacetChart extends React.Component<FacetChartProps> {
    @computed protected get smallCharts() {
        const { manager, facets } = this
        const chartTypeName =
            this.props.chartTypeName ?? ChartTypeName.LineChart
        const count = facets.length

        const boundsArr = this.bounds.split(count, getChartPadding(count))
        const { columns, rows } = makeGrid(count)
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
            isRelativeMode,
        } = manager

        const baseFontSize = getFontSize(count, manager.baseFontSize)
        const lineStrokeWidth = count > 16 ? 1 : undefined

        const table = this.rootTable

        return facets.map((facet, index) => {
            const bounds = boundsArr[index]
            const column = index % columns
            const row = Math.floor(index / columns)
            const hideXAxis = false // row < rows - 1
            const hideYAxis = false // column > 0
            const hideLegend = !!(column !== columns - 1) // todo: only sho 1?
            const hidePoints = true
            const xAxisConfig = undefined
            const yAxisConfig = undefined

            const manager: ChartManager = {
                table,
                hideXAxis,
                hideYAxis,
                baseFontSize,
                lineStrokeWidth,
                hideLegend,
                hidePoints,
                xAxisConfig,
                yAxisConfig,
                yColumnSlug,
                xColumnSlug,
                yColumnSlugs,
                colorColumnSlug,
                sizeColumnSlug,
                isRelativeMode,
                ...facet.manager,
            }
            return {
                bounds,
                chartTypeName: facet.chartTypeName ?? chartTypeName,
                manager,
                title: facet.name,
            } as SmallChart
        })
    }

    @computed private get countryFacets(): Facet[] {
        const table = this.rootTable.filterBySelectedOnly()
        const yDomain = table.domainFor(this.yColumnSlugs)
        const scaleType = this.manager.yAxis?.scaleType
        const sameYAxis = true
        const yAxisConfig = sameYAxis
            ? {
                  max: yDomain[1],
                  min: yDomain[0],
                  scaleType,
              }
            : undefined
        const sameXAxis = true
        const xAxisConfig = sameXAxis
            ? {
                  max: table.maxTime,
                  min: table.minTime,
                  scaleType,
              }
            : undefined

        const hideLegend = this.manager.yColumnSlugs?.length === 1

        return this.rootTable.selectedEntityNames.map((name) => {
            return {
                name,
                manager: {
                    table: this.rootTable
                        .filterByEntityName(name)
                        .selectEntity(name),
                    hideLegend,
                    yAxisConfig,
                    xAxisConfig,
                },
            }
        })
    }

    @computed private get columnFacets(): Facet[] {
        const { yColumns } = this
        return yColumns.map((col) => {
            const name = col.displayName
            return {
                name,
                manager: {
                    yColumnSlug: col.slug,
                    seriesStrategy: SeriesStrategy.entity,
                },
            }
        })
    }

    @computed private get columnMapFacets(): Facet[] {
        return this.yColumns.map((col) => {
            return {
                chartTypeName: ChartTypeName.WorldMap,
                name: col.displayName,
                manager: {
                    yColumnSlug: col.slug,
                },
            }
        })
    }

    @computed private get yColumns() {
        return this.yColumnSlugs.map((slug) => this.rootTable.get(slug)!)
    }

    @computed private get yColumnSlugs() {
        return this.manager.yColumnSlugs || []
    }

    @computed private get facets() {
        const { facetStrategy } = this.manager
        if (facetStrategy === FacetStrategy.column) return this.columnFacets
        if (facetStrategy === FacetStrategy.columnWithMap)
            return [...this.columnFacets, ...this.columnMapFacets]
        if (facetStrategy === FacetStrategy.countryWithMap)
            return [...this.countryFacets, ...this.columnMapFacets]
        return this.countryFacets
    }

    @computed protected get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed protected get rootTable() {
        return this.manager.table
    }

    @computed protected get manager() {
        return this.props.manager
    }

    render() {
        const fontSize = getFontSize(
            this.smallCharts.length,
            this.manager.baseFontSize
        )
        return this.smallCharts.map((smallChart, index: number) => {
            const ChartComponent = getChartComponent(
                smallChart.chartTypeName
            ) as any // todo: how to type this?
            const { bounds, title } = smallChart
            return (
                <React.Fragment key={index}>
                    <ChartComponent
                        bounds={bounds}
                        manager={smallChart.manager}
                    />
                    {FacetTitle(title, bounds, fontSize, index)}
                </React.Fragment>
            )
        })
    }
}

const FacetTitle = (
    title: string,
    bounds: Bounds,
    fontSize: number,
    index: number
) =>
    getElementWithHalo(
        `title${index}halo`,
        <text
            x={bounds.centerX}
            y={bounds.top + fontSize}
            fill={"black"}
            textAnchor="middle"
            fontSize={fontSize}
        >
            {title}
        </text>,
        { strokeWidth: ".2em" }
    )
