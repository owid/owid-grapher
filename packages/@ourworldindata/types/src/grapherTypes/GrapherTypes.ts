import {
    OwidChartDimensionInterface,
    OwidVariableRoundingMode,
} from "../OwidVariableDisplayConfigInterface.js"
import { ColumnSlugs, EntityName } from "../domainTypes/CoreTableTypes.js"
import { AxisAlign, Position } from "../domainTypes/Layout.js"
import { Integer } from "../domainTypes/Various.js"
import { DetailDictionary } from "../gdocTypes/Gdoc.js"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GRAPHER_TAB_QUERY_PARAMS,
} from "./GrapherConstants.js"
import { ArchiveContext } from "../domainTypes/Archive.js"
import {
    BinningStrategyIncludingManual,
    MidpointMode,
} from "./BinningStrategyTypes.js"
import { CatalogDataForKey, CatalogKey } from "../CatalogTypes.js"

// Utility type that marks all properties of T that may be undefined as optional.
export type UndefinedToOptional<T> = Partial<T> & {
    [K in keyof T as undefined extends T[K] ? never : K]: T[K]
}

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum SortBy {
    /** Preserve the specified entity order */
    custom = "custom",
    /** Sort alphabetically by entity name */
    entityName = "entityName",
    /** Sort by the value of a specific column, identified by sortColumnSlug */
    column = "column",
    /** Sort by the total across all columns */
    total = "total",
    /** Sort by the change between the start and end values (dumbbell charts) */
    change = "change",
    /** Sort by the start value (dumbbell charts) */
    startValue = "startValue",
    /** Sort by the end value (dumbbell charts) */
    endValue = "endValue",
}

export interface SortConfig {
    sortBy?: SortBy
    sortOrder?: SortOrder
    sortColumnSlug?: string
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]

export type PrimitiveType = number | string | boolean
export type ValueRange = [number, number]

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export enum KeyChartLevel {
    None = 0, // not a key chart, will not show in the all charts block of the related topic page
    Bottom = 1, // chart will show at the bottom of the all charts block
    Middle = 2, // chart will show in the middle of the all charts block
    Top = 3, // chart will show at the top of the all charts block
}

/**
 * How to mark a detail on demand:
 * - superscript: add a superscript reference number
 * - underline: underline the text
 * - none: don't mark it
 */
export type DetailsMarker = "superscript" | "underline" | "none"

export interface BasicChartInformation {
    title: string
    slug: string
    variantName?: string | null
}
export interface RelatedChart extends BasicChartInformation {
    chartId: number
    keyChartLevel?: KeyChartLevel
    archiveContext?: ArchiveContext | undefined
}
export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

// see CoreTableConstants.ts
export type ColumnSlug = string // a url friendly name for a column in a table. cannot have spaces

/**
 * An unbounded value (±Infinity) or a concrete point in time (year or date).
 */
export type TimeBound = number

export type TimeBounds = [TimeBound, TimeBound]

/**
 * The two special TimeBound values: unbounded left & unbounded right.
 */
export enum TimeBoundValue {
    negativeInfinity = -Infinity,
    positiveInfinity = Infinity,
}

export enum TimeBoundValueStr {
    unboundedLeft = "earliest",
    unboundedRight = "latest",
}

/**
 * Time tolerance strategy used for maps
 */
export enum ToleranceStrategy {
    closest = "closest",
    backwards = "backwards",
    forwards = "forwards",
}

export interface ToleranceOptions {
    toleranceOverride?: number
    toleranceStrategyOverride?: ToleranceStrategy
}

export enum AxisMinMaxValueStr {
    auto = "auto",
}

// We currently have the notion of "modes", where you can either select 1 entity, or select multiple entities, or not change the selection at all.
// Todo: can we remove?
export enum EntitySelectionMode {
    MultipleEntities = "add-country",
    SingleEntity = "change-country",
    Disabled = "disabled",
}

export enum StackMode {
    absolute = "absolute",
    relative = "relative",
}

export enum FacetStrategy {
    none = "none", // No facets
    entity = "entity", // One chart for each country/entity
    metric = "metric", // One chart for each Y column
}

export enum FacetAxisDomain {
    independent = "independent", // all facets have their own y domain
    // TODO: rename to "uniform", since "shared" has a different meaning when
    // axes are being plotted (it means the axis is omitted).
    // Need to migrate Grapher & Explorer configs.
    shared = "shared", // all facets share the same y domain
}

export enum SeriesStrategy {
    column = "column", // One line per column
    entity = "entity", // One line per entity
}

export interface ChartErrorInfo {
    reason: string // no chart error if set to the empty string
    help?: string
}

export type SeriesName = string

export type SeriesColorMap = Map<SeriesName, Color>

export type GrapherMapType = typeof GRAPHER_MAP_TYPE
export type GrapherChartType = keyof typeof GRAPHER_CHART_TYPES
export type GrapherChartOrMapType = GrapherChartType | GrapherMapType

export type GrapherTabConfigOption = keyof typeof GRAPHER_TAB_CONFIG_OPTIONS
export type GrapherTabQueryParam = keyof typeof GRAPHER_TAB_QUERY_PARAMS
export type GrapherTabName = keyof typeof GRAPHER_TAB_NAMES

export interface RelatedQuestionsConfig {
    text: string
    url: string
}

export enum MissingDataStrategy {
    auto = "auto", // pick default strategy based on chart type
    hide = "hide", // hide entities with missing data
    show = "show", // show entities with missing data
}

// When a user hovers over a connected series line in a ScatterPlot we show
// a label for each point. By default that value will be from the "year" column
// but by changing this option the column used for the x or y axis could be used instead.
export enum ScatterPointLabelStrategy {
    year = "year",
    x = "x",
    y = "y",
}

export enum PeerCountryStrategy {
    /** Use the containing continent, income group and World as peers */
    ParentRegions = "parentRegions",
    /** Use countries with similar GDP per capita as peers */
    GdpPerCapita = "gdpPerCapita",
    /** Use countries with similar population as peers */
    Population = "population",
    /** Use countries that represent the full data range */
    DataRange = "dataRange",
    /** Use the chart's default selection as peers */
    DefaultSelection = "defaultSelection",
    /** Use geographically neighboring countries as peers */
    Neighbors = "neighbors",
    /** Don't automatically add any peer countries (useful in search) */
    None = "none",
}

export type PeerCountryStrategyQueryParam = PeerCountryStrategy | "auto"

/** Valid values for the peerCountries query parameter */
export const VALID_PEER_COUNTRY_STRATEGY_QUERY_PARAMS: PeerCountryStrategyQueryParam[] =
    ["auto", ...Object.values(PeerCountryStrategy)]

export enum GrapherTooltipAnchor {
    /** The tooltip is positioned relative to the mouse cursor */
    Mouse = "mouse",
    /** The tooltip is pinned to the bottom of the screen */
    Bottom = "bottom",
}

export interface AnnotationFieldsInTitle {
    entity?: boolean
    time?: boolean
    changeInPrefix?: boolean
}

export interface Tickmark {
    value: number
    priority: number
    faint?: boolean
    gridLineOnly?: boolean
    solid?: boolean // mostly for labelling domain start (e.g. 0)
    label?: string
}
export interface TickFormattingOptions {
    roundingMode?: OwidVariableRoundingMode
    numDecimalPlaces?: number
    numSignificantFigures?: number
    unit?: string
    trailingZeroes?: boolean
    spaceBeforeUnit?: boolean
    useNoBreakSpace?: boolean
    showPlus?: boolean
    numberAbbreviation?: "short" | "long" | false
}
// Represents the actual entered configuration state in the editor
export interface AxisConfigInterface {
    scaleType?: ScaleType
    label?: string
    min?: number | AxisMinMaxValueStr.auto
    max?: number | AxisMinMaxValueStr.auto
    canChangeScaleType?: boolean
    removePointsOutsideDomain?: boolean
    hideAxis?: boolean
    hideTickLabels?: boolean

    /** Hide the faint lines that are shown inside the plot (axis ticks may still be visible). */
    hideGridlines?: boolean

    /**
     * The *preferred* orientation of the axis.
     * If the orientation is not supported by the axis, this parameter will be ignored.
     */
    orient?: Position

    /**
     * Whether the axis domain should be the same across faceted charts (if possible)
     */
    facetDomain?: FacetAxisDomain

    /**
     * Minimum pixels to take up.
     * Dictates the minimum height for a HorizontalAxis, minimum width for a VerticalAxis.
     */
    minSize?: number

    /**
     * The padding between an axis label and an axis tick
     */
    labelPadding?: number

    /**
     * The padding between an axis tick and an axis gridline
     */
    tickPadding?: number

    /**
     * Extend scale to start & end on "nicer" round values.
     * See: https://github.com/d3/d3-scale#continuous_nice
     */
    nice?: boolean

    /**
     * The (rough) maximum number of ticks to show. Not a strict limit, more ticks may be shown.
     * See: https://github.com/d3/d3-scale#continuous_ticks
     */
    maxTicks?: number

    /**
     * Custom ticks to use. Any automatic ticks are omitted.
     * Note that the ticks will be omitted if they are outside the axis domain.
     * To control the domain, use `min` and `max`.
     */
    ticks?: Tickmark[]

    /**
     * Tick formatting overrides. Allows things like omitting the unit and using
     * short number abbreviations.
     */
    tickFormattingOptions?: TickFormattingOptions

    /**
     * What to do when .place() is called on an axis that only contains a single
     * domain value.
     * Should the point be placed at the start, middle or end of the axis?
     */
    singleValueAxisPointAlign?: AxisAlign

    /**
     * If given, treat the axis as a band scale: each value occupies a fixed
     * width and the axis is padded on both sides to reserve space for the
     * outermost values.
     *
     * These values also become the default tick positions (one tick per band),
     * unless `ticks` is set explicitly or a calendar-aware tick layout applies
     * (e.g. monthly time axes).
     */
    bandValues?: number[]

    /**
     * Whether to offset the leftmost tick label so it doesn't overflow the axis start.
     * Defaults to true.
     */
    shouldOffsetTickLabelAtStart?: boolean

    /**
     * Whether to offset the rightmost tick label so it doesn't overflow the axis end.
     * Defaults to true.
     */
    shouldOffsetTickLabelAtEnd?: boolean
}

export interface VerticalComparisonLineConfig {
    xEquals: number // x-coordinate of the vertical line
    label?: string
}

export interface CustomComparisonLineConfig {
    yEquals?: string // line equation like "2*x^2" or "sqrt(x)"; defaults to "x"
    label?: string
}

export type ComparisonLineConfig =
    | VerticalComparisonLineConfig
    | CustomComparisonLineConfig

export interface VerticalComparisonLineLabelPlacement {
    x: number
    anchor: "start" | "end"
}

export enum LogoOption {
    owid = "owid",
    "core+owid" = "core+owid",
    "gv+owid" = "gv+owid",
    wordmark = "wordmark",
}

export enum LicenseOption {
    "cc-by" = "cc-by",
    "cc-by-sa" = "cc-by-sa",
    "cc-by-nc" = "cc-by-nc",
    "cc-by-nc-sa" = "cc-by-nc-sa",
    "cc-by-nd" = "cc-by-nd",
    "cc-by-nc-nd" = "cc-by-nc-nd",
}

export const CHART_LICENSES: Record<
    LicenseOption,
    { name: string; url: string }
> = {
    [LicenseOption["cc-by"]]: {
        name: "CC BY",
        url: "https://creativecommons.org/licenses/by/4.0/",
    },
    [LicenseOption["cc-by-sa"]]: {
        name: "CC BY-SA",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
    [LicenseOption["cc-by-nc"]]: {
        name: "CC BY-NC",
        url: "https://creativecommons.org/licenses/by-nc/4.0/",
    },
    [LicenseOption["cc-by-nc-sa"]]: {
        name: "CC BY-NC-SA",
        url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    },
    [LicenseOption["cc-by-nd"]]: {
        name: "CC BY-ND",
        url: "https://creativecommons.org/licenses/by-nd/4.0/",
    },
    [LicenseOption["cc-by-nc-nd"]]: {
        name: "CC BY-NC-ND",
        url: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    },
}

export const DEFAULT_CHART_LICENSE = LicenseOption["cc-by"]

export interface ProjectionColumnInfo {
    projectedSlug: ColumnSlug
    historicalSlug: ColumnSlug
    combinedSlug: ColumnSlug
    slugForIsProjectionColumn: ColumnSlug
}

export interface ColorScaleConfigInterface {
    baseColorScheme?: ColorSchemeName
    colorSchemeInvert?: boolean
    binningStrategy: BinningStrategyIncludingManual
    createBinForMidpoint?: boolean
    minValue?: number
    maxValue?: number
    midpoint?: number
    midpointMode?: MidpointMode
    customNumericValues: number[]
    customNumericLabels: (string | undefined | null)[]
    customNumericColorsActive?: boolean
    customNumericColors: (Color | undefined | null)[]

    customCategoryColors: Record<string, string | undefined>
    customCategoryLabels: Record<string, string | undefined>
    customHiddenCategories: Record<string, true | undefined>
    legendDescription?: string
}

export const colorScaleConfigDefaults = {
    binningStrategy: "auto",
    customNumericValues: [],
    customNumericLabels: [],
    customNumericColors: [],

    customCategoryColors: {},
    customCategoryLabels: {},
    customHiddenCategories: {},
} satisfies ColorScaleConfigInterface

export interface ColorSchemeInterface {
    name: string
    colorSets: Color[][] // Different color sets depending on how many distinct colors you want
    singleColorScale?: boolean
    isDistinct?: boolean
    displayName?: string
    colorMap?: Record<string, Color> // Optional mapping from categorical values to specific colors
}

// Note: TypeScript does not currently support extending or merging enums. Ideally we would have 2 enums here (one for custom and one for brewer) and then just merge them.
// https://github.com/microsoft/TypeScript/issues/17592
export enum ColorSchemeName {
    // Brewer schemes:
    YlGn = "YlGn",
    YlGnBu = "YlGnBu",
    GnBu = "GnBu",
    BuGn = "BuGn",
    PuBuGn = "PuBuGn",
    BuPu = "BuPu",
    RdPu = "RdPu",
    PuRd = "PuRd",
    OrRd = "OrRd",
    YlOrRd = "YlOrRd",
    YlOrBr = "YlOrBr",
    Purples = "Purples",
    Blues = "Blues",
    Greens = "Greens",
    Oranges = "Oranges",
    Reds = "Reds",
    Greys = "Greys",
    PuOr = "PuOr",
    BrBG = "BrBG",
    PRGn = "PRGn",
    PiYG = "PiYG",
    RdBu = "RdBu",
    RdGy = "RdGy",
    RdYlBu = "RdYlBu",
    Spectral = "Spectral",
    RdYlGn = "RdYlGn",
    Accent = "Accent",
    Dark2 = "Dark2",
    Paired = "Paired",
    Pastel1 = "Pastel1",
    Pastel2 = "Pastel2",
    Set1 = "Set1",
    Set2 = "Set2",
    Set3 = "Set3",
    PuBu = "PuBu",

    // Custom schemes:
    Magma = "Magma",
    Inferno = "Inferno",
    Plasma = "Plasma",
    Viridis = "Viridis",
    continents = "continents",
    stackedAreaDefault = "stackedAreaDefault",
    "owid-distinct" = "owid-distinct",
    SingleColorDenim = "SingleColorDenim",
    SingleColorTeal = "SingleColorTeal",
    SingleColorPurple = "SingleColorPurple",
    SingleColorDustyCoral = "SingleColorDustyCoral",
    SingleColorDarkCopper = "SingleColorDarkCopper",
    OwidCategoricalA = "OwidCategoricalA",
    OwidCategoricalB = "OwidCategoricalB",
    OwidCategoricalC = "OwidCategoricalC",
    OwidCategoricalD = "OwidCategoricalD",
    OwidCategoricalE = "OwidCategoricalE",
    OwidCategoricalMap = "OwidCategoricalMap",
    OwidEnergy = "OwidEnergy",
    OwidEnergyLines = "OwidEnergyLines",
    OwidDistinctLines = "OwidDistinctLines",
    BinaryMapPaletteA = "BinaryMapPaletteA",
    BinaryMapPaletteB = "BinaryMapPaletteB",
    BinaryMapPaletteC = "BinaryMapPaletteC",
    BinaryMapPaletteD = "BinaryMapPaletteD",
    BinaryMapPaletteE = "BinaryMapPaletteE",
    BinaryMapPaletteF = "BinaryMapPaletteF",
    SingleColorGradientDenim = "SingleColorGradientDenim",
    SingleColorGradientTeal = "SingleColorGradientTeal",
    SingleColorGradientPurple = "SingleColorGradientPurple",
    SingleColorGradientDustyCoral = "SingleColorGradientDustyCoral",
    SingleColorGradientDarkCopper = "SingleColorGradientDarkCopper",
}

export enum MapRegionName {
    World = "World",
    Africa = "Africa",
    NorthAmerica = "NorthAmerica",
    SouthAmerica = "SouthAmerica",
    Asia = "Asia",
    Europe = "Europe",
    Oceania = "Oceania",
}

// 'World' doesn't make sense as a region for the globe
export type GlobeRegionName = Exclude<MapRegionName, MapRegionName.World>

export interface GlobeConfig {
    isActive: boolean
    rotation: [number, number]
    zoom: number
    focusCountry?: EntityName
}

export enum DumbbellConnectorStyle {
    Arrow = "arrow",
    Line = "line",
}

export enum DumbbellValueLabelMode {
    Absolute = "absolute",
    Change = "change",
    PercentChange = "percentChange",
    None = "none",
}

export interface DumbbellTrendColorMap {
    /** Color for dumbbells whose value increased over time */
    increase?: Color
    /** Color for dumbbells whose value decreased over time */
    decrease?: Color
}

export interface DumbbellChartConfigInterface {
    connectorStyle?: DumbbellConnectorStyle
    valueLabelMode?: DumbbellValueLabelMode
    /** Custom colors for the time-range encoding */
    trendColorMap?: DumbbellTrendColorMap
}

export interface MapConfigInterface {
    columnSlug?: ColumnSlug
    time?: TimeBound | TimeBoundValueStr
    startTime?: TimeBound | TimeBoundValueStr
    timeTolerance?: number
    toleranceStrategy?: ToleranceStrategy
    hideTimeline?: boolean
    region?: MapRegionName
    globe?: GlobeConfig
    colorScale?: Partial<ColorScaleConfigInterface>
    tooltipUseCustomLabels?: boolean
    selectedEntityNames?: EntityName[]
}

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherInterface extends SortConfig {
    $schema?: string
    chartTypes?: GrapherChartType[]
    id?: number
    version?: number
    slug?: string
    title?: string
    subtitle?: string
    sourceDesc?: string
    note?: string
    hideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    minTime?: TimeBound | TimeBoundValueStr
    maxTime?: TimeBound | TimeBoundValueStr
    timelineMinTime?: Time | TimeBoundValueStr
    timelineMaxTime?: Time | TimeBoundValueStr
    dimensions?: OwidChartDimensionInterface[]
    addCountryMode?: EntitySelectionMode
    comparisonLines?: ComparisonLineConfig[]
    stackMode?: StackMode

    showNoDataArea?: boolean
    hideSeriesLabels?: boolean
    logo?: LogoOption
    hideLogo?: boolean
    hideRelativeToggle?: boolean
    entityType?: string
    entityTypePlural?: string
    hideTimeline?: boolean
    zoomToSelection?: boolean
    showYearLabels?: boolean // Always show year in labels for bar charts
    hasMapTab?: boolean
    tab?: GrapherTabConfigOption
    relatedQuestions?: RelatedQuestionsConfig[]
    details?: DetailDictionary
    internalNotes?: string
    variantName?: string
    originUrl?: string
    license?: LicenseOption
    isPublished?: boolean
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    hideScatterLabels?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: boolean
    matchingEntitiesOnly?: boolean
    hideTotalValueLabel?: boolean
    excludedEntityNames?: EntityName[]
    includedEntityNames?: EntityName[]
    selectedEntityNames?: EntityName[]
    selectedEntityColors?: { [entityName: string]: string | undefined }
    focusedSeriesNames?: SeriesName[]
    peerCountryStrategy?: PeerCountryStrategy
    missingDataStrategy?: MissingDataStrategy
    hideFacetControl?: boolean
    facettingLabelByYVariables?: string
    selectedFacetStrategy?: FacetStrategy

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigInterface>
    dumbbell?: Partial<DumbbellChartConfigInterface>

    // When we move graphers to Git, and remove dimensions, we can clean this up.
    ySlugs?: ColumnSlugs
    xSlug?: ColumnSlug
    sizeSlug?: ColumnSlug
    colorSlug?: ColumnSlug
    tableSlugs?: ColumnSlugs
}

export interface LegacyGrapherInterface extends GrapherInterface {
    data: any
}

// This is intentionally a `type` and not an `interface`, because the TS semantics make it so that this here can be assigned to a `Record<string, string>`.
// See https://stackoverflow.com/q/64970414
export type GrapherQueryParams = {
    country?: string
    focus?: string
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    xScale?: string
    yScale?: string
    time?: string
    region?: string
    endpointsOnly?: string
    facet?: string
    uniformYAxis?: string
    showSelectionOnlyInTable?: string
    showNoDataArea?: string
    globe?: string
    globeRotation?: string
    globeZoom?: string
    mapSelect?: string
    tableFilter?: string
    tableSearch?: string
    peerCountries?: string
}

export type LegacyGrapherQueryParams = GrapherQueryParams & {
    year?: string
}

export type DownloadRewriteTarget =
    | "download-full-data"
    | "download-filtered-data"
    | "api-csv"
    | "api-metadata"
    | "api-example-excel"
    | "api-example-python"
    | "api-example-r"
    | "api-example-stata"

// We don't use this anywhere, but this is a way to ensure that we have an object with all keys present
// ... so GRAPHER_QUERY_PARAM_KEYS below is guaranteed to have all keys of LegacyGrapherQueryParams
const GRAPHER_ALL_QUERY_PARAMS: Required<LegacyGrapherQueryParams> = {
    country: "",
    focus: "",
    tab: "",
    overlay: "",
    stackMode: "",
    zoomToSelection: "",
    xScale: "",
    yScale: "",
    time: "",
    region: "",
    endpointsOnly: "",
    facet: "",
    uniformYAxis: "",
    showSelectionOnlyInTable: "",
    showNoDataArea: "",
    year: "",
    globe: "",
    globeRotation: "",
    globeZoom: "",
    mapSelect: "",
    tableFilter: "",
    tableSearch: "",
    peerCountries: "",
}

export const GRAPHER_QUERY_PARAM_KEYS = Object.keys(
    GRAPHER_ALL_QUERY_PARAMS
) as (keyof LegacyGrapherQueryParams)[]

// Another approach we may want to try is this: https://github.com/mobxjs/serializr
export const grapherKeysToSerialize = [
    "$schema",
    "chartTypes",
    "id",
    "version",
    "slug",
    "title",
    "subtitle",
    "sourceDesc",
    "note",
    "hideAnnotationFieldsInTitle",
    "minTime",
    "maxTime",
    "timelineMinTime",
    "timelineMaxTime",
    "addCountryMode",
    "stackMode",
    "showNoDataArea",
    "hideSeriesLabels",
    "logo",
    "hideLogo",
    "hideRelativeToggle",
    "entityType",
    "entityTypePlural",
    "facettingLabelByYVariables",
    "hideTimeline",
    "zoomToSelection",
    "showYearLabels",
    "hasMapTab",
    "tab",
    "internalNotes",
    "variantName",
    "originUrl",
    "license",
    "isPublished",
    "baseColorScheme",
    "invertColorScheme",
    "hideConnectedScatterLines",
    "hideScatterLabels",
    "scatterPointLabelStrategy",
    "compareEndPointsOnly",
    "matchingEntitiesOnly",
    "hideTotalValueLabel",
    "xAxis",
    "yAxis",
    "colorScale",
    "map",
    "dimensions",
    "selectedEntityNames",
    "selectedEntityColors",
    "focusedSeriesNames",
    "sortBy",
    "sortOrder",
    "sortColumnSlug",
    "excludedEntityNames",
    "includedEntityNames",
    "selectedFacetStrategy",
    "hideFacetControl",
    "comparisonLines",
    "relatedQuestions",
    "missingDataStrategy",
    "peerCountryStrategy",
    "dumbbell",

    // Internals
    "adminBaseUrl",
    "bakedGrapherURL",
]

export enum GrapherVariant {
    /**
     * Default rendering, with header and footer
     */
    Default = "default",

    /**
     * Default rendering, chart area only
     */
    Uncaptioned = "uncaptioned",

    /**
     * Simplified rendering, suitable for thumbnails.
     * Less noisy visualization, but should be understandable on its own
     */
    Thumbnail = "thumbnail",
}

export interface ChartRedirect {
    id: number
    slug: string
    chartId: number
    targetQueryParam: string | null
}

export enum GrapherWindowType {
    panel = "panel",
    modal = "modal",
    drawer = "drawer",
}

export type GrapherTrendArrowDirection = "up" | "right" | "down"

export type SideWidths = { left: number; right: number }

/** Function type for loading additional indicator data from the catalog */
export type AdditionalGrapherDataFetchFn = <K extends CatalogKey>(
    catalogKey: K
) => Promise<CatalogDataForKey<K>>
