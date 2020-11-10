import { isPresent } from "grapher/utils/Util"
import { SubNavId } from "site/server/views/SiteSubnavigation"

export enum ExplorerKeywordList {
    switcher = "switcher",
    table = "table",
    columns = "columns",
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
}

export enum ExplorerBoolean {
    true = "true",
    false = "false",
}

const ErrorCellTypeClass = "ErrorCellType"

type CellCoordinate = number // An integer >= 0

interface CellLink {
    row: CellCoordinate
    column: CellCoordinate
}

enum CellTypes {
    keyword = "keyword",
    wip = "wip", // Not quite a comment, but not a valid typ. A "work in progress" cell.
    isPublished = "isPublished",
    hideAlertBanner = "hideAlertBanner",
    title = "title",
    subtitle = "subtitle",
    googleSheet = "googleSheet",
    defaultView = "defaultView",
    subNavId = "subNavId",
    subNavCurrentId = "subNavCurrentId",
    table = "table",
    columns = "columns",
}

interface CellTypeDefinition {
    options: string[]
    cssClass: string
    description: string
}

const BooleanCellTypeDefinition: CellTypeDefinition = {
    options: Object.values(ExplorerBoolean),
    cssClass: "BooleanCellType",
    description: "Boolean",
}

const StringCellTypeDefinition: CellTypeDefinition = {
    options: [],
    cssClass: "StringCellType",
    description: "",
}

const UrlCellTypeDefinition: CellTypeDefinition = {
    ...StringCellTypeDefinition,
    cssClass: "UrlCellType",
}

const SlugDeclarationCellTypeDefinition: CellTypeDefinition = {
    cssClass: "SlugDeclarationCellTypeDefinition",
    description: "A URL-friendly slug type name.",
    options: [],
}

const CellTypeDefinitions: { [key in CellTypes]: CellTypeDefinition } = {
    keyword: {
        options: Object.values(ExplorerKeywordList),
        cssClass: "KeywordCellType",
        description: "Keyword",
    },
    wip: { options: [], cssClass: "WipCellType", description: "A comment" },
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
        options: [], // todo: get options in here
        cssClass: "EnumCellType",
        description: "The current page in the subnav.",
    },
    table: SlugDeclarationCellTypeDefinition,
    columns: SlugDeclarationCellTypeDefinition,
}

type MatrixLine = string[]
type MatrixProgram = MatrixLine[]

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

    get comment() {
        const { cellTypeDefinition, value } = this
        if (value === undefined || value === "") return undefined

        const { options } = cellTypeDefinition
        const optionsLine = options.length
            ? `Options: ${options.join(", ")}`
            : undefined
        return [this.cellTypeDefinition.description, optionsLine]
            .filter(isPresent)
            .join("\n")
    }

    private get lineKeyword() {
        return this.line ? this.line[0] : undefined
    }

    private get value() {
        return this.line ? this.line[this.column] : undefined
    }

    private get line(): MatrixLine | undefined {
        return this.matrix[this.row]
    }

    get isValid() {
        if (!this.line) return true

        const { options } = this
        if (!options.length) return true
        const value = this.value
        if (value === undefined || value === "") return true
        return options.includes(value)
    }

    private get cellTypeName() {
        if (this.column === 0) return CellTypes.keyword
        if (this.column === 1) {
            const keyword = this.lineKeyword as CellTypes
            if (CellTypeDefinitions[keyword]) return keyword
        }
        return CellTypes.wip
    }

    private get cellTypeDefinition() {
        return CellTypeDefinitions[this.cellTypeName]
    }

    private get isNextRow() {
        const { row } = this
        const numRows = this.matrix.length
        if (numRows === 1) return row === 0
        return row === numRows
    }

    private get isEmpty() {
        return this.value === undefined || this.value === ""
    }

    get cssClasses() {
        if (!this.isValid) return [ErrorCellTypeClass]
        const showArrow =
            this.isEmpty && this.isNextRow ? "ShowDropdownArrow" : undefined
        return [this.cellTypeDefinition.cssClass, showArrow].filter(isPresent)
    }

    get options() {
        return this.cellTypeDefinition.options ?? []
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
}
