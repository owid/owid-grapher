import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { AvailableTransforms } from "coreTable/Transforms"
import {
    Grammar,
    SlugDeclarationCellDef,
    StringCellDef,
    IntegerCellDef,
    UrlCellDef,
} from "explorer/gridLang/GridLangConstants"

export const ColumnGrammar: Grammar = {
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
        description: `The column type reveals how to interpret the data, whether as a string or number for example, and how to display it, like whether to show a % or $.`,
        terminalOptions: Object.values(ColumnTypeNames).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
    },
    transform: {
        ...StringCellDef,
        keyword: "transform",
        description: `An advanced option. Available transforms are: ${AvailableTransforms.join(
            ", "
        )}`,
    },
    tolerance: {
        ...IntegerCellDef,
        keyword: "tolerance",
        description:
            "Set this to interpolate missing values as long as they are within this range of an actual value.",
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
