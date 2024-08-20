import { QueryParams, MultiDimDimensionChoices } from "@ourworldindata/types"
import { pick, Url } from "@ourworldindata/utils"
import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"

export const stateToQueryStr = (
    grapherQueryParams: QueryParams,
    dimensionChoices: MultiDimDimensionChoices
) => {
    return Url.fromQueryParams(grapherQueryParams).updateQueryParams(
        dimensionChoices
    ).queryStr
}

export const extractDimensionChoicesFromQueryStr = (
    queryStr: string,
    config: MultiDimDataPageConfig
): MultiDimDimensionChoices => {
    const queryParams = Url.fromQueryStr(queryStr).queryParams
    const dimensions = config.dimensions
    const dimensionChoices = pick(
        queryParams,
        Object.keys(dimensions)
    ) as MultiDimDimensionChoices

    return dimensionChoices
}
