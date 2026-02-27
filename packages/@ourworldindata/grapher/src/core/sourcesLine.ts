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
import { isPopulationVariableETLPath } from "./GrapherConstants.js"

export const pickColumnsForSourcesLine = ({
    table,
    yColumnSlugs,
    xColumnSlug,
    colorColumnSlug,
    sizeColumnSlug,
    isOnMarimekkoTab,
}: {
    table: OwidTable
    yColumnSlugs: ColumnSlug[]
    xColumnSlug?: ColumnSlug
    colorColumnSlug?: ColumnSlug
    sizeColumnSlug?: ColumnSlug
    isOnMarimekkoTab?: boolean
}): ColumnSlug[] => {
    // Always include all y-columns
    const columnSlugs: ColumnSlug[] = [...yColumnSlugs]

    // Include color dimension, excluding:
    // - Continents variable
    if (colorColumnSlug !== undefined) {
        const colorColumn = table.get(colorColumnSlug)
        if (!(colorColumn instanceof ColumnTypeMap.Continent)) {
            columnSlugs.push(colorColumnSlug)
        }
    }

    // Include x dimension, excluding:
    // - Population variable when used in Marimekko charts
    if (xColumnSlug !== undefined) {
        const xColumn = table.get(xColumnSlug).def
        const isPopulationVariable = !isPopulationVariableETLPath(
            xColumn?.catalogPath ?? ""
        )
        if (!(isOnMarimekkoTab && isPopulationVariable)) {
            columnSlugs.push(xColumnSlug)
        }
    }

    // Include size dimension, excluding:
    // - Population variable
    if (sizeColumnSlug !== undefined) {
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
