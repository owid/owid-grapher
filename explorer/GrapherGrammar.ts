import {
    Grammar,
    StringCellDef,
    SlugsDeclarationCellDef,
    IntegerCellDef,
    SlugDeclarationCellDef,
    BooleanCellDef,
    EnumCellDef,
    NumericCellDef,
    JSONObjectCellDef,
} from "../gridLang/GridLangConstants"
import {
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
    GrapherTabOption,
} from "../grapher/core/GrapherConstants"
import { ColorSchemes } from "../grapher/color/ColorSchemes"
import { SortBy, SortOrder } from "../clientUtils/owidTypes"

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
        terminalOptions: Object.values(ChartTypeName).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
        terminalOptions: Object.values(GrapherTabOption).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
        terminalOptions: Object.values(FacetStrategy).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
        terminalOptions: Object.keys(FacetAxisDomain).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
    },
    baseColorScheme: {
        ...EnumCellDef,
        keyword: "baseColorScheme",
        description:
            "The default color scheme if no color overrides are specified",
        terminalOptions: Object.keys(ColorSchemes).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
        terminalOptions: Object.keys(SortBy).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
    },
    sortOrder: {
        ...EnumCellDef,
        keyword: "sortOrder",
        description: "Whether to sort entities ascending or descending",
        terminalOptions: Object.keys(SortOrder).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
    },
    sortColumnSlug: {
        ...EnumCellDef,
        keyword: "sortColumnSlug",
        description:
            "This setting is only respected when `sortBy` is set to `column`",
    },
} as const
