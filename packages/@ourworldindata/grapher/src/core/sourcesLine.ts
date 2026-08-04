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
import { getDimensionPropertiesForTab } from "../chart/ChartTabs.js"

export const pickColumnsForSourcesLine = ({
    table,
    yColumnSlugs,
    xColumnSlug,
    colorColumnSlug,
    sizeColumnSlug,
    mapColumnSlugs,
    activeTab,
}: {
    table: OwidTable
    yColumnSlugs: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    mapColumnSlugs?: ColumnSlug[]
    activeTab?: GrapherTabName
}): ColumnSlug[] => {
    const activeDimensions = new Set(
        getDimensionPropertiesForTab(activeTab ?? GRAPHER_TAB_NAMES.Table)
    )

    const columnSlugs: ColumnSlug[] = []

    // Include all y-columns
    if (activeDimensions.has(DimensionProperty.y)) {
        columnSlugs.push(...yColumnSlugs)
    }

    // Include the map columns (the projected and historical column if the map
    // shows combined data); fall back to the y columns if none are given
    if (activeDimensions.has(DimensionProperty.map)) {
        if (mapColumnSlugs?.length) columnSlugs.push(...mapColumnSlugs)
        else columnSlugs.push(...yColumnSlugs)
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
