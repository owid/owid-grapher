import { CoreColumnDefKeyword } from "coreTable/CoreColumnDef"
import { isPresent } from "grapher/utils/Util"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import {
    BooleanCellTypeDefinition,
    CellCoordinate,
    CellLink,
    CellTypeDefinition,
    ErrorCellTypeClass,
    SlugDeclarationCellTypeDefinition,
    StringCellTypeDefinition,
    UrlCellTypeDefinition,
} from "./GridGrammarConstants"

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

const CellTypeDefinitions: { [key in CellTypes]: CellTypeDefinition } = {
    keyword: {
        options: Object.values(ExplorerKeywordList),
        cssClass: "KeywordCellType",
        description: "Keyword",
    },
    wip: { cssClass: "WipCellType", description: "A comment" },
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
    table: {
        ...SlugDeclarationCellTypeDefinition,
    },
    columns: {
        ...SlugDeclarationCellTypeDefinition,
        headerKeywordOptions: Object.values(CoreColumnDefKeyword),
    },
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

    private get value() {
        return this.line ? this.line[this.column] : undefined
    }

    private get line(): MatrixLine | undefined {
        return this.matrix[this.row]
    }

    private get cellTypeName() {
        if (this.column === 0) return CellTypes.keyword
        if (this.column === 1) {
            const firstWord = this.line ? this.line[0] : undefined
            if (CellTypeDefinitions[firstWord as CellTypes])
                return firstWord as CellTypes
        }
        return this.horizontalCellTypeName ?? CellTypes.wip
    }

    private get cellTypeDefinition() {
        return CellTypeDefinitions[this.cellTypeName]
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

    get isValid() {
        if (!this.line) return true

        const { options } = this
        if (!options) return true
        const value = this.value
        if (value === undefined || value === "") return true
        return options.includes(value)
    }

    get comment() {
        const { cellTypeDefinition, value } = this
        if (value === undefined || value === "") return undefined

        const { options } = cellTypeDefinition
        const optionsLine = options
            ? `Options: ${options.join(", ")}`
            : undefined
        return [this.cellTypeDefinition.description, optionsLine]
            .filter(isPresent)
            .join("\n")
    }

    get cssClasses() {
        if (!this.isValid) return [ErrorCellTypeClass]
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
