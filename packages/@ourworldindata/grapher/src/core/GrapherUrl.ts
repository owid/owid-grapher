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
import { GrapherState } from "./Grapher.js"
import * as R from "remeda"
import {
    DEFAULT_GLOBE_ROTATION,
    DEFAULT_GLOBE_ZOOM,
} from "../mapCharts/MapChartConstants.js"

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
        mapSelect: config.map?.selectedEntityNames
            ? generateSelectedEntityNamesParam(config.map.selectedEntityNames)
            : undefined,
        globe: config.map?.globe?.isActive ? 1 : undefined,
        globeRotation: configGlobeRotationToQueryParam(
            config.map?.globe?.rotation
        ),
        globeZoom: configGlobeZoomToQueryParam(config.map?.globe?.zoom),

        // These cannot be specified in config, so we always set them to undefined
        showSelectionOnlyInTable: undefined,
        overlay: undefined,
        tableFilter: undefined,
        tableSearch: undefined,
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
    grapher: GrapherState
): GrapherQueryParams => {
    const params: GrapherQueryParams = {
        tab: grapher.mapGrapherTabToQueryParam(grapher.activeTab),
        xScale: grapher.xAxis?.scaleType,
        yScale: grapher.yAxis?.scaleType,
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
        showNoDataArea: grapher.showNoDataArea ? "1" : "0",
        country: grapher.areSelectedEntitiesDifferentThanAuthors
            ? generateSelectedEntityNamesParam(
                  grapher.selection.selectedEntityNames
              )
            : undefined,
        focus: grapher.areFocusedSeriesNamesDifferentThanAuthors
            ? generateFocusedSeriesNamesParam(grapher.focusArray.seriesNames)
            : undefined,
        mapSelect: generateSelectedEntityNamesParam(
            grapher.mapConfig.selection.selectedEntityNames
        ),
        globe: grapher.mapConfig.globe.isActive ? "1" : "0",
        globeRotation: !R.isDeepEqual(
            grapher.mapConfig.globe.rotation,
            DEFAULT_GLOBE_ROTATION
        )
            ? stringifyGlobeRotation(grapher.mapConfig.globe.rotation)
            : undefined,
        globeZoom:
            grapher.mapConfig.globe.zoom !== DEFAULT_GLOBE_ZOOM
                ? R.round(grapher.mapConfig.globe.zoom, 2).toString()
                : undefined,
        tableFilter: grapher.dataTableConfig.filter,
        tableSearch: grapher.dataTableConfig.search,
        overlay: grapher.overlayParam,
    }
    return params
}

/**
 * Maps the globe rotation given in a config, which is [lat, lon], to a query param
 * which is [lat, lon] as well. The default globe rotation is not persisted.
 */
function configGlobeRotationToQueryParam(
    configGlobeRotationLatLon?: [number, number]
): string | undefined {
    if (!configGlobeRotationLatLon) return undefined

    // don't persist the default globe rotation
    const isDefaultRotation = R.isDeepEqual(
        configGlobeRotationLatLon,
        // we use [lon, lat] internally, but here we are given [lat, lon]
        R.reverse(DEFAULT_GLOBE_ROTATION)
    )
    if (isDefaultRotation) return undefined

    return configGlobeRotationLatLon.map((r) => R.round(r, 2)).join(",")
}

function configGlobeZoomToQueryParam(zoom?: number): string | undefined {
    if (!zoom) return undefined

    // don't persist the default zoom level
    if (zoom === DEFAULT_GLOBE_ZOOM) return undefined

    return zoom.toString()
}

export function parseGlobeRotation(latLon: string): [number, number] {
    // we use [lon, lat] internally and [lat, lon] in the URL
    const [lat, lon] = latLon
        .split(",")
        .map((s) => +s)
        .slice(0, 2) as [number, number]
    return [lon, lat]
}

function stringifyGlobeRotation(lonLat: number[]): string {
    // we use [lon, lat] internally and [lat, lon] in the URL
    const lon = R.round(lonLat[0], 2)
    const lat = R.round(lonLat[1], 2)
    return [lat, lon].join(",")
}
