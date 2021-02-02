import { QueryParams } from "../../clientUtils/url"
import { omitUndefinedValues } from "../../clientUtils/Util"
import { EntityUrlBuilder } from "../../grapher/core/EntityUrlBuilder"
import { Patch } from "../../patch/Patch"

export const patchFromQueryParams = (queryParams: QueryParams): Patch => {
    return new Patch(
        omitUndefinedValues({
            ...queryParams,
            // If we don't encode it as an array,
            // Patch will escape the column delimiter.
            selection: queryParams.selection
                ? EntityUrlBuilder.queryParamToEntityNames(
                      queryParams.selection
                  )
                : undefined,
        })
    )
}

export const decodeURIComponentOrUndefined = (value: string | undefined) =>
    value !== undefined ? decodeURIComponent(value) : undefined
