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
    DelimitedUrlCellDef,
    IntegerCellDef,
    SlugsDeclarationCellDef,
    KeywordMap,
    QueryStringCellDef,
    RootKeywordCellDef,
    EnumCellDef,
    StringDeclarationDef,
} from "./GridGrammarConstants"
import { OwidDatasets } from "./OwidDatasets"

const SwitcherSubTableHeaderKeywordMap: KeywordMap = {
    chartId: {
        ...IntegerCellDef,
        description: "ID of the Grapher to load",
        keyword: "slug",
    },
    title: {
        ...StringCellDef,
        keyword: "title",
        description: "Chart title",
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "Chart subtitle",
    },
    type: {
        ...StringCellDef,
        keyword: "type",
        description: `The type of chart to show. Options are ${Object.values(
            ChartTypeName
        ).join(", ")}`,
        options: Object.values(ChartTypeName),
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
    ySlugs: {
        ...SlugsDeclarationCellDef,
        description: "ColumnSlug(s) for the yAxis",
        keyword: "ySlugs",
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
    table: {
        ...SlugDeclarationCellDef,
        description: "Slug of the table to use.",
        keyword: "table",
    },
    yScaleToggle: {
        ...BooleanCellDef,
        keyword: "yScaleToggle",
        description: "Set to 'true' if the user can change the yAxis",
    },
} as const

const ColumnsSubTableHeaderKeywordMap: KeywordMap = {
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

const SwitcherFormControlCellDeff: CellDef = {
    ...StringDeclarationDef,
    description: "A form input for the user.",
    regex: /^.+ (Dropdown|Radio|Checkbox)$/,
    requirements: `Must end with 'Dropdown', 'Radio', or 'Checkbox'`,
}

export const ExplorerRootKeywordMap: KeywordMap = {
    isPublished: {
        ...BooleanCellDef,
        keyword: "isPublished",
        description: "Set to true to make this Explorer public.",
    },
    hideAlertBanner: {
        ...BooleanCellDef,
        keyword: "hideAlertBanner",
        description: "Set to true to hide the Covid alert banner.",
    },
    title: {
        ...StringCellDef,
        keyword: "title",
        description:
            "The title will appear in the top left corner of the page.",
    },
    subtitle: {
        ...StringCellDef,
        keyword: "subtitle",
        description: "The subtitle will appear under the title.",
    },
    googleSheet: {
        ...UrlCellDef,
        keyword: "googleSheet",
        description:
            "Create a Google Sheet, share it with the OWID Group, then put the link here.",
    },
    defaultView: {
        ...QueryStringCellDef,
        keyword: "defaultView",
        description:
            "Use the Explorer, then copy the part of the url starting with ? here.",
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
    wpBlockId: {
        ...StringCellDef,
        keyword: "wpBlockId",
        description:
            "If present will show the matching Wordpress block ID beneath the Explorer.",
    },
    entityType: {
        ...StringCellDef,
        keyword: "entityType",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
    },
    pickerColumnSlugs: {
        ...SlugsDeclarationCellDef,
        keyword: "pickerColumnSlugs",
        description:
            "You can manually set the column slug(s) to show in the entity picker or else they will be automatically chosen.",
    },
    table: {
        ...SlugDeclarationCellDef,
        keyword: "table",
        description:
            "Give your table a slug and include a link to a CSV or put data inline.",
        rest: [
            {
                ...DelimitedUrlCellDef,
                options: OwidDatasets,
                description:
                    "A link to a CSV or TSV or the name of an OWID dataset.",
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
    columns: {
        ...SlugDeclarationCellDef,
        headerCellDef: {
            ...SubTableHeaderCellDef,
            keywordMap: ColumnsSubTableHeaderKeywordMap,
        },
        keyword: "columns",
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (often times, incorrectly).",
    },
    switcher: {
        ...SlugDeclarationCellDef,
        keyword: "switcher",
        description: "The decision matrix for your Explorer goes here.",
        headerCellDef: {
            ...SubTableHeaderCellDef,
            keywordMap: SwitcherSubTableHeaderKeywordMap,
            catchAllKeyword: SwitcherFormControlCellDeff,
        },
    },
} as const

export const ExplorerGrammar: CellDef = {
    ...RootKeywordCellDef,
    keywordMap: ExplorerRootKeywordMap,
}
