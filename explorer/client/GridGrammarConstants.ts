export const CellHasErrorsClass = "CellHasErrorsClass"

export enum GridBoolean {
    true = "true",
    false = "false",
}

export type CellCoordinate = number // An integer >= 0

export type KeywordMap = { [keywordSlug: string]: CellDef }

export interface CellDef {
    options?: string[]
    cssClass: string
    description: string
    keyword: string
    keywordMap?: KeywordMap
    headerCellDef?: CellDef
    catchAllKeyword?: CellDef
    regex?: RegExp // A validation regex a value must pass
    requirements?: string
    rest?: readonly CellDef[] // Additional cell types as positional arguments.
}

export interface ParsedCell {
    errorMessage?: string
    cssClasses?: string[]
    options?: string[]
    comment?: string
}

export interface CellLink {
    row: CellCoordinate
    column: CellCoordinate
}

export const BooleanCellDef: CellDef = {
    keyword: "",
    options: Object.values(GridBoolean),
    cssClass: "BooleanCellDef",
    description: "Boolean",
}

export const StringCellDef: CellDef = {
    keyword: "",
    cssClass: "StringCellDef",
    description: "",
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

export const IntegerCellDef: CellDef = {
    keyword: "",
    cssClass: "IntegerCellDef",
    description: "",
    regex: /^[0-9]+$/,
    requirements: `Must be an integer`,
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

const MatchUrlsOnlyRegex = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/

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
        "Nothing should be here. You can make this a comment by prepending a #",
}

export const CommentCellDef: CellDef = {
    keyword: "",
    cssClass: "CommentType",
    description: "Just a comment.",
    regex: /^(\#|💬)/,
}

export const DelimitedUrlCellDef: CellDef = {
    ...UrlCellDef,
    description: "A link to a CSV or TSV",
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
    requirements: `Can only contain the characters a-zA-Z0-9-_`,
}

// This is the name for a cell that is on the "frontier", where the next user input is expected to go. Okay to rename if you have a better word.
export const FrontierCellClass = "ShowDropdownArrow"

export const SlugsDeclarationCellDef: CellDef = {
    keyword: "",
    cssClass: "SlugDeclarationType",
    description: "Unique URL-friendly names.",
    regex: /^[a-zA-Z0-9-_ ]+$/,
    requirements: `Can only contain the characters a-zA-Z0-9-_ `,
}

export type MatrixLine = string[]
export type MatrixProgram = MatrixLine[]
