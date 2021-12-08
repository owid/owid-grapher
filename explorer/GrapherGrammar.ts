import {
    Grammar,
    StringCellDef,
    SlugsDeclarationCellDef,
    IntegerCellDef,
    SlugDeclarationCellDef,
    BooleanCellDef,
    EnumCellDef,
    NumericCellDef,
    CellDef,
} from "../gridLang/GridLangConstants"
import {
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
    GrapherTabOption,
    StackMode,
} from "../grapher/core/GrapherConstants"
import { ColorSchemes } from "../grapher/color/ColorSchemes"
import { SortBy, SortOrder } from "../clientUtils/owidTypes"

const toTerminalOptions = (keywords: string[]): CellDef[] => {
    return keywords.map((keyword) => ({
        keyword,
        cssClass: "",
        description: "",
    }))
}

export const GrapherGrammar: Grammar = {
    title: {
        ...StringCellDef,
        keyword: "title",
        description: "Chart title",
        valuePlaceholder: "Life Expectancy around the world.",
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "Chart subtitle",
        valuePlaceholder: "Life Expectancy has risen over time.",
    },
    ySlugs: {
        ...SlugsDeclarationCellDef,
        description: "ColumnSlug(s) for the yAxis",
        keyword: "ySlugs",
    },
    type: {
        ...StringCellDef,
        keyword: "type",
        description: `The type of chart to show such as LineChart or ScatterPlot.`,
        terminalOptions: toTerminalOptions(Object.values(ChartTypeName)),
    },
    grapherId: {
        ...IntegerCellDef,
        description: "ID of a legacy Grapher to load",
        keyword: "grapherId",
    },
    tableSlug: {
        ...SlugDeclarationCellDef,
        description: "Slug of the table to use.",
        keyword: "tableSlug",
    },
    hasMapTab: {
        ...BooleanCellDef,
        keyword: "hasMapTab",
        description: "Show the map tab?",
    },
    tab: {
        ...EnumCellDef,
        keyword: "tab",
        description: "Which tab to show by default",
        terminalOptions: toTerminalOptions(Object.values(GrapherTabOption)),
    },
    hasChartTab: {
        ...BooleanCellDef,
        keyword: "hasChartTab",
        description: "Show the chart tab?",
    },
    xSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the xAxis",
        keyword: "xSlug",
    },
    colorSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the color",
        keyword: "colorSlug",
    },
    sizeSlug: {
        ...SlugDeclarationCellDef,
        description: "ColumnSlug for the size of points on scatters",
        keyword: "sizeSlug",
    },
    tableSlugs: {
        ...SlugsDeclarationCellDef,
        description:
            "ColumnSlug(s) for the Table tab. If not specified all active slugs will be used.",
        keyword: "tableSlugs",
    },
    sourceDesc: {
        ...StringCellDef,
        keyword: "sourceDesc",
        description: "Short comma-separated list of source names",
    },
    facet: {
        ...EnumCellDef,
        description: "Facet by column or entities",
        keyword: "facet",
        terminalOptions: toTerminalOptions(Object.values(FacetStrategy)),
    },
    hideTitleAnnotation: {
        ...BooleanCellDef,
        description: "Hide automatic time/entity",
        keyword: "hideTitleAnnotation",
    },
    backgroundSeriesLimit: {
        ...IntegerCellDef,
        description:
            "Set this to limit the number of background series shown on ScatterPlots.",
        keyword: "backgroundSeriesLimit",
    },
    yScaleToggle: {
        ...BooleanCellDef,
        keyword: "yScaleToggle",
        description: "Set to 'true' if the user can change the yAxis",
    },
    yAxisMin: {
        ...NumericCellDef,
        keyword: "yAxisMin",
        description: "Set the minimum value for the yAxis",
    },
    facetYDomain: {
        ...EnumCellDef,
        keyword: "facetYDomain",
        description:
            "Whether facets axes default to shared or independent domain",
        terminalOptions: toTerminalOptions(Object.values(FacetAxisDomain)),
    },
    selectedFacetStrategy: {
        ...EnumCellDef,
        keyword: "selectedFacetStrategy",
        description: "Whether the chart should be faceted or not",
        terminalOptions: toTerminalOptions(Object.values(FacetStrategy)),
    },
    baseColorScheme: {
        ...EnumCellDef,
        keyword: "baseColorScheme",
        description:
            "The default color scheme if no color overrides are specified",
        terminalOptions: toTerminalOptions(Object.keys(ColorSchemes)),
    },
    note: {
        ...StringCellDef,
        keyword: "note",
        description: "Chart footnote",
    },
    sortBy: {
        ...EnumCellDef,
        keyword: "sortBy",
        description: "Specify what to sort the entities by",
        terminalOptions: toTerminalOptions(Object.values(SortBy)),
    },
    sortOrder: {
        ...EnumCellDef,
        keyword: "sortOrder",
        description: "Whether to sort entities ascending or descending",
        terminalOptions: toTerminalOptions(Object.values(SortOrder)),
    },
    sortColumnSlug: {
        ...SlugDeclarationCellDef,
        keyword: "sortColumnSlug",
        description:
            "This setting is only respected when `sortBy` is set to `column`",
    },
    stackMode: {
        ...EnumCellDef,
        keyword: "stackMode",
        description:
            "Show chart in absolute (default) or relative mode. Only works for some chart types.",
        terminalOptions: toTerminalOptions(Object.values(StackMode)),
    },
    hideTotalValueLabel: {
        ...BooleanCellDef,
        keyword: "hideTotalValueLabel",
        description:
            "Hide the total value that is normally displayed to the right of the bars in a stacked bar chart.",
    },
    timelineMinTime: {
        ...NumericCellDef,
        keyword: "timelineMinTime",
        description:
            "Set the minimum time for the timeline. Must be an integer. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
    },
    timelineMaxTime: {
        ...NumericCellDef,
        keyword: "timelineMaxTime",
        description:
            "Set the maximum time for the timeline. Must be an integer. For days, use days since 21 Jan 2020, e.g. 24 Jan 2020 is '3'.",
    },
    defaultView: {
        ...BooleanCellDef,
        keyword: "defaultView",
        description: "Whether this view is used as the default view.",
    },
} as const
