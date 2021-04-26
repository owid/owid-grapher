import { ColumnTypeNames } from "../coreTable/CoreColumnDef"
import { AvailableTransforms } from "../coreTable/Transforms"
import { BinningStrategy } from "../grapher/color/BinningStrategy"
import { ColorSchemeName } from "../grapher/color/ColorConstants"
import {
    Grammar,
    SlugDeclarationCellDef,
    StringCellDef,
    IntegerCellDef,
    UrlCellDef,
    BooleanCellDef,
    EnumCellDef,
    NumericCellDef,
} from "../gridLang/GridLangConstants"

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
        keyword: "sourceLink",
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
    color: {
        ...StringCellDef,
        keyword: "color",
        description: "Default color for column",
    },
    colorScaleScheme: {
        ...EnumCellDef,
        keyword: "colorScaleScheme",
        terminalOptions: Object.values(ColorSchemeName).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
        description: "The color scheme to use",
    },
    colorScaleInvert: {
        ...BooleanCellDef,
        keyword: "colorScaleInvert",
        description: "Invert the color scale?",
    },
    colorScaleBinningStrategy: {
        ...EnumCellDef,
        keyword: "colorScaleBinningStrategy",
        terminalOptions: Object.values(BinningStrategy).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
        description: "The binning strategy to use",
    },
    colorScaleNoDataLabel: {
        ...StringCellDef,
        keyword: "colorScaleNoDataLabel",
        description: "Custom label for the 'No data' bin",
    },
    colorScaleLegendDescription: {
        ...StringCellDef,
        keyword: "colorScaleLegendDescription",
        description: "Legend title for ScatterPlot",
    },
    colorScaleEqualSizeBins: {
        ...BooleanCellDef,
        keyword: "colorScaleEqualSizeBins",
        description: "Disable visual scaling of the bins based on values?",
    },
    colorScaleNumericMinValue: {
        ...NumericCellDef,
        keyword: "colorScaleNumericMinValue",
        description:
            "Minimum value of the first bin (leaving blank will infer the minimum from the data)",
    },
    colorScaleNumericBins: {
        ...StringCellDef,
        keyword: "colorScaleNumericBins",
        description: [
            "Custom numeric bins",
            "  Format: [binMax],[color],[label]; [binMax],[color],[label]; ...",
            "  Example: 0.1,#ccc,example label; 0.2,,; 0.3,,prev has no label",
        ].join("\n"),
    },
    colorScaleCategoricalBins: {
        ...StringCellDef,
        keyword: "colorScaleCategoricalBins",
        description: [
            "Custom categorical bins",
            "  Format: [data value],[color],[label]; [data value],[color],[label]; ...",
            "  Example: one,#ccc,uno; two,,dos",
        ].join("\n"),
    },
} as const
