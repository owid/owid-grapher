import {
    FacetAxisDomain,
    GrapherInterface,
    GrapherQueryParams,
    TimeBoundValueStr,
} from "@ourworldindata/types"
import { generateSelectedEntityNamesParam } from "./EntityUrlBuilder.js"
import { match } from "ts-pattern"

// This function converts a (potentially partial) GrapherInterface to the query params this translates to.
// This is helpful for when we have a patch config to a parent chart, and we want to know which query params we need to get the parent chart as close as possible to the patched child chart.
// Note that some settings cannot be set in the config, so they are always set to undefined.
const grapherConfigToQueryParams = (
    config: GrapherInterface
): GrapherQueryParams => {
    const { minTime, maxTime } = config // can be a year, yyyy-mm-dd date, or "earliest" or "latest"

    const timeParam =
        minTime === maxTime
            ? minTime // This case also covers the case where both are undefined, in which case the result is also undefined
            : `${minTime ?? TimeBoundValueStr.unboundedLeft}..${maxTime ?? TimeBoundValueStr.unboundedRight}`

    const paramsRaw: Record<
        keyof GrapherQueryParams,
        string | number | boolean | undefined
    > = {
        // TODO this can currently only be "chart", "map", or "table", but we should also allow for "slope" or "line" some way
        tab: config.tab,
        xScale: config.xAxis?.scaleType,
        yScale: config.yAxis?.scaleType,
        stackMode: config.stackMode,
        zoomToSelection: config.zoomToSelection,
        endpointsOnly: config.compareEndPointsOnly,
        time: timeParam,
        region: config.map?.projection,
        facet: config.selectedFacetStrategy,
        uniformYAxis: match(config.yAxis?.facetDomain)
            .with(FacetAxisDomain.shared, () => 0)
            .with(FacetAxisDomain.independent, () => 1)
            .with(undefined, () => undefined)
            .exhaustive(),
        showNoDataArea: match(config.showNoDataArea)
            .when(
                (s) => typeof s === "boolean",
                (s) => Number(s) // 1 or 0
            )
            .with(undefined, () => undefined)
            .exhaustive(),
        country: config.selectedEntityNames
            ? generateSelectedEntityNamesParam(config.selectedEntityNames)
            : undefined,

        // These cannot be specified in config, so we always set them to undefined
        showSelectionOnlyInTable: undefined,
        overlay: undefined,
    }

    // Drop undefined values and convert all to string
    const params = Object.entries(paramsRaw).reduce(
        (acc, [currKey, currVal]) => {
            if (currVal !== undefined)
                acc[currKey as keyof GrapherQueryParams] = currVal.toString()
            return acc
        },
        {} as GrapherQueryParams
    )
    return params
}
