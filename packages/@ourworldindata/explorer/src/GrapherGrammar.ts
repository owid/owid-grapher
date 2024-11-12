import {
    ChartTypeName,
    ColorSchemeName,
    FacetAxisDomain,
    FacetStrategy,
    GrapherTabOption,
    MissingDataStrategy,
    StackMode,
} from "@ourworldindata/types"
import { SortBy, SortOrder } from "@ourworldindata/utils"
import {
    GridBoolean,
    BooleanCellDef,
    CellDef,
    EnumCellDef,
    Grammar,
    IntegerCellDef,
    NumericOrAutoCellDef,
    SlugDeclarationCellDef,
    SlugsDeclarationCellDef,
    StringCellDef,
    UrlCellDef,
    IndicatorIdsOrEtlPathsCellDef,
    IndicatorIdOrEtlPathCellDef,
    GrapherCellDef,
} from "./gridLang/GridLangConstants.js"
import { allChartTypesDisabled } from "@ourworldindata/grapher"

const toTerminalOptions = (keywords: string[]): CellDef[] => {
    return keywords.map((keyword) => ({
        keyword,
        cssClass: "",
        description: "",
    }))
}

export const GrapherGrammar: Grammar<GrapherCellDef> = {
    title: {
        ...StringCellDef,
        keyword: "title",
        description: "Chart title",
        valuePlaceholder: "Life Expectancy around the world.",
        toGrapherObject: (value) => ({ title: value }),
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "Chart subtitle",
        valuePlaceholder: "Life Expectancy has risen over time.",
        toGrapherObject: (value) => ({ subtitle: value }),
    },
    ySlugs: {
        ...SlugsDeclarationCellDef,
        description: "ColumnSlug(s) for the yAxis",
        keyword: "ySlugs",
        toGrapherObject: (value) => ({ ySlugs: value }),
    },
    yVariableIds: {
        ...IndicatorIdsOrEtlPathsCellDef,
        keyword: "yVariableIds",
        description: "Variable ID(s) or ETL path(s) for the yAxis",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    type: {
        ...StringCellDef,
        keyword: "type",
        description: `The type of chart to show such as LineChart or ScatterPlot.`,
        terminalOptions: toTerminalOptions(Object.values(ChartTypeName)),
        toGrapherObject: (value) => ({ availableTabs: { [value]: true } }),
    },
    grapherId: {
        ...IntegerCellDef,
        description: "ID of a legacy Grapher to load",
        keyword: "grapherId",
        toGrapherObject: (value) => ({ id: value }),
    },
    tableSlug: {
        ...SlugDeclarationCellDef,
        description:
            "Slug of the explorer table (i.e. csv file) to use for this row. All variables used in this row must be present in the table/file.",
        keyword: "tableSlug",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    hasMapTab: {
        ...BooleanCellDef,
        keyword: "hasMapTab",
        description: "Show the map tab?",
        toGrapherObject: (value) => ({
            availableTabs: { [ChartTypeName.WorldMap]: value },
        }),
    },
    tab: {
        ...EnumCellDef,
        keyword: "tab",
        description: "Which tab to show by default",
        terminalOptions: toTerminalOptions(Object.values(GrapherTabOption)),
        toGrapherObject: (value) => ({ tab: value }),
    },
    hasChartTab: {
        ...BooleanCellDef,
        keyword: "hasChartTab",
        description: "Show the chart tab?",
        // overwrites the given chart type if provided
        toGrapherObject: (value) => ({ availableTabs: allChartTypesDisabled }),
    },
    xSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the xAxis",
        keyword: "xSlug",
        toGrapherObject: (value) => ({ xSlug: value }),
    },
    xVariableId: {
        ...IndicatorIdOrEtlPathCellDef,
        keyword: "xVariableId",
        description: "Variable ID or ETL path for the xAxis",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    colorSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the color",
        keyword: "colorSlug",
        toGrapherObject: (value) => ({ colorSlug: value }),
    },
    colorVariableId: {
        ...IndicatorIdOrEtlPathCellDef,
        keyword: "colorVariableId",
        description: "Variable ID or ETL path for the color",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    sizeSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the size of points on scatters",
        keyword: "sizeSlug",
        toGrapherObject: (value) => ({ sizeSlug: value }),
    },
    sizeVariableId: {
        ...IndicatorIdOrEtlPathCellDef,
        keyword: "sizeVariableId",
        description:
            "Variable ID or ETL path for the size of points on scatters",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    tableSlugs: {
        ...SlugsDeclarationCellDef,
        description:
            "Columns to show in the Table tab of the chart. If not specified all active slugs will be used.",
        keyword: "tableSlugs",
        toGrapherObject: (value) => ({ tableSlugs: value }),
    },
    sourceDesc: {
        ...StringCellDef,
        keyword: "sourceDesc",
        description: "Short comma-separated list of source names",
        toGrapherObject: (value) => ({ sourceDesc: value }),
    },
    hideAnnotationFieldsInTitle: {
        ...BooleanCellDef,
        description: "Hide automatic time/entity",
        keyword: "hideAnnotationFieldsInTitle",
        parse: (value: any) => {
            const parsedValue = value === GridBoolean.true
            return {
                entity: parsedValue,
                time: parsedValue,
                changeInPrefix: parsedValue,
            }
        },
        toGrapherObject: (value) => ({
            hideAnnotationFieldsInTitle: {
                entity: value,
                time: value,
                changeInPrefix: value,
            },
        }),
    },
    yScaleToggle: {
        ...BooleanCellDef,
        keyword: "yScaleToggle",
        description: "Set to 'true' if the user can change the yAxis",
        toGrapherObject: (value) => ({ yAxis: { canChangeScaleType: value } }),
    },
    yAxisMin: {
        ...NumericOrAutoCellDef,
        keyword: "yAxisMin",
        description: "Set the minimum value for the yAxis",
        toGrapherObject: (value) => ({ yAxis: { min: value } }),
    },
    facetYDomain: {
        ...EnumCellDef,
        keyword: "facetYDomain",
        description:
            "Whether facets axes default to shared or independent domain",
        terminalOptions: toTerminalOptions(Object.values(FacetAxisDomain)),
        toGrapherObject: (value) => ({ yAxis: { facetDomain: value } }),
    },
    selectedFacetStrategy: {
        ...EnumCellDef,
        keyword: "selectedFacetStrategy",
        description: "Whether the chart should be faceted or not",
        terminalOptions: toTerminalOptions(Object.values(FacetStrategy)),
        toGrapherObject: (value) => ({ selectedFacetStrategy: value }),
    },
    entityType: {
        ...StringCellDef,
        keyword: "entityType",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
        toGrapherObject: (value) => ({ entityType: value }),
    },
    baseColorScheme: {
        ...EnumCellDef,
        keyword: "baseColorScheme",
        description:
            "The default color scheme if no color overrides are specified",
        terminalOptions: toTerminalOptions(Object.keys(ColorSchemeName)),
        toGrapherObject: (value) => ({ baseColorScheme: value }),
    },
    note: {
        ...StringCellDef,
        keyword: "note",
        description: "Chart footnote",
        toGrapherObject: (value) => ({ note: value }),
    },
    sortBy: {
        ...EnumCellDef,
        keyword: "sortBy",
        description: "Specify what to sort the entities by",
        terminalOptions: toTerminalOptions(Object.values(SortBy)),
        toGrapherObject: (value) => ({ sortBy: value }),
    },
    sortOrder: {
        ...EnumCellDef,
        keyword: "sortOrder",
        description: "Whether to sort entities ascending or descending",
        terminalOptions: toTerminalOptions(Object.values(SortOrder)),
        toGrapherObject: (value) => ({ sortOrder: value }),
    },
    sortColumnSlug: {
        ...SlugDeclarationCellDef,
        keyword: "sortColumnSlug",
        description:
            "This setting is only respected when `sortBy` is set to `column`",
        toGrapherObject: (value) => ({ sortColumnSlug: value }),
    },
    stackMode: {
        ...EnumCellDef,
        keyword: "stackMode",
        description:
            "Show chart in absolute (default) or relative mode. Only works for some chart types.",
        terminalOptions: toTerminalOptions(Object.values(StackMode)),
        toGrapherObject: (value) => ({ stackMode: value }),
    },
    hideTotalValueLabel: {
        ...BooleanCellDef,
        keyword: "hideTotalValueLabel",
        description:
            "Hide the total value that is normally displayed to the right of the bars in a stacked bar chart.",
        toGrapherObject: (value) => ({ hideTotalValueLabel: value }),
    },
    hideRelativeToggle: {
        ...BooleanCellDef,
        keyword: "hideRelativeToggle",
        description: "Whether to hide the relative mode UI toggle",
        toGrapherObject: (value) => ({ hideRelativeToggle: value }),
    },
    timelineMinTime: {
        ...IntegerCellDef,
        keyword: "timelineMinTime",
        description:
            "Set the minimum time for the timeline. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
        toGrapherObject: (value) => ({ timelineMinTime: value }),
    },
    timelineMaxTime: {
        ...IntegerCellDef,
        keyword: "timelineMaxTime",
        description:
            "Set the maximum time for the timeline. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
        toGrapherObject: (value) => ({ timelineMaxTime: value }),
    },
    defaultView: {
        ...BooleanCellDef,
        keyword: "defaultView",
        description: "Whether this view is used as the default view.",
        toGrapherObject: () => ({}), // explorer-specific, not used in grapher config
    },
    relatedQuestionText: {
        ...StringCellDef,
        keyword: "relatedQuestionText",
        description:
            "The text used for the related question (at the very bottom of the chart)",
        toGrapherObject: (value) => ({ relatedQuestion: { text: value } }),
    },
    relatedQuestionUrl: {
        ...UrlCellDef,
        keyword: "relatedQuestionUrl",
        description: "The link of the related question text",
        toGrapherObject: (value) => ({ relatedQuestion: { url: value } }),
    },
    mapTargetTime: {
        ...IntegerCellDef,
        keyword: "mapTargetTime",
        description:
            "Set the 'target time' for the map chart. This is the year that will be shown by default in the map chart.",
        toGrapherObject: (value) => ({ map: { time: value } }),
    },
    missingDataStrategy: {
        ...EnumCellDef,
        keyword: "missingDataStrategy",
        description:
            "Hide or show entities for which one or more variables are missing",
        terminalOptions: toTerminalOptions(Object.values(MissingDataStrategy)),
        toGrapherObject: (value) => ({ missingDataStrategy: value }),
    },
    minTime: {
        ...IntegerCellDef,
        keyword: "minTime",
        description: "Start point of the initially selected time span",
        toGrapherObject: (value) => ({ minTime: value }),
    },
    maxTime: {
        ...IntegerCellDef,
        keyword: "maxTime",
        description: "End point of the initially selected time span",
        toGrapherObject: (value) => ({ maxTime: value }),
    },
} as const
