import { CoreColumnDefKeyword } from "coreTable/CoreColumnDef"
import { imemo } from "coreTable/CoreTableUtils"
import { isPresent } from "grapher/utils/Util"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import {
    BooleanCellTypeDefinition,
    CellCoordinate,
    CellLink,
    CellTypeDefinition,
    ErrorCellTypeClass,
    MatrixLine,
    MatrixProgram,
    SubtableSlugDeclarationCellTypeDefinition,
    StringCellTypeDefinition,
    UrlCellTypeDefinition,
    NothingGoesThereDefinition,
    SubTableHeaderCellTypeDefinition,
    SubTableWordCellTypeDefinition,
} from "./GridGrammarConstants"

export enum ExplorerKeywordList {
    keyword = "keyword",
    wip = "wip", // Not quite a comment, but not a valid typ. A "work in progress" cell.
    nothingGoesThere = "nothingGoesThere",
    delimitedUrl = "delimitedUrl",
    subtableWord = "subtableWord",
    subtableHeaderWord = "subtableHeaderWord",

    isPublished = "isPublished",
    title = "title",
    subNavId = "subNavId",
    subNavCurrentId = "subNavCurrentId",
    hideAlertBanner = "hideAlertBanner",
    thumbnail = "thumbnail",
    subtitle = "subtitle",
    defaultView = "defaultView",
    wpBlockId = "wpBlockId",
    googleSheet = "googleSheet",
    entityType = "entityType",

    switcher = "switcher",
    table = "table",
    columns = "columns",
}

// Abstract keywords: keywords not instantiated by actually typing the word but rather by position.
const AbstractKeywords = new Set([
    ExplorerKeywordList.keyword,
    ExplorerKeywordList.wip,
    ExplorerKeywordList.nothingGoesThere,
    ExplorerKeywordList.delimitedUrl,
    ExplorerKeywordList.subtableWord,
    ExplorerKeywordList.subtableHeaderWord,
])

// Keywords that also can have child tables
const SubtableKeywords = new Set([
    ExplorerKeywordList.switcher,
    ExplorerKeywordList.table,
    ExplorerKeywordList.columns,
])

const ConcreteKeywords = Object.values(ExplorerKeywordList).filter(
    (word) => !AbstractKeywords.has(word)
)

const DelimitedUrlDefinition = {
    ...UrlCellTypeDefinition,
    description: "A link to a CSV or TSV",
}

const CellTypeDefinitions: {
    [key in ExplorerKeywordList]: CellTypeDefinition
} = {
    // Abstract keywords
    keyword: {
        options: ConcreteKeywords,
        cssClass: "KeywordCellType",
        description: "Keyword",
    },
    wip: { cssClass: "WipCellType", description: "A comment" },
    delimitedUrl: DelimitedUrlDefinition,
    nothingGoesThere: NothingGoesThereDefinition,

    subtableWord: SubTableWordCellTypeDefinition,
    subtableHeaderWord: SubTableHeaderCellTypeDefinition,

    // Tuples
    isPublished: {
        ...BooleanCellTypeDefinition,
        description: "Set to true to make this Explorer public.",
    },
    hideAlertBanner: {
        ...BooleanCellTypeDefinition,
        description: "Set to true to hide the Covid alert banner.",
    },
    title: {
        ...StringCellTypeDefinition,
        description:
            "The title will appear in the top left corner of the page.",
    },
    subtitle: {
        ...StringCellTypeDefinition,
        description: "The subtitle will appear under the title.",
    },
    googleSheet: {
        ...UrlCellTypeDefinition,
        description:
            "Create a Google Sheet, share it with the OWID Group, then put the link here.",
    },
    defaultView: {
        ...UrlCellTypeDefinition,
        description:
            "Use the Explorer, then copy the part of the url starting with ? here.",
    },
    subNavId: {
        options: Object.values(SubNavId),
        cssClass: "EnumCellType",
        description: "A subnav to show, if any.",
    },
    subNavCurrentId: {
        // todo: add options here
        cssClass: "EnumCellType",
        description: "The current page in the subnav.",
    },
    thumbnail: {
        ...UrlCellTypeDefinition,
        description: "URL to the social sharing thumbnail.",
    },
    wpBlockId: {
        ...StringCellTypeDefinition,
        description:
            "If present will show the matching Wordpress block ID beneath the Explorer.",
    },
    entityType: {
        ...StringCellTypeDefinition,
        description:
            "Default is 'country', but you can specify a different one such as 'state' or 'region'.",
    },

    // Subtables
    table: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        description:
            "Give your table a slug and include a link to a CSV or put data inline.",
        rest: [DelimitedUrlDefinition],
    },
    columns: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        headerKeywordOptions: Object.values(CoreColumnDefKeyword),
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (often times, incorrectly).",
    },
    switcher: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        description: "The decision matrix for your Explorer goes here.",
    },
}

// Todo: figure out Matrix cell type and whether we need the double check
const isEmpty = (value: any) => value === "" || value === undefined

export class ExplorerProgramCell {
    private row: CellCoordinate
    private column: CellCoordinate
    private matrix: MatrixProgram
    constructor(
        program: MatrixProgram,
        row: CellCoordinate,
        column: CellCoordinate
    ) {
        this.row = row
        this.column = column
        this.matrix = program
    }

    private get value() {
        return this.line ? this.line[this.column] : undefined
    }

    private get line(): MatrixLine | undefined {
        return this.matrix[this.row]
    }

    private get cellTerminalTypeDefinition() {
        if (this.column === 0)
            return CellTypeDefinitions[ExplorerKeywordList.keyword]
        const firstWord = this.line ? this.line[0] : undefined
        const firstWordAsKeyword =
            ExplorerKeywordList[firstWord as ExplorerKeywordList]
        if (this.column === 1 && firstWordAsKeyword)
            return CellTypeDefinitions[firstWordAsKeyword]

        if (!firstWordAsKeyword) return undefined

        // It has a keyword but it is column 2+
        const def = CellTypeDefinitions[firstWordAsKeyword]
        const cellTypeDef = def.rest && def.rest[this.column - 2]
        if (cellTypeDef) return cellTypeDef
        return CellTypeDefinitions[ExplorerKeywordList.nothingGoesThere]
    }

    @imemo private get cellTypeDefinition() {
        const def = this.cellTerminalTypeDefinition
        if (def) return def

        const subTable = this.subTableInfo
        if (subTable) return subTable.def

        return CellTypeDefinitions[ExplorerKeywordList.wip]
    }

    @imemo private get subTableInfo() {
        if (this.cellTerminalTypeDefinition) return undefined

        let start = this.row
        while (start) {
            const parentLine = this.matrix[start - 1]
            if (!parentLine) return undefined
            const parentKeyword = parentLine[0] as ExplorerKeywordList
            if (parentKeyword) {
                if (!SubtableKeywords.has(parentKeyword)) return undefined
                const subTableDef = CellTypeDefinitions[parentKeyword]
                const isHeaderRow = this.row === start && this.value
                return {
                    isHeaderRow,
                    def: isHeaderRow
                        ? CellTypeDefinitions[
                              ExplorerKeywordList.subtableHeaderWord
                          ]
                        : CellTypeDefinitions[ExplorerKeywordList.subtableWord],
                }
            }
            start--
        }
        return undefined
    }

    // If true show a +
    private get isFrontierCell() {
        const { row, value } = this
        const numRows = this.matrix.length
        if (!isEmpty(value)) return false
        if (numRows === 1) return row === 0
        return row === numRows
    }

    private get suggestions() {
        return []
    }

    private get definitionLinks(): CellLink[] {
        return []
    }

    private get implementationLinks(): CellLink[] {
        return []
    }

    get errorMessage() {
        if (!this.line) return ""
        const { cellTypeDefinition, value } = this
        const { options, regex, requirements } = cellTypeDefinition
        if (regex) {
            if (typeof value !== "string") return ""
            if (!regex.test(value))
                return `Error: ${
                    requirements
                        ? requirements
                        : `'${value}' did not validate against ${regex}`
                }`
            return ""
        }

        if (!options) return ""
        if (value === undefined || value === "") return ""
        return options.includes(value)
            ? ""
            : `Error: '${value}' is not a valid option. Valid options are ${options
                  .map((opt) => `'${opt}'`)
                  .join(", ")}`
    }

    get comment() {
        const { value, errorMessage } = this
        if (isEmpty(value)) return undefined
        if (errorMessage) return errorMessage

        return [this.cellTypeDefinition.description].join("\n")
    }

    // If true show a +
    // todo: not actually getting called by HOT.
    private get isSubTableFrontierCell() {
        const { subTableInfo, line, value, column } = this
        if (!line || !isEmpty(value) || !subTableInfo) return false
        if (column === 1) return true
        return !isEmpty(line[column - 1]) && isEmpty(line[column + 1])
    }

    get cssClasses() {
        const { errorMessage, cellTypeDefinition } = this
        if (errorMessage) return [ErrorCellTypeClass]
        const showArrow =
            this.isFrontierCell || this.isSubTableFrontierCell
                ? "ShowDropdownArrow"
                : undefined
        return [cellTypeDefinition.cssClass, showArrow].filter(isPresent)
    }

    get options() {
        return this.cellTypeDefinition.options
    }
}
