import * as _ from "lodash-es"
import { getOriginAttributionFragments } from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"

/**
 * Build a sources line from an array of columns.
 * Extracts attributions from column metadata and joins them into a single string.
 *
 * Used by both GrapherState.defaultSourcesLine and the batch processing in GrapherValuesJson.
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
