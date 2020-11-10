import { CoreColumnDefKeyword } from "coreTable/CoreColumnDef"
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
} from "./GridGrammarConstants"

export enum ExplorerKeywordList {
    // Abstract keywords: keywords not instantiated by actually typing the word but rather by position.
    keyword = "keyword",
    wip = "wip", // Not quite a comment, but not a valid typ. A "work in progress" cell.
    nothingGoesThere = "nothingGoesThere",
    delimitedUrl = "delimitedUrl",

    // Tuples
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

    // Subtables
    switcher = "switcher",
    table = "table",
    columns = "columns",
}

const AbstractKeywords = new Set([
    ExplorerKeywordList.keyword,
    ExplorerKeywordList.wip,
    ExplorerKeywordList.nothingGoesThere,
    ExplorerKeywordList.delimitedUrl,
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

    private get cellTypeDefinition() {
        if (this.column === 0)
            return CellTypeDefinitions[ExplorerKeywordList.keyword]
        const firstWord = this.line ? this.line[0] : undefined
        const firstWordAsKeyword =
            ExplorerKeywordList[firstWord as ExplorerKeywordList]
        if (this.column === 1 && firstWordAsKeyword)
            return CellTypeDefinitions[firstWordAsKeyword]

        if (firstWordAsKeyword) {
            // It has a keyword but it is column 2+
            const def = CellTypeDefinitions[firstWordAsKeyword]
            const cellTypeDef = def.rest && def.rest[this.column - 2]
            if (cellTypeDef) return cellTypeDef
            return CellTypeDefinitions[ExplorerKeywordList.nothingGoesThere]
        }
        return CellTypeDefinitions[
            this.horizontalCellTypeName ?? ExplorerKeywordList.wip
        ]
    }

    private get isFirstBlankRow() {
        const { row } = this
        const numRows = this.matrix.length
        if (numRows === 1) return row === 0
        return row === numRows
    }

    private get errors() {
        return []
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
        if (value === undefined || value === "") return undefined
        if (errorMessage) return errorMessage

        return [this.cellTypeDefinition.description].join("\n")
    }

    get cssClasses() {
        if (this.errorMessage) return [ErrorCellTypeClass]
        const isEmpty = this.value === undefined || this.value === ""
        const showArrow =
            isEmpty && this.isFirstBlankRow ? "ShowDropdownArrow" : undefined
        return [this.cellTypeDefinition.cssClass, showArrow].filter(isPresent)
    }

    get options() {
        return this.cellTypeDefinition.options
    }

    private get horizontalCellTypeName() {
        const isHeaderRow = false
        const headerOptions = []
        const columnOptions = []
        const rowType = ""
        if (isHeaderRow) {
        } else {
        }
        return undefined
    }
}
