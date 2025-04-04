import {
    FacetAxisDomain,
    GrapherInterface,
    GrapherQueryParams,
    TimeBoundValueStr,
} from "@ourworldindata/types"
import {
    generateFocusedSeriesNamesParam,
    generateSelectedEntityNamesParam,
} from "./EntityUrlBuilder.js"
import { match } from "ts-pattern"
import { Grapher } from "./Grapher.js"

// This function converts a (potentially partial) GrapherInterface to the query params this translates to.
// This is helpful for when we have a patch config to a parent chart, and we want to know which query params we need to get the parent chart as close as possible to the patched child chart.
// Note that some settings cannot be set in the config, so they are always set to undefined.
export const grapherConfigToQueryParams = (
    config: GrapherInterface
): GrapherQueryParams => {
    const { minTime, maxTime } = config // can be a number, or "earliest" or "latest"

    // Note that this code will never format dates in yyyy-mm-dd format.
    // For us to know that we're working with daily data, we need to have a DayColumn instance, which we only have when we have a grapher instance.
    // Instead, we just serialize a date as a number - which also works fine for query params.
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
        region: config.map?.region,
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
        focus: config.focusedSeriesNames
            ? generateFocusedSeriesNamesParam(config.focusedSeriesNames)
            : undefined,

        // These cannot be specified in config, so we always set them to undefined
        showSelectionOnlyInTable: undefined,
        overlay: undefined,
        globe: undefined,
        mapCountry: undefined,
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

export const grapherObjectToQueryParams = (
    grapher: Grapher
): GrapherQueryParams => {
    const params: GrapherQueryParams = {
        tab: grapher.mapGrapherTabToQueryParam(grapher.activeTab),
        xScale: grapher.xAxis.scaleType,
        yScale: grapher.yAxis.scaleType,
        stackMode: grapher.stackMode,
        zoomToSelection: grapher.zoomToSelection ? "true" : undefined,
        endpointsOnly: grapher.compareEndPointsOnly ? "1" : "0",
        time: grapher.timeParam,
        region: grapher.map.region,
        facet: grapher.selectedFacetStrategy,
        uniformYAxis:
            grapher.yAxis.facetDomain === FacetAxisDomain.independent
                ? "0"
                : "1",
        showSelectionOnlyInTable: grapher.showSelectionOnlyInDataTable
            ? "1"
            : "0",
        showNoDataArea: grapher.showNoDataArea ? "1" : "0",
        country: grapher.areSelectedEntitiesDifferentThanAuthors
            ? generateSelectedEntityNamesParam(
                  grapher.selection.selectedEntityNames
              )
            : undefined,
        focus: grapher.areFocusedSeriesNamesDifferentThanAuthors
            ? generateFocusedSeriesNamesParam(grapher.focusArray.seriesNames)
            : undefined,
        globe: grapher.mapConfig.globe.isActive ? "1" : "0",
        mapCountry: generateSelectedEntityNamesParam(
            grapher.mapConfig.selectedCountries.selectedEntityNames
        ),
    }
    return params
}
