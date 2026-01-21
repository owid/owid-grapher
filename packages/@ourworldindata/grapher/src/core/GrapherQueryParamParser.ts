import {
    EntityName,
    FacetAxisDomain,
    FacetStrategy,
    GrapherQueryParams,
    GrapherTabConfigOption,
    GRAPHER_TAB_CONFIG_OPTIONS,
    MapRegionName,
    ScaleType,
    SeriesName,
    StackMode,
} from "@ourworldindata/types"
import { parseFloatOrUndefined, Url } from "@ourworldindata/utils"
import { parseGlobeRotation } from "./GrapherUrl.js"
import {
    getEntityNamesParam,
    getSelectedEntityNamesParam,
    getFocusedSeriesNamesParam,
} from "./EntityUrlBuilder.js"
import { isValidTabQueryParam } from "../chart/ChartTabs.js"
import { isValidDataTableFilter } from "../dataTable/DataTable.js"
import { DataTableFilter } from "../dataTable/DataTableConstants.js"
import { DownloadModalTabName } from "../modal/DownloadModal.js"
import { GrapherModal } from "./GrapherConstants.js"
import { isValidMapRegionName } from "../mapCharts/MapHelpers.js"

/**
 * Discriminated union representing the result of parsing a query parameter
 *
 * Possible states:
 * - `valid`: The parameter was present and successfully parsed
 * - `invalid`: The parameter was present but contained an invalid value
 * - `missing`: The parameter was not present in the query string
 */
export type ParsedParam<T> =
    | { status: "valid"; value: T }
    | { status: "invalid"; rawValue: string; reason: string }
    | { status: "missing" }

/** Helper to create a valid parse result */
function valid<T>(value: T): ParsedParam<T> {
    return { status: "valid", value }
}

/** Helper to create an invalid parse result */
function invalid<T>(rawValue: string, reason: string): ParsedParam<T> {
    return { status: "invalid", rawValue, reason }
}

/** Helper to create a missing parse result */
function missing<T>(): ParsedParam<T> {
    return { status: "missing" }
}

/** Valid values for the `overlay` query parameter */
export const OVERLAY_PARAM_VALUES = {
    sources: "sources",
    download: "download",
    downloadData: "download-data",
    downloadVis: "download-vis",
} as const

export type OverlayParamValue =
    (typeof OVERLAY_PARAM_VALUES)[keyof typeof OVERLAY_PARAM_VALUES]

export interface ParsedOverlay {
    modal: GrapherModal
    downloadTab?: DownloadModalTabName
}

/** Parses a boolean parameter that uses "1"/"0" string values */
export function parseBooleanOneZeroParam(
    value: string | undefined
): ParsedParam<boolean> {
    if (value === undefined) return missing()
    if (value === "1") return valid(true)
    if (value === "0") return valid(false)
    return invalid(value, `Expected "1" or "0", got "${value}"`)
}

/** Parses a scale type parameter (linear or log) */
export function parseScaleTypeParam(
    value: string | undefined
): ParsedParam<ScaleType> {
    if (value === undefined) return missing()
    if (value === ScaleType.linear || value === ScaleType.log)
        return valid(value)
    return invalid(
        value,
        `Invalid scale type. Valid options: ${Object.values(ScaleType).join(", ")}`
    )
}

/** Parses the `tab` query parameter */
export function parseTabParam(
    value: string | undefined
): ParsedParam<GrapherTabConfigOption> {
    if (value === undefined) return missing()
    if (isValidTabQueryParam(value)) return valid(value)
    return invalid(
        value,
        `Invalid tab value. Valid options: ${Object.values(GRAPHER_TAB_CONFIG_OPTIONS).join(", ")}`
    )
}

/**
 * Parses the `overlay` query parameter.
 *
 * The "embed" value is intentionally ignored. In the past, there was
 * an issue where the embed modal URL was accidentally included in the
 * Embed dialog's URL, causing embeds to always show the modal.
 */
export function parseOverlayParam(
    value: string | undefined
): ParsedParam<ParsedOverlay> {
    if (value === undefined) return missing()

    switch (value) {
        case OVERLAY_PARAM_VALUES.sources:
            return valid({ modal: GrapherModal.Sources })
        case OVERLAY_PARAM_VALUES.download:
            return valid({ modal: GrapherModal.Download })
        case OVERLAY_PARAM_VALUES.downloadData:
            return valid({
                modal: GrapherModal.Download,
                downloadTab: DownloadModalTabName.Data,
            })
        case OVERLAY_PARAM_VALUES.downloadVis:
            return valid({
                modal: GrapherModal.Download,
                downloadTab: DownloadModalTabName.Vis,
            })
        default:
            return invalid(
                value,
                `Invalid overlay value. Valid options: ${Object.values(OVERLAY_PARAM_VALUES).join(", ")}`
            )
    }
}

/** Parses the `stackMode` query parameter */
export function parseStackModeParam(
    value: string | undefined
): ParsedParam<StackMode> {
    if (value === undefined) return missing()
    if (value === StackMode.absolute || value === StackMode.relative) {
        return valid(value)
    }
    return invalid(
        value,
        `Invalid stackMode value. Valid options: ${Object.values(StackMode).join(", ")}`
    )
}

/** Parses the `time` query parameter */
export function parseTimeParam(value: string | undefined): ParsedParam<string> {
    if (value === undefined || value === "") return missing()
    return valid(value)
}

/** Parses the `globe` query parameter */
export function parseGlobeParam(
    value: string | undefined
): ParsedParam<boolean> {
    return parseBooleanOneZeroParam(value)
}

/** Parses the `globeRotation` query parameter */
export function parseGlobeRotationParam(
    value: string | undefined
): ParsedParam<[number, number]> {
    if (value === undefined) return missing()

    const rotation = parseGlobeRotation(value)
    if (
        rotation &&
        rotation.length === 2 &&
        !isNaN(rotation[0]) &&
        !isNaN(rotation[1])
    ) {
        return valid(rotation)
    }

    return invalid(value, `Expected "lat,lon" format, got "${value}"`)
}

/** Parses the `globeZoom` query parameter */
export function parseGlobeZoomParam(
    value: string | undefined
): ParsedParam<number> {
    if (value === undefined) return missing()

    const parsed = parseFloatOrUndefined(value)
    if (parsed !== undefined) return valid(parsed)

    return invalid(value, `Expected numeric value, got "${value}"`)
}

/** Parses the `region` query parameter */
export function parseRegionParam(
    value: string | undefined
): ParsedParam<MapRegionName> {
    if (value === undefined) return missing()
    if (isValidMapRegionName(value)) return valid(value)
    return invalid(
        value,
        `Invalid region. Valid options: ${Object.values(MapRegionName).join(", ")}`
    )
}

/** Parses entity names from a query parameter */
export function parseEntityNamesParam(
    value: string | undefined
): ParsedParam<EntityName[]> {
    if (value === undefined) return missing()

    const names = getEntityNamesParam(value)
    if (names) return valid(names)

    return missing()
}

/** Parses the `country` query parameter with URL migration support */
export function parseCountryParam(
    params: GrapherQueryParams
): ParsedParam<EntityName[]> {
    if (params.country === undefined) return missing()

    const url = Url.fromQueryParams(params)
    const selection = getSelectedEntityNamesParam(url)

    return valid(selection ?? [])
}

/** Parses the `focus` query parameter for focused series names */
export function parseFocusParam(
    value: string | undefined
): ParsedParam<SeriesName[]> {
    if (value === undefined) return missing()
    const names = getFocusedSeriesNamesParam(value)
    if (names) return valid(names)
    return missing()
}

/** Parses the `facet` query parameter */
export function parseFacetParam(
    value: string | undefined
): ParsedParam<FacetStrategy> {
    if (value === undefined) return missing()
    if (isValidFacetStrategy(value)) return valid(value)
    return invalid(
        value,
        `Invalid facet value. Valid options: ${Object.values(FacetStrategy).join(", ")}`
    )
}

/** Parses the `uniformYAxis` query parameter */
export function parseUniformYAxisParam(
    value: string | undefined
): ParsedParam<FacetAxisDomain> {
    if (value === undefined) return missing()
    if (value === "0") return valid(FacetAxisDomain.independent)
    if (value === "1") return valid(FacetAxisDomain.shared)
    return invalid(value, `Expected "0" or "1", got "${value}"`)
}

/** Parses the `showNoDataArea` query parameter */
export function parseShowNoDataAreaParam(
    value: string | undefined
): ParsedParam<boolean> {
    return parseBooleanOneZeroParam(value)
}

/** Parses the deprecated `showSelectionOnlyInTable` query parameter */
export function parseShowSelectionOnlyInTableParam(
    value: string | undefined
): ParsedParam<DataTableFilter> {
    if (value === undefined) return missing()
    if (value === "1") return valid("selection")
    if (value === "0") return valid("all")
    return invalid(value, `Expected "0" or "1", got "${value}"`)
}

/** Parses the `tableFilter` query parameter */
export function parseTableFilterParam(
    value: string | undefined
): ParsedParam<DataTableFilter> {
    if (value === undefined) return missing()
    if (isValidDataTableFilter(value)) return valid(value)
    return invalid(value, "Invalid tableFilter value")
}

/** Parses the `tableSearch` query parameter */
export function parseTableSearchParam(
    value: string | undefined
): ParsedParam<string> {
    if (value === undefined || value === "") return missing()
    return valid(value)
}

/** Parses the `endpointsOnly` query parameter */
export function parseEndpointsOnlyParam(
    value: string | undefined
): ParsedParam<boolean> {
    return parseBooleanOneZeroParam(value)
}

/** Parses the `zoomToSelection` query parameter */
export function parseZoomToSelectionParam(
    value: string | undefined
): ParsedParam<true> {
    if (value === undefined) return missing()
    if (value === "true") return valid(true)
    return missing()
}

/** Maps each GrapherQueryParams key to its parsed value type */
type ParsedValueTypeMap = {
    tab: GrapherTabConfigOption
    overlay: ParsedOverlay
    stackMode: StackMode
    zoomToSelection: true
    xScale: ScaleType
    yScale: ScaleType
    time: string
    endpointsOnly: boolean
    globe: boolean
    globeRotation: [number, number]
    globeZoom: number
    region: MapRegionName
    mapSelect: EntityName[]
    country: EntityName[]
    focus: SeriesName[]
    facet: FacetStrategy
    uniformYAxis: FacetAxisDomain
    showNoDataArea: boolean
    showSelectionOnlyInTable: DataTableFilter
    tableFilter: DataTableFilter
    tableSearch: string
}

/**
 * Compile-time check: ensures ParsedValueTypeMap has all keys from GrapherQueryParams.
 * If a key is added to GrapherQueryParams but not ParsedValueTypeMap, this will cause
 * a type error.
 */
type _AssertAllKeysPresent =
    keyof GrapherQueryParams extends keyof ParsedValueTypeMap
        ? keyof ParsedValueTypeMap extends keyof GrapherQueryParams
            ? true
            : never
        : never
const _assertAllKeysPresent: _AssertAllKeysPresent = true

/** Container for all parsed query parameters */
export type ParsedGrapherQueryParams = {
    [K in keyof Required<GrapherQueryParams>]: ParsedParam<
        ParsedValueTypeMap[K]
    >
}

/** Parses all Grapher query parameters from a GrapherQueryParams object */
export function parseGrapherQueryParams(
    params: GrapherQueryParams
): ParsedGrapherQueryParams {
    return {
        tab: parseTabParam(params.tab),
        overlay: parseOverlayParam(params.overlay),
        stackMode: parseStackModeParam(params.stackMode),
        zoomToSelection: parseZoomToSelectionParam(params.zoomToSelection),
        xScale: parseScaleTypeParam(params.xScale),
        yScale: parseScaleTypeParam(params.yScale),
        time: parseTimeParam(params.time),
        endpointsOnly: parseEndpointsOnlyParam(params.endpointsOnly),
        globe: parseGlobeParam(params.globe),
        globeRotation: parseGlobeRotationParam(params.globeRotation),
        globeZoom: parseGlobeZoomParam(params.globeZoom),
        region: parseRegionParam(params.region),
        mapSelect: parseEntityNamesParam(params.mapSelect),
        country: parseCountryParam(params),
        focus: parseFocusParam(params.focus),
        facet: parseFacetParam(params.facet),
        uniformYAxis: parseUniformYAxisParam(params.uniformYAxis),
        showNoDataArea: parseShowNoDataAreaParam(params.showNoDataArea),
        showSelectionOnlyInTable: parseShowSelectionOnlyInTableParam(
            params.showSelectionOnlyInTable
        ),
        tableFilter: parseTableFilterParam(params.tableFilter),
        tableSearch: parseTableSearchParam(params.tableSearch),
    }
}

/** Logs all invalid query parameters to the console */
export function logInvalidQueryParams(parsed: ParsedGrapherQueryParams): void {
    const entries = Object.entries(parsed) as [
        keyof ParsedGrapherQueryParams,
        ParsedParam<unknown>,
    ][]

    for (const [key, result] of entries) {
        if (result.status === "invalid") {
            console.error(
                `Invalid query parameter "${key}": ${result.reason} (raw value: "${result.rawValue}")`
            )
        }
    }
}

function isValidFacetStrategy(value: string): value is FacetStrategy {
    return Object.values(FacetStrategy).includes(value as any)
}
