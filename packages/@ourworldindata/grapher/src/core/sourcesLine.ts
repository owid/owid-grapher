import * as _ from "lodash-es"
import {
    ColumnSlug,
    formatAttributionsShortened,
    getAttributionFragmentsFromVariable,
} from "@ourworldindata/utils"
import {
    ColumnTypeMap,
    CoreColumn,
    OwidTable,
} from "@ourworldindata/core-table"
import {
    DimensionProperty,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
} from "@ourworldindata/types"
import { isPopulationVariableETLPath } from "./GrapherConstants.js"
import {
    isChartTab,
    getSupportedDimensionsForChartTypes,
} from "../chart/ChartTabs.js"

export const pickColumnsForSourcesLine = ({
    table,
    yColumnSlugs,
    xColumnSlug,
    colorColumnSlug,
    sizeColumnSlug,
    activeTab,
}: {
    table: OwidTable
    yColumnSlugs: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    activeTab?: GrapherTabName
}): ColumnSlug[] => {
    const activeDimensions = new Set(
        activeTab
            ? getDimensionPropertiesForActiveTab(activeTab)
            : getDimensionPropertiesForActiveTab(GRAPHER_TAB_NAMES.Table)
    )

    const columnSlugs: ColumnSlug[] = []

    // Include all y-columns
    if (activeDimensions.has(DimensionProperty.y)) {
        columnSlugs.push(...yColumnSlugs)
    }

    // Include color dimension, excluding:
    // - Continents variable
    if (colorColumnSlug && activeDimensions.has(DimensionProperty.color)) {
        const colorColumn = table.get(colorColumnSlug)
        if (!(colorColumn instanceof ColumnTypeMap.Continent)) {
            columnSlugs.push(colorColumnSlug)
        }
    }

    // Include x dimension, excluding:
    // - Population variable when used in Marimekko charts
    if (xColumnSlug && activeDimensions.has(DimensionProperty.x)) {
        const xColumn = table.get(xColumnSlug).def
        const isPopulationVariable = isPopulationVariableETLPath(
            xColumn?.catalogPath ?? ""
        )
        const isMarimekko = activeTab === GRAPHER_TAB_NAMES.Marimekko
        if (!(isMarimekko && isPopulationVariable)) {
            columnSlugs.push(xColumnSlug)
        }
    }

    // Include size dimension, excluding:
    // - Population variable
    if (sizeColumnSlug && activeDimensions.has(DimensionProperty.size)) {
        const sizeColumn = table.get(sizeColumnSlug).def
        const isPopulationVariable = isPopulationVariableETLPath(
            sizeColumn?.catalogPath ?? ""
        )
        if (!isPopulationVariable) {
            columnSlugs.push(sizeColumnSlug)
        }
    }

    return _.uniq(columnSlugs)
}

/**
 * Determines which dimension properties (y, x, color, size) are relevant
 * for the active tab
 */
const getDimensionPropertiesForActiveTab = (
    tab: GrapherTabName
): DimensionProperty[] => {
    const { x, y, color, size } = DimensionProperty

    // Only include dimensions relevant to the active chart type
    // (e.g. exclude x dimension for line charts)
    if (isChartTab(tab)) return getSupportedDimensionsForChartTypes([tab])

    // Only include y dimension for the map tab
    if (tab === GRAPHER_TAB_NAMES.WorldMap) return [y]

    // Include all dimensions for the table tab
    return [y, x, color, size]
}

export const buildSourcesLineFromColumns = (columns: CoreColumn[]): string => {
    const columnsWithSources = columns.filter(
        (column) => !!column.source.name || !_.isEmpty(column.def.origins)
    )

    const attributions = columnsWithSources.flatMap((column) =>
        getAttributionFragmentsFromVariable({
            ...column.def,
            source: column.source,
        })
    )

    return formatAttributionsShortened(_.uniq(attributions))
}
