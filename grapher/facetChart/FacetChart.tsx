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
    number?: number
    chartTypeName: ChartTypeName
    manager: ChartManager
    strategy?: FacetStrategy
}

// Facet by columnSlug. If the columnSlug is entityName than will do one chart per country. If it is an array of column slugs, then will do
// one chart per slug with series broken out.

interface SmallChart {
    bounds: Bounds
    chartTypeName: ChartTypeName
    manager: ChartManager
    title: string
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

interface Facet {
    name: string
    manager: Partial<ChartManager>
    chartTypeName?: ChartTypeName
}

@observer
export class FacetChart extends React.Component<FacetChartProps> {
    @computed protected get smallCharts() {
        const { rootOptions, facets } = this
        const { chartTypeName } = this.props
        const count = facets.length
        const boundsArr = this.bounds.split(count, {
            rowPadding: 40,
            columnPadding: 40,
            outerPadding: 20,
        })
        const { columns, rows } = makeGrid(count)
        const {
            yColumnSlug,
            xColumnSlug,
            yColumnSlugs,
            colorColumnSlug,
            sizeColumnSlug,
            isRelativeMode,
        } = rootOptions

        const baseFontSize = getFontSize(count, rootOptions.baseFontSize)
        const lineStrokeWidth = count > 16 ? 1 : undefined

        const table = this.rootTable

        return facets.map((facet, index) => {
            const bounds = boundsArr[index]
            const column = index % columns
            const row = Math.floor(index / columns)
            const hideXAxis = row < rows - 1
            const hideYAxis = column > 0
            const hideLegend = !!(column !== columns - 1) // todo: only sho 1?
            const hidePoints = true

            const xAxis = undefined
            const yAxis = undefined

            const manager: ChartManager = {
                table,
                hideXAxis,
                hideYAxis,
                baseFontSize,
                lineStrokeWidth,
                hideLegend,
                hidePoints,
                xAxis,
                yAxis,
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
        return this.rootTable.selectedEntityNames.map((name) => {
            const table = this.rootTable.facet()
            table.setSelectedEntities([name])
            return { name, manager: { table } }
        })
    }

    @computed private get yColumns() {
        const slugs = this.rootOptions.yColumnSlugs || []
        return slugs.map((slug) => this.rootTable.get(slug))
    }

    @computed private get columnFacets(): Facet[] {
        const { yColumns } = this
        return yColumns.map((col) => {
            const name = col!.displayName
            return {
                name,
                manager: {
                    yColumnSlug: col?.slug,
                    seriesStrategy: SeriesStrategy.entity,
                },
            }
        })
    }

    @computed private get columnMapFacets(): Facet[] {
        const { yColumns } = this
        return [
            ...this.columnFacets,
            ...yColumns.map((col) => {
                return {
                    chartTypeName: ChartTypeName.WorldMap,
                    name: col!.displayName,
                    manager: {
                        yColumnSlug: col!.slug,
                    },
                }
            }),
        ]
    }

    @computed private get facets() {
        const { strategy } = this.props
        if (strategy === FacetStrategy.column) return this.columnFacets
        if (strategy === FacetStrategy.columnWithMap)
            return this.columnMapFacets
        return this.countryFacets
    }

    @computed protected get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed protected get rootTable() {
        return this.rootOptions.table
    }

    @computed protected get rootOptions() {
        return this.props.manager
    }

    render() {
        const fontSize = getFontSize(
            this.smallCharts.length,
            this.rootOptions.baseFontSize
        )
        return this.smallCharts.map((smallChart, index: number) => {
            const ChartComponent = getChartComponent(
                smallChart.chartTypeName
            ) as any // todo: how to type this?
            const { bounds, title } = smallChart
            return (
                <>
                    <ChartComponent
                        key={index}
                        bounds={bounds}
                        manager={smallChart.manager}
                    />
                    {FacetTitle(title, bounds, fontSize, index)}
                </>
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
