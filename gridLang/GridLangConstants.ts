export const CellHasErrorsClass = "CellHasErrorsClass"

export enum GridBoolean {
    true = "true",
    false = "false",
}

export const GRID_NODE_DELIMITER = "\n"
export const GRID_CELL_DELIMITER = "\t"
export const GRID_EDGE_DELIMITER = "\t"

export type CellCoordinate = number // An integer >= 0

export type Grammar = { [keywordSlug: string]: CellDef }

// A CellDef is a tuple: part keyword and the other half is the contents. The contents can be 1 cell, a list of cells, and/or a subtable.
export interface CellDef {
    keyword: string
    cssClass: string
    description: string
    grammar?: Grammar
    headerCellDef?: CellDef
    terminalOptions?: CellDef[]
    catchAllCellDef?: CellDef // Only used by vertical grammars, this cell def, if present, will be used if a keyword is unrecognized during parsing.
    regex?: RegExp // A validation regex a value must pass. todo: seems like this is overloaded and used for testing keywords and contents.
    requirementsDescription?: string
    valuePlaceholder?: string
    positionalCellDefs?: readonly CellDef[] // Additional cell types as positional arguments.
    isHorizontalList?: boolean // a list type, such as "colors\tred\torange\tgreen"
    parse?: (value: any) => any
}

export interface ParsedCell {
    errorMessage?: string
    cssClasses?: string[]
    optionKeywords?: string[]
    comment?: string
    cellDef?: CellDef
    placeholder?: string
    contents?: any
}

export interface CellPosition {
    row: CellCoordinate
    column: CellCoordinate
}

export const Origin: CellPosition = {
    row: 0,
    column: 0,
}

export const BooleanCellDef: CellDef = {
    keyword: "",
    terminalOptions: [
        { keyword: GridBoolean.true, cssClass: "", description: "" },
        { keyword: GridBoolean.false, cssClass: "", description: "" },
    ],
    cssClass: "BooleanCellDef",
    description: "Boolean",
    parse: (value: any) => value === GridBoolean.true,
}

export const StringCellDef: CellDef = {
    keyword: "",
    cssClass: "StringCellDef",
    description: "",
    parse: (value: any) => `${value}`.replace(/\\n/g, "\n"),
}

export const StringDeclarationDef: CellDef = {
    keyword: "",
    cssClass: "StringDeclarationDef",
    description: "",
}

export const EnumCellDef: CellDef = {
    keyword: "",
    cssClass: "EnumCellDef",
    description: "",
}

export const RootKeywordCellDef: CellDef = {
    keyword: "",
    cssClass: "KeywordCellDef",
    description: "Keyword",
}

export const NumericCellDef: CellDef = {
    keyword: "",
    cssClass: "NumericCellDef",
    description: "",
    regex: /^-?\d+\.?\d*$/,
    requirementsDescription: `Must be a number`,
    valuePlaceholder: "98.6",
    parse: (value: any) => parseFloat(value),
}

export const IntegerCellDef: CellDef = {
    keyword: "",
    cssClass: "IntegerCellDef",
    description: "",
    regex: /^[0-9]+$/,
    requirementsDescription: `Must be an integer`,
    valuePlaceholder: "12345",
    parse: (value: any) => parseInt(value),
}

export const SubTableHeaderCellDef: CellDef = {
    keyword: "",
    cssClass: "SubTableHeaderCellDef",
    description: "",
}

export const SubTableValueCellDef: CellDef = {
    keyword: "",
    cssClass: "SubTableValueCellDef",
    description: "",
}

const MatchUrlsOnlyRegex =
    /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/

export const UrlCellDef: CellDef = {
    keyword: "",
    cssClass: "UrlCellDef",
    description: "",
    regex: MatchUrlsOnlyRegex,
}

export const QueryStringCellDef: CellDef = {
    keyword: "",
    cssClass: "QueryStringCellDef",
    description: "",
}

export const NothingGoesThereCellDef: CellDef = {
    keyword: "",
    cssClass: "NothingGoesThereType",
    description:
        "Nothing should be here. You can make this a comment by prepending a ##",
}

export const CommentCellDef: CellDef = {
    keyword: "",
    cssClass: "CommentType",
    description: "Just a comment.",
    regex: /^(\#\#|💬)/,
}

export const WorkInProgressCellDef: CellDef = {
    keyword: "",
    cssClass: "WorkInProgressCellDef",
    description: "Not a recognized statement. Treating as a work in progress.",
}

export const SlugDeclarationCellDef: CellDef = {
    keyword: "",
    cssClass: "SlugDeclarationType",
    description: "A unique URL-friendly name.",
    regex: /^[a-zA-Z0-9-_]+$/,
    requirementsDescription: `Can only contain the characters a-zA-Z0-9-_`,
}

// This is the name for a cell that is on the "frontier", where the next user input is expected to go. Okay to rename if you have a better word.
export const FrontierCellClass = "ShowDropdownArrow"

export const SlugsDeclarationCellDef: CellDef = {
    keyword: "",
    cssClass: "SlugDeclarationType",
    description: "Unique URL-friendly names.",
    regex: /^[a-zA-Z0-9-_ ]+$/,
    requirementsDescription: `Can only contain the characters a-zA-Z0-9-_ `,
}

export const JSONObjectCellDef: CellDef = {
    keyword: "",
    cssClass: "JSONObjectCellDef",
    description: "JSON object",
    regex: /^\{.*\}$/, // very basic validation that expression starts with { and ends with }
    requirementsDescription: "Must contain a valid JSON object",
}

export type MatrixLine = string[]
export type MatrixProgram = MatrixLine[]
