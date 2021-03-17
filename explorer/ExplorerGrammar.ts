import { SubNavId } from "../clientUtils/owidTypes"
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
    EnumCellDef,
    StringDeclarationDef,
} from "../gridLang/GridLangConstants"
import { OwidDatasets } from "./OwidDatasets"
import { GrapherGrammar } from "./GrapherGrammar"
import { ColumnGrammar } from "./ColumnGrammar"

const ExplorerFormControlCellDeff: CellDef = {
    ...StringDeclarationDef,
    description: "A form input for the user.",
    regex: /^.+ (Dropdown|Radio|Checkbox)$/,
    requirementsDescription: `Must end with 'Dropdown', 'Radio', or 'Checkbox'`,
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
        valuePlaceholder: "",
        description: "A link to a CSV or TSV or the name of an OWID dataset.",
        positionalCellDefs: [
            {
                ...SlugDeclarationCellDef,
                description:
                    "If you have multiple tables, give each one a unique slug.",
            },
        ],
        headerCellDef: {
            ...SlugDeclarationCellDef,
            cssClass: "SubTableHeaderCellDef",
            grammar: {},
            catchAllCellDef: {
                ...SlugDeclarationCellDef,
                description: "A column slug.",
            },
        },
    },
    explorerTitle: {
        ...StringCellDef,
        keyword: "explorerTitle",
        valuePlaceholder: "Life Expectancy Data Explorer",
        description:
            "The title will appear in the top left corner of the Explorer.",
    },
    explorerSubtitle: {
        ...StringCellDef,
        keyword: "explorerSubtitle",
        valuePlaceholder: "All our data from various sources.",
        description: "The subtitle will appear under the explorerTitle.",
    },
    columns: {
        ...SlugDeclarationCellDef,
        keyword: "columns",
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (sometimes incorrectly).",
        headerCellDef: {
            ...SubTableHeaderCellDef,
            grammar: ColumnGrammar,
        },
    },
    graphers: {
        ...SlugDeclarationCellDef,
        keyword: "graphers",
        description: "The decision matrix for your Explorer goes here.",
        headerCellDef: {
            ...SubTableHeaderCellDef,
            grammar: GrapherGrammar,
            catchAllCellDef: ExplorerFormControlCellDeff,
        },
    },
    googleSheet: {
        ...UrlCellDef,
        keyword: "googleSheet",
        valuePlaceholder: "https://docs.google.com/spreadsheets/d/1qeX...",
        description:
            "Create a Google Sheet, share it with the OWID Group, then put the link here.",
    },
    downloadDataLink: {
        ...UrlCellDef,
        keyword: "downloadDataLink",
        valuePlaceholder: "https://example.com/data.csv",
        description:
            "An optional URL for the download button in the Download tab. If blank, the Explorer will instead generate a CSV from the data it has available.",
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
    selection: {
        ...StringCellDef,
        keyword: "selection",
        valuePlaceholder: "Canada",
        description: "The default selected entities.",
        isHorizontalList: true,
    },
    entityType: {
        ...StringCellDef,
        keyword: "entityType",
        valuePlaceholder: "region",
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
    },
    pickerColumnSlugs: {
        ...SlugsDeclarationCellDef,
        keyword: "pickerColumnSlugs",
        valuePlaceholder: "gdp population gdp_per_capita",
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
