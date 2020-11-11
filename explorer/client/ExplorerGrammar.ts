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
    DelimitedUrlDefinition,
} from "./GridGrammarConstants"

const FrontierCellClass = "ShowDropdownArrow"

export const ExplorerProperties = {
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
} as const

export const SubTableTypeDefinitions = {
    table: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        keyword: "table",
        description:
            "Give your table a slug and include a link to a CSV or put data inline.",
        rest: [DelimitedUrlDefinition],
    },
    columns: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        headerKeywordOptions: Object.values(CoreColumnDefKeyword),
        keyword: "columns",
        description:
            "Include all your column definitions for a table here. If you do not provide a column definition for every column in your table one will be generated for you by the machine (often times, incorrectly).",
    },
    switcher: {
        ...SubtableSlugDeclarationCellTypeDefinition,
        keyword: "switcher",
        description: "The decision matrix for your Explorer goes here.",
    },
} as const

// Abstract keywords: keywords not instantiated by actually typing the word but rather by position.
const AbstractTypeDefinitions: {
    [typeSlug: string]: CellTypeDefinition
} = {
    keyword: {
        options: Object.keys(ExplorerProperties).concat(
            Object.keys(SubTableTypeDefinitions)
        ),
        cssClass: "KeywordCellType",
        description: "Keyword",
    },
    wip: {
        cssClass: "WipCellType",
        description:
            "Not a recognized statement. Treating as a work in progress.",
    },
    delimitedUrl: DelimitedUrlDefinition,
    nothingGoesThere: NothingGoesThereDefinition,

    subtableWord: SubTableWordCellTypeDefinition,
    subtableHeaderWord: SubTableHeaderCellTypeDefinition,
} as const

const ExplorerTypeDefinitions: {
    [type: string]: CellTypeDefinition
} = {
    ...AbstractTypeDefinitions,
    ...ExplorerProperties,
    ...SubTableTypeDefinitions,
} as const

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
        if (this.column === 0) return AbstractTypeDefinitions.keyword
        const firstWordOnLine = this.line ? this.line[0] : undefined
        const isFirstWordAKeyword =
            firstWordOnLine &&
            ExplorerTypeDefinitions[firstWordOnLine] !== undefined
        if (this.column === 1 && firstWordOnLine && isFirstWordAKeyword)
            return ExplorerTypeDefinitions[firstWordOnLine]

        if (!isFirstWordAKeyword) return undefined

        // It has a keyword but it is column 2+
        const def = ExplorerTypeDefinitions[firstWordOnLine!]
        const cellTypeDef = def.rest && def.rest[this.column - 2]
        if (cellTypeDef) return cellTypeDef
        return AbstractTypeDefinitions.nothingGoesThere
    }

    @imemo private get cellTypeDefinition() {
        const def = this.cellTerminalTypeDefinition
        if (def) return def

        const subTable = this.subTableInfo
        if (subTable) return subTable.def

        return AbstractTypeDefinitions.wip
    }

    @imemo private get subTableInfo() {
        if (this.cellTerminalTypeDefinition) return undefined

        let start = this.row
        while (start) {
            const parentLine = this.matrix[start - 1]
            if (!parentLine) return undefined
            const parentKeyword = parentLine[0] as keyof typeof SubTableTypeDefinitions
            if (parentKeyword) {
                if (!SubTableTypeDefinitions[parentKeyword]) return undefined
                const isHeaderRow = this.row === start && this.value
                return {
                    isHeaderRow,
                    def: isHeaderRow
                        ? AbstractTypeDefinitions.subtableHeaderWord
                        : AbstractTypeDefinitions.subtableWord,
                }
            }
            start--
        }
        return undefined
    }

    // If true show a +
    get isFirstCellOnFrontierRow() {
        const { row, column } = this
        const numRows = this.matrix.length
        if (column) return false // Only first column should have a +
        if (!isBlankLine(this.line)) return false // Only blank lines can be frontier
        if (numRows === 1) {
            if (row === 1) return !isBlankLine(this.matrix[0])
            return row === 0
        }
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
        const { value, errorMessage, cellTypeDefinition } = this
        if (isEmpty(value)) return undefined
        if (errorMessage) return errorMessage

        return [cellTypeDefinition.description].join("\n")
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
            this.isFirstCellOnFrontierRow || this.isSubTableFrontierCell
                ? FrontierCellClass
                : undefined
        return [cellTypeDefinition.cssClass, showArrow].filter(isPresent)
    }

    get options() {
        return this.cellTypeDefinition.options
    }
}

const isBlankLine = (line: string[] | undefined) =>
    line === undefined ? true : line.join("") === ""
