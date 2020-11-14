import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { AvailableTransforms } from "coreTable/Transforms"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import {
    CellTypeDefinition,
    BooleanCellTypeDefinition,
    SlugDeclarationCellTypeDefinition,
    StringCellTypeDefinition,
    UrlCellTypeDefinition,
    SubTableHeaderCellTypeDefinition,
    DelimitedUrlDefinition,
    IntegerCellTypeDefinition,
    SlugsDeclarationCellTypeDefinition,
} from "./GridGrammarConstants"

const SwitcherKeywordMap = {
    chartId: {
        ...IntegerCellTypeDefinition,
        description: "ID of the Grapher to load",
        keyword: "slug",
    },
    title: {
        ...StringCellTypeDefinition,
        keyword: "title",
        description: "Chart title",
    },
    subtitle: {
        ...StringCellTypeDefinition,
        keyword: "subtitle",
        description: "Chart subtitle",
    },
    type: {
        ...StringCellTypeDefinition,
        keyword: "type",
        description: `The type of chart to show. Options are ${Object.values(
            ChartTypeName
        ).join(", ")}`,
        options: Object.values(ChartTypeName),
    },
    hasMapTab: {
        ...BooleanCellTypeDefinition,
        keyword: "hasMapTab",
        description: "Show the map tab?",
    },
    hasChartTab: {
        ...BooleanCellTypeDefinition,
        keyword: "hasChartTab",
        description: "Show the chart tab?",
    },
    ySlugs: {
        ...SlugsDeclarationCellTypeDefinition,
        description: "ColumnSlug(s) for the yAxis",
        keyword: "ySlugs",
    },
    xSlug: {
        ...SlugDeclarationCellTypeDefinition,
        description: "ColumnSlug for the xAxis",
        keyword: "xSlug",
    },
    colorSlug: {
        ...SlugDeclarationCellTypeDefinition,
        description: "ColumnSlug for the color",
        keyword: "colorSlug",
    },
    sizeSlug: {
        ...SlugDeclarationCellTypeDefinition,
        description: "ColumnSlug for the size of points on scatters",
        keyword: "sizeSlug",
    },
    tableSlugs: {
        ...SlugsDeclarationCellTypeDefinition,
        description:
            "ColumnSlug(s) for the Table tab. If not specified all active slugs will be used.",
        keyword: "tableSlugs",
    },
    backgroundSeriesLimit: {
        ...IntegerCellTypeDefinition,
        description:
            "Set this to limit the number of background series shown on ScatterPlots.",
        keyword: "backgroundSeriesLimit",
    },
    table: {
        ...SlugDeclarationCellTypeDefinition,
        description: "Slug of the table to use.",
        keyword: "table",
    },
    yScaleToggle: {
        ...BooleanCellTypeDefinition,
        keyword: "yScaleToggle",
        description: "Set to 'true' if the user can change the yAxis",
    },
} as const

const ColumnsKeywordMap = {
    slug: {
        ...SlugDeclarationCellTypeDefinition,
        keyword: "slug",
    },
    name: {
        ...StringCellTypeDefinition,
        keyword: "name",
        description:
            "This is the name that may appear on the y or x axis of a chart",
    },
    type: {
        ...StringCellTypeDefinition,
        keyword: "type",
        description: `One of ${Object.keys(ColumnTypeNames).join(", ")}`,
        options: ColumnTypeNames,
    },
    transform: {
        ...StringCellTypeDefinition,
        keyword: "transform",
        description: `An advanced option. Available transforms are: ${AvailableTransforms.join(
            ", "
        )}`,
    },
    description: {
        ...StringCellTypeDefinition,
        keyword: "description",
        description: "Describe the column",
    },
    unit: {
        ...StringCellTypeDefinition,
        keyword: "unit",
        description: "Unit of measurement",
    },
    shortUnit: {
        ...StringCellTypeDefinition,
        keyword: "shortUnit",
        description: "Short (axis) unit",
    },
    annotationsColumnSlug: {
        ...StringCellTypeDefinition,
        keyword: "annotationsColumnSlug",
        description:
            "Column that contains the annotations for this column, if any.",
    },
    sourceName: {
        ...StringCellTypeDefinition,
        keyword: "sourceName",
        description:
            "Source name displayed on charts using this dataset. For academic papers, the name of the source should be 'Authors (year)' e.g. Arroyo-Abad and Lindert (2016). For institutional projects or reports, the name should be 'Institution, Project (year or vintage)' e.g. U.S. Bureau of Labor Statistics, Consumer Expenditure Survey (2015 release). For data that we have modified extensively, the name should be 'Our World in Data based on Author (year)' e.g. Our World in Data based on Atkinson (2002) and Sen (2000).",
    },
    sourceLink: {
        ...UrlCellTypeDefinition,
        keyword: "sourceName",
        description:
            "Link to the publication from which we retrieved this data",
    },
    dataPublishedBy: {
        ...StringCellTypeDefinition,
        keyword: "dataPublishedBy",
        description:
            "For academic papers this should be a complete reference. For institutional projects, detail the project or report. For data we have modified extensively, list OWID as the publishers and provide the name of the person in charge of the calculation.",
    },
    dataPublisherSource: {
        ...StringCellTypeDefinition,
        keyword: "dataPublisherSource",
        description:
            "Basic indication of how the publisher collected this data e.g. surveys data. Anything longer than a line should go in the dataset description.",
    },
    retrievedDate: {
        ...StringCellTypeDefinition,
        keyword: "retrievedDate",
        description: "Date when this data was obtained by us",
    },
    additionalInfo: {
        ...StringCellTypeDefinition,
        keyword: "additionalInfo",
        description:
            "Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like.",
    },
} as const

const SwitcherOptionDef = {
    cssClass: "StringDeclarationType",
    description: "A form input for the user.",
    regex: /^.+ (Dropdown|Radio|Checkbox)$/,
    requirements: `Must end with 'Dropdown', 'Radio', or 'Checkbox'`,
}

export const ExplorerKeywords = {
    isPublished: {
        ...BooleanCellTypeDefinition,
        keyword: "isPublished",
        description: "Set to true to make this Explorer public.",
    },
    hideAlertBanner: {
        ...BooleanCellTypeDefinition,
        keyword: "hideAlertBanner",
        description: "Set to true to hide the Covid alert banner.",
    },
    title: {
        ...StringCellTypeDefinition,
        keyword: "title",
        description:
            "The title will appear in the top left corner of the page.",
    },
    subtitle: {
        ...StringCellTypeDefinition,
        keyword: "subtitle",
        description: "The subtitle will appear under the title.",
    },
    googleSheet: {
        ...UrlCellTypeDefinition,
        keyword: "googleSheet",
        description:
            "Create a Google Sheet, share it with the OWID Group, then put the link here.",
    },
    defaultView: {
        ...UrlCellTypeDefinition,
        keyword: "defaultView",
        description:
            "Use the Explorer, then copy the part of the url starting with ? here.",
    },
    hideControls: {
        ...BooleanCellTypeDefinition,
        keyword: "hideControls",
        description: "Whether to hide the controls. Default is false.",
    },
    subNavId: {
        options: Object.values(SubNavId),
        keyword: "subNavId",
        cssClass: "EnumCellType",
        description: "A subnav to show, if any.",
    },
    subNavCurrentId: {
        // todo: add options here
        cssClass: "EnumCellType",
        keyword: "subNavCurrentId",
        description: "The current page in the subnav.",
    },
    thumbnail: {
        ...UrlCellTypeDefinition,
        keyword: "thumbnail",
        description: "URL to the social sharing thumbnail.",
    },
    wpBlockId: {
        ...StringCellTypeDefinition,
        keyword: "wpBlockId",
        description:
            "If present will show the matching Wordpress block ID beneath the Explorer.",
    },
    entityType: {
        ...StringCellTypeDefinition,
        keyword: "entityType",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
    },
    pickerColumnSlugs: {
        ...SlugsDeclarationCellTypeDefinition,
        keyword: "pickerColumnSlugs",
        description:
            "You can manually set the column slug(s) to show in the entity picker or else they will be automatically chosen.",
    },
    table: {
        ...SlugDeclarationCellTypeDefinition,
        keyword: "table",
        description:
            "Give your table a slug and include a link to a CSV or put data inline.",
        rest: [DelimitedUrlDefinition],
        headerCellType: {
            ...SlugDeclarationCellTypeDefinition,
            cssClass: "SubTableHeaderCellType",
            keywordMap: {},
            catchAllKeyword: {
                ...SlugDeclarationCellTypeDefinition,
                description: "A column slug.",
            },
        },
    },
    columns: {
        ...SlugDeclarationCellTypeDefinition,
        headerCellType: {
            ...SubTableHeaderCellTypeDefinition,
            keywordMap: ColumnsKeywordMap,
        },
        keyword: "columns",
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (often times, incorrectly).",
    },
    switcher: {
        ...SlugDeclarationCellTypeDefinition,
        keyword: "switcher",
        description: "The decision matrix for your Explorer goes here.",
        headerCellType: {
            ...SubTableHeaderCellTypeDefinition,
            keywordMap: SwitcherKeywordMap,
            catchAllKeyword: SwitcherOptionDef,
        },
    },
} as const

export const ExplorerGrammar = ({
    keywordMap: ExplorerKeywords,
    cssClass: "KeywordCellType",
    description: "Keyword",
} as unknown) as CellTypeDefinition
