import {
    Grammar,
    StringCellDef,
    SlugsDeclarationCellDef,
    IntegerCellDef,
    SlugDeclarationCellDef,
    BooleanCellDef,
    EnumCellDef,
} from "explorer/gridLang/GridLangConstants"
import { ChartTypeName, FacetStrategy } from "grapher/core/GrapherConstants"

export const GrapherGrammar: Grammar = {
    title: {
        ...StringCellDef,
        keyword: "title",
        description: "Chart title",
        placeholder: "Life Expectancy around the world.",
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "Chart subtitle",
        placeholder: "Life Expectancy has risen over time.",
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
} as const
