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

export type QueryParamTransformMap = Record<
    string,
    {
        newName: string
        transformValue: (value: string | undefined) => string | undefined
    }
>

export const transformQueryParams = (
    queryParams: Readonly<QueryParams>,
    transformMap: QueryParamTransformMap
) => {
    const newQueryParams = { ...queryParams }
    for (const oldParamName in transformMap) {
        if (!(oldParamName in newQueryParams)) continue
        const { newName, transformValue } = transformMap[oldParamName]
        newQueryParams[newName] = transformValue(queryParams[oldParamName])
        delete newQueryParams[oldParamName]
    }
    return newQueryParams
}
