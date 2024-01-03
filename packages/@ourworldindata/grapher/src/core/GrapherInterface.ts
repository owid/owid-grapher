import {
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    EntitySelectionMode,
    ChartTypeName,
    FacetStrategy,
    MissingDataStrategy,
    AnnotationFieldsInTitle,
} from "./GrapherConstants"
import { AxisConfigInterface } from "../axis/AxisConfigInterface"
import {
    TimeBound,
    QueryParams,
    OwidChartDimensionInterface,
    ColumnSlug,
    SortConfig,
    TopicId,
    DetailDictionary,
} from "@ourworldindata/utils"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine"
import { LogoOption } from "../captionedChart/Logos"
import { ColorScaleConfigInterface } from "../color/ColorScaleConfig"
import { MapConfigInterface } from "../mapCharts/MapConfig"
import { ColumnSlugs, Time, EntityName } from "@ourworldindata/core-table"
import { ColorSchemeName } from "../color/ColorConstants"

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherInterface extends SortConfig {
    $schema?: string
    type?: ChartTypeName
    id?: number
    version?: number
    slug?: string
    title?: string
    subtitle?: string
    sourceDesc?: string
    note?: string
    hideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    minTime?: TimeBound
    maxTime?: TimeBound
    timelineMinTime?: Time
    timelineMaxTime?: Time
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
    hasChartTab?: boolean
    hasMapTab?: boolean
    tab?: GrapherTabOption
    relatedQuestions?: RelatedQuestionsConfig[]
    details?: DetailDictionary
    internalNotes?: string
    variantName?: string
    originUrl?: string
    topicIds?: TopicId[]
    isPublished?: boolean
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    hideLinesOutsideTolerance?: boolean
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    hideScatterLabels?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: boolean
    matchingEntitiesOnly?: boolean
    hideTotalValueLabel?: boolean
    excludedEntities?: number[]
    includedEntities?: number[]
    selectedEntityNames?: EntityName[]
    selectedEntityColors?: { [entityName: string]: string | undefined }
    facet?: FacetStrategy
    missingDataStrategy?: MissingDataStrategy
    hideFacetControl?: boolean

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigInterface>

    // When we move graphers to Git, and remove dimensions, we can clean this up.
    ySlugs?: ColumnSlugs
    xSlug?: ColumnSlug
    sizeSlug?: ColumnSlug
    colorSlug?: ColumnSlug
}

export interface LegacyGrapherInterface extends GrapherInterface {
    data: any
}

export interface GrapherQueryParams extends QueryParams {
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    xScale?: string
    yScale?: string
    time?: string
    region?: string
    shown?: string
    endpointsOnly?: string
    selection?: string
    facet?: string
    uniformYAxis?: string
    showSelectionOnlyInTable?: string
    showNoDataArea?: string
}

export interface LegacyGrapherQueryParams extends GrapherQueryParams {
    year?: string
    country?: string // deprecated
}

// Another approach we may want to try is this: https://github.com/mobxjs/serializr
export const grapherKeysToSerialize = [
    "$schema",
    "type",
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
    "hasChartTab",
    "hasMapTab",
    "tab",
    "internalNotes",
    "variantName",
    "originUrl",
    "isPublished",
    "baseColorScheme",
    "invertColorScheme",
    "hideLinesOutsideTolerance",
    "hideConnectedScatterLines",
    "hideScatterLabels",
    "scatterPointLabelStrategy",
    "compareEndPointsOnly",
    "matchingEntitiesOnly",
    "includedEntities",
    "hideTotalValueLabel",
    "xAxis",
    "yAxis",
    "colorScale",
    "map",
    "dimensions",
    "selectedEntityNames",
    "selectedEntityColors",
    "sortBy",
    "sortOrder",
    "sortColumnSlug",
    "excludedEntities",
    "selectedFacetStrategy",
    "hideFacetControl",
    "comparisonLines",
    "relatedQuestions",
    "topicIds",
    "details",
    "adminBaseUrl",
    "bakedGrapherURL",
    "missingDataStrategy",
    "dataApiUrl",
]
