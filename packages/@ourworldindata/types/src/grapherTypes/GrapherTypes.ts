import {
    OwidChartDimensionInterface,
    OwidVariableRoundingMode,
} from "../OwidVariableDisplayConfigInterface.js"
import { ColumnSlugs, EntityName } from "../domainTypes/CoreTableTypes.js"
import { AxisAlign, Position } from "../domainTypes/Layout.js"
import { Integer } from "../domainTypes/Various.js"
import { DetailDictionary } from "../gdocTypes/Gdoc.js"
import { observable } from "mobx"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_MAP_TYPE,
    GRAPHER_TAB_NAMES,
    GRAPHER_TAB_OPTIONS,
    GRAPHER_TAB_QUERY_PARAMS,
} from "./GrapherConstants.js"

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

// TODO: remove duplicate definition, also available in CoreTable
export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum SortBy {
    custom = "custom",
    entityName = "entityName",
    column = "column",
    total = "total",
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

export interface EntityYearHighlight {
    entityName?: string
    year?: number
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
    keyChartLevel?: KeyChartLevel
}
export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

export interface InteractionState {
    active: boolean // actively hovered or focused
    background: boolean // another series is actively hovered or focused
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

export type SeriesName = string

export type SeriesColorMap = Map<SeriesName, Color>

export type GrapherMapType = typeof GRAPHER_MAP_TYPE
export type GrapherChartType = keyof typeof GRAPHER_CHART_TYPES
export type GrapherChartOrMapType = GrapherChartType | GrapherMapType

export type GrapherTabOption = keyof typeof GRAPHER_TAB_OPTIONS
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

export enum GrapherTooltipAnchor {
    // the tooltip is positioned relative to the mouse cursor
    mouse = "mouse",
    // the tooltip is pinned to the bottom of the screen
    bottom = "bottom",
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
     * Position of the axis label.
     * For vertical axes, 'middle' rotates the label and places it to the left of the axis,
     * 'end' places the label above the axis.
     */
    labelPosition?: AxisAlign

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
     * If given, think of the axis scale as a band scale, where each domain value
     * occupies a fixed width. The axis is padded on both sides to reserve space
     * for the outermost values.
     */
    domainValues?: number[]
}

export interface ComparisonLineConfig {
    label?: string
    yEquals?: string
}

export enum LogoOption {
    owid = "owid",
    "core+owid" = "core+owid",
    "gv+owid" = "gv+owid",
}

export enum BinningStrategy {
    equalInterval = "equalInterval",
    quantiles = "quantiles",
    ckmeans = "ckmeans",
    // The `manual` option is ignored in the algorithms below,
    // but it is stored and handled by the chart.
    manual = "manual",
}

export class ColorScaleConfigDefaults {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    @observable baseColorScheme?: ColorSchemeName

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    @observable colorSchemeInvert?: boolean = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    @observable binningStrategy: BinningStrategy = BinningStrategy.ckmeans
    /** The *suggested* number of bins for the automatic binning algorithm */
    @observable binningStrategyBinCount?: number

    /** The minimum bracket of the first bin */
    @observable customNumericMinValue?: number
    /** Custom maximum brackets for each numeric bin. Only applied when strategy is `manual`. */
    @observable customNumericValues: number[] = []
    /**
     * Custom labels for each numeric bin. Only applied when strategy is `manual`.
     * `undefined` or `null` falls back to default label.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericLabels: (string | undefined | null)[] = []

    /** Whether `customNumericColors` are used to override the color scheme. */
    @observable customNumericColorsActive?: boolean = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericColors: (Color | undefined | null)[] = []

    /** Whether the visual scaling for the color legend is disabled. */
    @observable equalSizeBins?: boolean = true

    // Categorical bins
    // ================

    @observable.ref customCategoryColors: {
        [key: string]: string | undefined
    } = {}

    @observable.ref customCategoryLabels: {
        [key: string]: string | undefined
    } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: {
        [key: string]: true | undefined
    } = {}

    // Other
    // =====

    /** A custom legend description. Only used in ScatterPlot legend titles for now. */
    @observable legendDescription?: string = undefined
}

// TODO: It would be nice to replace the type definition below with
// the commented out version below and remove mobx as a depdency on the
// types project - but for some reason the implementation in grapher/src/color/ColorScale.ts
// of the config getter didn't like that change and the drop downs in the admin
// for the base color scheme stopped working. To try again some time.
export type ColorScaleConfigInterface = ColorScaleConfigDefaults

// export interface ColorScaleConfigInterface {
//     baseColorScheme?: ColorSchemeName
//     colorSchemeInvert?: boolean
//     binningStrategy?: BinningStrategy
//     binningStrategyBinCount?: number
//     customNumericMinValue?: number
//     customNumericValues: number[]
//     customNumericLabels: (string | undefined | null)[]
//     customNumericColorsActive?: boolean
//     customNumericColors: (Color | undefined | null)[]
//     equalSizeBins?: boolean
//     customCategoryColors: Record<string, string | undefined>
//     customCategoryLabels: Record<string, string | undefined>
//     customHiddenCategories: Record<string, true | undefined>
//     legendDescription?: string
// }

// export const colorScaleConfigDefaults = {
//     binningStrategy: BinningStrategy.ckmeans,
//     customNumericValues: [],
//     customNumericLabels: [],
//     customNumericColors: [],
//     equalSizeBins: true,
//     customCategoryColors: {},
//     customCategoryLabels: {},
//     customHiddenCategories: {},
// } satisfies ColorScaleConfigInterface

export interface ColorSchemeInterface {
    name: string
    colorSets: Color[][] // Different color sets depending on how many distinct colors you want
    singleColorScale?: boolean
    isDistinct?: boolean
    displayName?: string
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
    OwidEnergy = "OwidEnergy",
    OwidEnergyLines = "OwidEnergyLines",
    OwidDistinctLines = "OwidDistinctLines",
    BinaryMapPaletteA = "BinaryMapPaletteA",
    BinaryMapPaletteB = "BinaryMapPaletteB",
    BinaryMapPaletteC = "BinaryMapPaletteC",
    BinaryMapPaletteD = "BinaryMapPaletteD",
    BinaryMapPaletteE = "BinaryMapPaletteE",
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

export interface MapConfigInterface {
    columnSlug?: ColumnSlug
    time?: Time | TimeBoundValueStr
    timeTolerance?: number
    toleranceStrategy?: ToleranceStrategy
    hideTimeline?: boolean
    region?: MapRegionName
    colorScale?: Partial<ColorScaleConfigInterface>
    tooltipUseCustomLabels?: boolean
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
    hideLegend?: boolean
    logo?: LogoOption
    hideLogo?: boolean
    hideRelativeToggle?: boolean
    entityType?: string
    entityTypePlural?: string
    hideTimeline?: boolean
    zoomToSelection?: boolean
    showYearLabels?: boolean // Always show year in labels for bar charts
    hasMapTab?: boolean
    tab?: GrapherTabOption
    relatedQuestions?: RelatedQuestionsConfig[]
    details?: DetailDictionary
    internalNotes?: string
    variantName?: string
    originUrl?: string
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
    missingDataStrategy?: MissingDataStrategy
    hideFacetControl?: boolean
    facettingLabelByYVariables?: string
    selectedFacetStrategy?: FacetStrategy

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigInterface>

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
    mapCountry?: string
}

export type LegacyGrapherQueryParams = GrapherQueryParams & {
    year?: string
}

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
    mapCountry: "",
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
    "hideLegend",
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

    // internals
    "adminBaseUrl",
    "bakedGrapherURL",
    "dataApiUrl",
]

export enum GrapherStaticFormat {
    landscape = "landscape",
    square = "square",
}

export interface ChartRedirect {
    id: number
    slug: string
    chartId: number
}

export enum GrapherWindowType {
    panel = "panel",
    modal = "modal",
    drawer = "drawer",
}
