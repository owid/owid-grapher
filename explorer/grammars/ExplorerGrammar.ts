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
    Grammar,
    QueryStringCellDef,
    EnumCellDef,
    StringDeclarationDef,
} from "explorer/gridLang/GridLangConstants"
import { OwidDatasets } from "./OwidDatasets"
import { GrapherGrammar } from "./GrapherGrammar"
import { ColumnGrammar } from "./ColumnGrammar"

const ExplorerFormControlCellDeff: CellDef = {
    ...StringDeclarationDef,
    description: "A form input for the user.",
    regex: /^.+ (Dropdown|Radio|Checkbox)$/,
    requirements: `Must end with 'Dropdown', 'Radio', or 'Checkbox'`,
}

export const ExplorerGrammar: Grammar = {
    table: {
        ...UrlCellDef,
        keyword: "table",
        terminalOptions: OwidDatasets.map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
            grammar: {},
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
            grammar: ColumnGrammar,
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
            grammar: GrapherGrammar,
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
        terminalOptions: Object.values(SubNavId).map((keyword) => ({
            keyword,
            description: "",
            cssClass: "",
        })),
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
    ...GrapherGrammar,
} as const
