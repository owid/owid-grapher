import {
    DimensionProperty,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherInterface,
} from "@ourworldindata/types"

/**
 * The config a chart starts from for an indicator: the indicator's own
 * ETL-authored grapher config when it has one, otherwise a plain map of the
 * indicator.
 *
 * Indicator-level configs don't necessarily carry `dimensions` (they describe
 * the indicator, not a chart), and the chart editor derives the parent
 * indicator from `dimensions`, so the y dimension is always filled in. The map
 * tab is offered unless the config opts out of it explicitly.
 *
 * Used by the indicator page's preview and "Edit as new chart" link, and by
 * the WebMCP `create_chart_from_indicator` tool.
 */
export function makeChartConfigForIndicator(
    variableId: number,
    grapherConfigETL: GrapherInterface | undefined
): GrapherInterface {
    const defaultDimensions = [{ property: DimensionProperty.y, variableId }]

    if (grapherConfigETL)
        return {
            ...grapherConfigETL,
            dimensions: grapherConfigETL.dimensions ?? defaultDimensions,
            hasMapTab: grapherConfigETL.hasMapTab ?? true,
        }

    return {
        yAxis: { min: 0 },
        map: { columnSlug: variableId.toString() },
        tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
        hasMapTab: true,
        dimensions: defaultDimensions,
    }
}
