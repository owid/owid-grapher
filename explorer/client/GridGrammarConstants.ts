export const ErrorCellTypeClass = "ErrorCellType"

export enum GridBoolean {
    true = "true",
    false = "false",
}

export type CellCoordinate = number // An integer >= 0

export type KeywordMap = { [keywordSlug: string]: CellTypeDefinition }

export interface CellTypeDefinition {
    options?: string[]
    cssClass: string
    description: string
    keywordMap?: KeywordMap
    headerKeyword?: CellTypeDefinition
    catchAllKeyword?: CellTypeDefinition
    regex?: RegExp // A validation regex a value must pass
    requirements?: string
    rest?: readonly CellTypeDefinition[] // Additional cell types as positional arguments.
}

export interface ParsedCell {
    errorMessage?: string
    cssClasses?: string[]
    options?: string[]
    comment?: string
}

export interface CellTypeDefinitionWithKeyword extends CellTypeDefinition {
    keyword: string
}

export interface CellLink {
    row: CellCoordinate
    column: CellCoordinate
}

export const BooleanCellTypeDefinition: CellTypeDefinition = {
    options: Object.values(GridBoolean),
    cssClass: "BooleanCellType",
    description: "Boolean",
}

export const StringCellTypeDefinition: CellTypeDefinition = {
    cssClass: "StringCellType",
    description: "",
}

export const IntegerCellTypeDefinition: CellTypeDefinition = {
    cssClass: "IntegerCellType",
    description: "",
    regex: /^[0-9]+$/,
    requirements: `Must be an integer`,
}

export const SubTableHeaderCellTypeDefinition: CellTypeDefinition = {
    cssClass: "SubTableHeaderCellType",
    description: "",
}

export const SubTableWordCellTypeDefinition: CellTypeDefinition = {
    cssClass: "SubTableWordCellType",
    description: "",
}

export const UrlCellTypeDefinition: CellTypeDefinition = {
    cssClass: "UrlCellType",
    description: "",
}

export const NothingGoesThereDefinition: CellTypeDefinition = {
    cssClass: "NothingGoesThereType",
    description: "Nothing should be here.",
}

export const DelimitedUrlDefinition = {
    ...UrlCellTypeDefinition,
    description: "A link to a CSV or TSV",
}

export const SlugDeclarationCellTypeDefinition: CellTypeDefinition = {
    cssClass: "SlugDeclarationType",
    description: "A unique URL-friendly name.",
    regex: /^[a-zA-Z0-9-_]+$/,
    requirements: `Can only contain the characters a-zA-Z0-9-_`,
}

export const FrontierCellClass = "ShowDropdownArrow"

export const SlugsDeclarationCellTypeDefinition: CellTypeDefinition = {
    cssClass: "SlugDeclarationType",
    description: "Unique URL-friendly names.",
    regex: /^[a-zA-Z0-9-_ ]+$/,
    requirements: `Can only contain the characters a-zA-Z0-9-_ `,
}

export type MatrixLine = string[]
export type MatrixProgram = MatrixLine[]

// Abstract keywords: keywords not instantiated by actually typing the word but rather by position.
export const AbstractTypeDefinitions = {
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
