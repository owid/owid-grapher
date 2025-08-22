import {
    ALL_GRAPHER_CHART_TYPES,
    ColorSchemeName,
    FacetAxisDomain,
    FacetStrategy,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GrapherChartType,
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
import * as R from "remeda"
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
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ title: parsedValue }),
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "Chart subtitle",
        valuePlaceholder: "Life Expectancy has risen over time.",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ subtitle: parsedValue }),
    },
    ySlugs: {
        ...SlugsDeclarationCellDef,
        description: "ColumnSlug(s) for the yAxis",
        keyword: "ySlugs",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ ySlugs: parsedValue }),
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
        description: `The type of chart to show such as LineChart or ScatterPlot. If set to None, then the chart tab is hidden.`,
        terminalOptions: toTerminalOptions([
            ...ALL_GRAPHER_CHART_TYPES,
            `${GRAPHER_CHART_TYPES.LineChart} ${GRAPHER_CHART_TYPES.SlopeChart}`,
            `${GRAPHER_CHART_TYPES.LineChart} ${GRAPHER_CHART_TYPES.DiscreteBar}`,
            `${GRAPHER_CHART_TYPES.SlopeChart} ${GRAPHER_CHART_TYPES.DiscreteBar}`,
            `${GRAPHER_CHART_TYPES.LineChart} ${GRAPHER_CHART_TYPES.SlopeChart} ${GRAPHER_CHART_TYPES.DiscreteBar}`,
            "None",
        ]),
        toGrapherObject: (parsedValue) => {
            if (parsedValue === "None") return { chartTypes: [] }
            if (parsedValue)
                return {
                    chartTypes: parsedValue.split(" ") as GrapherChartType[],
                }
            return {}
        },
    },
    grapherId: {
        ...IntegerCellDef,
        description: "ID of a legacy Grapher to load",
        keyword: "grapherId",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ id: parsedValue }),
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
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ hasMapTab: parsedValue }),
    },
    tab: {
        ...EnumCellDef,
        keyword: "tab",
        description: "Which tab to show by default",
        terminalOptions: toTerminalOptions(
            Object.values(GRAPHER_TAB_CONFIG_OPTIONS)
        ),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ tab: parsedValue }),
    },
    xSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the xAxis",
        keyword: "xSlug",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ xSlug: parsedValue }),
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
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ colorSlug: parsedValue }),
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
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ sizeSlug: parsedValue }),
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
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ tableSlugs: parsedValue }),
    },
    sourceDesc: {
        ...StringCellDef,
        keyword: "sourceDesc",
        description: "Short comma-separated list of source names",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ sourceDesc: parsedValue }),
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
        toGrapherObject: (parsedValue) => ({
            hideAnnotationFieldsInTitle: parsedValue,
        }),
    },
    yScaleToggle: {
        ...BooleanCellDef,
        keyword: "yScaleToggle",
        description: "Set to 'true' if the user can change the yAxis",
        toGrapherObject: (parsedValue) => ({
            yAxis: omitEmptyStringValues({ canChangeScaleType: parsedValue }),
        }),
    },
    yAxisMin: {
        ...NumericOrAutoCellDef,
        keyword: "yAxisMin",
        description: "Set the minimum parsedValue for the yAxis",
        toGrapherObject: (parsedValue) =>
            omitEmptyObjectValues({
                yAxis: omitEmptyStringValues({ min: parsedValue }),
            }),
    },
    facetYDomain: {
        ...EnumCellDef,
        keyword: "facetYDomain",
        description:
            "Whether facets axes default to shared or independent domain",
        terminalOptions: toTerminalOptions(Object.values(FacetAxisDomain)),
        toGrapherObject: (parsedValue) =>
            omitEmptyObjectValues({
                yAxis: omitEmptyStringValues({ facetDomain: parsedValue }),
            }),
    },
    selectedFacetStrategy: {
        ...EnumCellDef,
        keyword: "selectedFacetStrategy",
        description: "Whether the chart should be faceted or not",
        terminalOptions: toTerminalOptions(Object.values(FacetStrategy)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ selectedFacetStrategy: parsedValue }),
    },
    entityType: {
        ...StringCellDef,
        keyword: "entityType",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ entityType: parsedValue }),
    },
    baseColorScheme: {
        ...EnumCellDef,
        keyword: "baseColorScheme",
        description:
            "The default color scheme if no color overrides are specified",
        terminalOptions: toTerminalOptions(Object.keys(ColorSchemeName)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ baseColorScheme: parsedValue }),
    },
    note: {
        ...StringCellDef,
        keyword: "note",
        description: "Chart footnote",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ note: parsedValue }),
    },
    sortBy: {
        ...EnumCellDef,
        keyword: "sortBy",
        description: "Specify what to sort the entities by",
        terminalOptions: toTerminalOptions(Object.values(SortBy)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ sortBy: parsedValue }),
    },
    sortOrder: {
        ...EnumCellDef,
        keyword: "sortOrder",
        description: "Whether to sort entities ascending or descending",
        terminalOptions: toTerminalOptions(Object.values(SortOrder)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ sortOrder: parsedValue }),
    },
    sortColumnSlug: {
        ...SlugDeclarationCellDef,
        keyword: "sortColumnSlug",
        description:
            "This setting is only respected when `sortBy` is set to `column`",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ sortColumnSlug: parsedValue }),
    },
    stackMode: {
        ...EnumCellDef,
        keyword: "stackMode",
        description:
            "Show chart in absolute (default) or relative mode. Only works for some chart types.",
        terminalOptions: toTerminalOptions(Object.values(StackMode)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ stackMode: parsedValue }),
    },
    hideTotalValueLabel: {
        ...BooleanCellDef,
        keyword: "hideTotalValueLabel",
        description:
            "Hide the total parsedValue that is normally displayed to the right of the bars in a stacked bar chart.",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({
                hideTotalValueLabel: parsedValue,
            }),
    },
    hideRelativeToggle: {
        ...BooleanCellDef,
        keyword: "hideRelativeToggle",
        description: "Whether to hide the relative mode UI toggle",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ hideRelativeToggle: parsedValue }),
    },
    timelineMinTime: {
        ...IntegerCellDef,
        keyword: "timelineMinTime",
        description:
            "Set the minimum time for the timeline. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ timelineMinTime: parsedValue }),
    },
    timelineMaxTime: {
        ...IntegerCellDef,
        keyword: "timelineMaxTime",
        description:
            "Set the maximum time for the timeline. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ timelineMaxTime: parsedValue }),
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
        toGrapherObject: () => ({}), // handled in code (can be done properly once the relatedQuestion field is refactored)
    },
    relatedQuestionUrl: {
        ...UrlCellDef,
        keyword: "relatedQuestionUrl",
        description: "The link of the related question text",
        toGrapherObject: () => ({}), // handled in code (can be done properly once the relatedQuestion field is refactored)
    },
    mapTargetTime: {
        ...IntegerCellDef,
        keyword: "mapTargetTime",
        description:
            "Set the 'target time' for the map chart. This is the year that will be shown by default in the map chart.",
        toGrapherObject: (parsedValue) =>
            omitEmptyObjectValues({
                map: omitEmptyStringValues({ time: parsedValue }),
            }),
    },
    missingDataStrategy: {
        ...EnumCellDef,
        keyword: "missingDataStrategy",
        description:
            "Hide or show entities for which one or more variables are missing",
        terminalOptions: toTerminalOptions(Object.values(MissingDataStrategy)),
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({
                missingDataStrategy: parsedValue,
            }),
    },
    minTime: {
        ...IntegerCellDef,
        keyword: "minTime",
        description: "Start point of the initially selected time span",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ minTime: parsedValue }),
    },
    maxTime: {
        ...IntegerCellDef,
        keyword: "maxTime",
        description: "End point of the initially selected time span",
        toGrapherObject: (parsedValue) =>
            omitEmptyStringValues({ maxTime: parsedValue }),
    },
} as const

export function omitEmptyStringValues<T extends Record<string, any>>(
    obj: T
): Record<string, any> {
    return R.omitBy(obj, (parsedValue) => parsedValue === "")
}

export function omitEmptyObjectValues<T extends Record<string, any>>(
    obj: T
): Record<string, any> {
    return R.omitBy(
        obj,
        (parsedValue) => R.isPlainObject(parsedValue) && R.isEmpty(parsedValue)
    )
}
