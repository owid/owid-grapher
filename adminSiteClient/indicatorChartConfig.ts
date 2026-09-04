import {
    DimensionProperty,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherInterface,
} from "@ourworldindata/types"

/**
 * The config a new chart starts from when it is created for an indicator: the
 * indicator's own ETL-authored grapher config when it has one, otherwise a
 * plain map of the indicator.
 *
 * Indicator-level configs don't necessarily carry `dimensions` (they describe
 * the indicator, not a chart), but the chart editor derives the parent
 * indicator from `dimensions`, so the y dimension is always filled in.
 *
 * Used by the indicator page's "Edit as new chart" link and by the WebMCP
 * `create_chart_from_indicator` tool.
 */
export function makeChartConfigForIndicator(
    variableId: number,
    grapherConfigETL: GrapherInterface | undefined
): GrapherInterface {
    const yDimension = { property: DimensionProperty.y, variableId }

    if (grapherConfigETL) {
        if (grapherConfigETL.dimensions?.length) return grapherConfigETL
        return { ...grapherConfigETL, dimensions: [yDimension] }
    }

    return {
        yAxis: { min: 0 },
        map: { columnSlug: variableId.toString() },
        tab: GRAPHER_TAB_CONFIG_OPTIONS.map,
        hasMapTab: true,
        dimensions: [yDimension],
    }
}
