import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { AvailableTransforms } from "coreTable/Transforms"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import {
    CellDef,
    BooleanCellDef,
    SlugDeclarationCellDef,
    StringCellDef,
    UrlCellDef,
    SubTableHeaderCellDef,
    IntegerCellDef,
    SlugsDeclarationCellDef,
    KeywordMap,
    QueryStringCellDef,
    RootKeywordCellDef,
    EnumCellDef,
    StringDeclarationDef,
} from "explorer/gridLang/GridLangConstants"
import { OwidDatasets } from "./OwidDatasets"

export const GrapherSubTableHeaderKeywordMap: KeywordMap = {
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
        description: `The type of chart to show. Options are ${Object.values(
            ChartTypeName
        ).join(", ")}`,
        options: Object.values(ChartTypeName),
    },
    grapherId: {
        ...IntegerCellDef,
        description: "ID of the Grapher to load",
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

export const ColumnsSubTableHeaderKeywordMap: KeywordMap = {
    slug: {
        ...SlugDeclarationCellDef,
        keyword: "slug",
    },
    name: {
        ...StringCellDef,
        keyword: "name",
        description:
            "This is the name that may appear on the y or x axis of a chart",
    },
    type: {
        ...StringCellDef,
        keyword: "type",
        description: `One of ${Object.keys(ColumnTypeNames).join(", ")}`,
        options: Object.values(ColumnTypeNames),
    },
    transform: {
        ...StringCellDef,
        keyword: "transform",
        description: `An advanced option. Available transforms are: ${AvailableTransforms.join(
            ", "
        )}`,
    },
    description: {
        ...StringCellDef,
        keyword: "description",
        description: "Describe the column",
    },
    unit: {
        ...StringCellDef,
        keyword: "unit",
        description: "Unit of measurement",
    },
    shortUnit: {
        ...StringCellDef,
        keyword: "shortUnit",
        description: "Short (axis) unit",
    },
    notes: {
        ...StringCellDef,
        keyword: "notes",
        description: "Any internal notes.",
    },
    annotationsColumnSlug: {
        ...StringCellDef,
        keyword: "annotationsColumnSlug",
        description:
            "Column that contains the annotations for this column, if any.",
    },
    sourceName: {
        ...StringCellDef,
        keyword: "sourceName",
        description:
            "Source name displayed on charts using this dataset. For academic papers, the name of the source should be 'Authors (year)' e.g. Arroyo-Abad and Lindert (2016). For institutional projects or reports, the name should be 'Institution, Project (year or vintage)' e.g. U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). For data that we have modified extensively, the name should be 'Our World in Data based on Author (year)' e.g. Our World in Data based on Atkinson (2002) and Sen (2000).",
    },
    sourceLink: {
        ...UrlCellDef,
        keyword: "sourceName",
        description:
            "Link to the publication from which we retrieved this data",
    },
    dataPublishedBy: {
        ...StringCellDef,
        keyword: "dataPublishedBy",
        description:
            "For academic papers this should be a complete reference. For institutional projects, detail the project or report. For data we have modified extensively, list OWID as the publishers and provide the name of the person in charge of the calculation.",
    },
    dataPublisherSource: {
        ...StringCellDef,
        keyword: "dataPublisherSource",
        description:
            "Basic indication of how the publisher collected this data e.g. surveys data. Anything longer than a line should go in the dataset description.",
    },
    retrievedDate: {
        ...StringCellDef,
        keyword: "retrievedDate",
        description: "Date when this data was obtained by us",
    },
    additionalInfo: {
        ...StringCellDef,
        keyword: "additionalInfo",
        description:
            "Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like.",
    },
} as const

const ExplorerFormControlCellDeff: CellDef = {
    ...StringDeclarationDef,
    description: "A form input for the user.",
    regex: /^.+ (Dropdown|Radio|Checkbox)$/,
    requirements: `Must end with 'Dropdown', 'Radio', or 'Checkbox'`,
}

export const ExplorerRootKeywordMap: KeywordMap = {
    table: {
        ...UrlCellDef,
        keyword: "table",
        options: OwidDatasets,
        placeholder:
            'http://example.com/data.csv" or "Tax Revenue - World Bank',
        description: "A link to a CSV or TSV or the name of an OWID dataset.",
        rest: [
            {
                ...SlugDeclarationCellDef,
                placeholder: "life_expectancy_dataset",
                description:
                    "If you have multiple tables, give each one a unique slug.",
            },
        ],
        headerCellDef: {
            ...SlugDeclarationCellDef,
            cssClass: "SubTableHeaderCellDef",
            keywordMap: {},
            catchAllKeyword: {
                ...SlugDeclarationCellDef,
                description: "A column slug.",
            },
        },
    },
    explorerTitle: {
        ...StringCellDef,
        keyword: "explorerTitle",
        placeholder: "Life Expectancy Data Explorer",
        description:
            "The title will appear in the top left corner of the Explorer.",
    },
    explorerSubtitle: {
        ...StringCellDef,
        keyword: "explorerSubtitle",
        placeholder: "All our data from various sources.",
        description: "The subtitle will appear under the explorerTitle.",
    },
    columns: {
        ...SlugDeclarationCellDef,
        placeholder: "life_expectancy_dataset",
        headerCellDef: {
            ...SubTableHeaderCellDef,
            keywordMap: ColumnsSubTableHeaderKeywordMap,
        },
        keyword: "columns",
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (sometimes times incorrectly).",
    },
    graphers: {
        ...SlugDeclarationCellDef,
        keyword: "graphers",
        description: "The decision matrix for your Explorer goes here.",
        headerCellDef: {
            ...SubTableHeaderCellDef,
            keywordMap: GrapherSubTableHeaderKeywordMap,
            catchAllKeyword: ExplorerFormControlCellDeff,
        },
    },
    googleSheet: {
        ...UrlCellDef,
        keyword: "googleSheet",
        placeholder: "https://docs.google.com/spreadsheets/d/1qeX...",
        description:
            "Create a Google Sheet, share it with the OWID Group, then put the link here.",
    },
    defaultView: {
        ...QueryStringCellDef,
        keyword: "defaultView",
        placeholder: "selection=Canada",
        description:
            "Use the Explorer, then copy the part of the url starting with ? here.",
    },
    isPublished: {
        ...BooleanCellDef,
        keyword: "isPublished",
        description: "Set to true to make this Explorer public.",
    },
    wpBlockId: {
        ...IntegerCellDef,
        keyword: "wpBlockId",
        description:
            "If present will show the matching Wordpress block ID beneath the Explorer.",
    },
    hideControls: {
        ...BooleanCellDef,
        keyword: "hideControls",
        description: "Whether to hide the controls. Default is false.",
    },
    subNavId: {
        ...EnumCellDef,
        options: Object.values(SubNavId),
        keyword: "subNavId",
        description: "A subnav to show, if any.",
    },
    subNavCurrentId: {
        // todo: add options here
        ...EnumCellDef,
        keyword: "subNavCurrentId",
        description: "The current page in the subnav.",
    },
    thumbnail: {
        ...UrlCellDef,
        keyword: "thumbnail",
        description: "URL to the social sharing thumbnail.",
    },
    entityType: {
        ...StringCellDef,
        keyword: "entityType",
        placeholder: "region",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
    },
    pickerColumnSlugs: {
        ...SlugsDeclarationCellDef,
        keyword: "pickerColumnSlugs",
        placeholder: "gdp population gdp_per_capita",
        description:
            "You can manually set the column slug(s) to show in the entity picker or else they will be automatically chosen.",
    },
    hideAlertBanner: {
        ...BooleanCellDef,
        keyword: "hideAlertBanner",
        description: "Set to true to hide the Covid alert banner.",
    },
    ...GrapherSubTableHeaderKeywordMap,
} as const

export const ExplorerGrammar: CellDef = {
    ...RootKeywordCellDef,
    keywordMap: ExplorerRootKeywordMap,
}
