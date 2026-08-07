import * as _ from "lodash-es"
import {
    ColumnSlug,
    getOriginAttributionFragments,
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

/**
 * Build a sources line from an array of columns.
 * Extracts attributions from column metadata and joins them into a single string.
 */
export const buildSourcesLineFromColumns = (columns: CoreColumn[]): string => {
    const columnsWithSources = columns.filter(
        (column) => !!column.source.name || !_.isEmpty(column.def.origins)
    )

    const attributions = columnsWithSources.flatMap((column) => {
        const { presentation = {} } = column.def
        // If the variable metadata specifies an attribution on the
        // variable level then this is preferred over assembling it from
        // the source and origins
        if (
            presentation.attribution !== undefined &&
            presentation.attribution !== ""
        )
            return [presentation.attribution]
        else {
            const originFragments = getOriginAttributionFragments(
                column.def.origins
            )
            return [column.source.name, ...originFragments]
        }
    })

    const uniqueAttributions = _.uniq(_.compact(attributions))

    if (uniqueAttributions.length > 3)
        return `${uniqueAttributions[0]} and other sources`

    return uniqueAttributions.join("; ")
}
