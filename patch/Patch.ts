type PatchEncodedString = string
type PatchCompatibleArray = string[][]
type PatchCompatibleObjectLiteral = {
    [identifierCell: string]: string | string[]
}

type PatchInput =
    | PatchEncodedString
    | PatchCompatibleArray
    | PatchCompatibleObjectLiteral

interface PatchGrammar {
    rowDelimiter: string
    columnDelimiter: string
    encodedRowDelimiter: string
    encodedColumnDelimiter: string
}

export const DefaultPatchGrammar: PatchGrammar = {
    rowDelimiter: "...",
    columnDelimiter: "~",
    encodedRowDelimiter: "%2E%2E%2E",
    encodedColumnDelimiter: "%7E",
}

export class Patch {
    uriEncodedString: PatchEncodedString

    private grammar: PatchGrammar
    constructor(patchInput: PatchInput = "", grammar = DefaultPatchGrammar) {
        this.grammar = grammar

        if (typeof patchInput === "string") this.uriEncodedString = patchInput
        else if (Array.isArray(patchInput))
            this.uriEncodedString = this.arrayToEncodedString(patchInput)
        else this.uriEncodedString = this.objectToEncodedString(patchInput)
    }

    private objectToEncodedString(obj: PatchCompatibleObjectLiteral) {
        return Object.keys(obj)
            .map((identifierCell) => {
                const value = obj[identifierCell]
                const valueCells = value instanceof Array ? value : [value]
                const row = [identifierCell, ...valueCells].map((cell) =>
                    this.encodeCell(cell)
                )
                return row.join(this.grammar.columnDelimiter)
            })
            .join(this.grammar.rowDelimiter)
    }

    private arrayToEncodedString(arr: PatchCompatibleArray) {
        return arr
            .map((line) =>
                line
                    .map((cell) => this.encodeCell(cell))
                    .join(this.grammar.columnDelimiter)
            )
            .join(this.grammar.rowDelimiter)
    }

    get array(): PatchCompatibleArray {
        return this.uriEncodedString
            .split(this.grammar.rowDelimiter)
            .map((line) =>
                line
                    .split(this.grammar.columnDelimiter)
                    .map((cell) => this.decodeCell(cell))
            )
    }

    get object(): PatchCompatibleObjectLiteral {
        const patchObj: PatchCompatibleObjectLiteral = {}
        this.array.forEach((cells) => {
            const identifierCell = cells.shift() as string
            patchObj[identifierCell] = cells.length > 1 ? cells : cells[0] // If a single value, collapse to a simple tuple. todo: sure about this design?
        })
        return patchObj
    }

    private encodeCell(unencodedCell: string) {
        return this.encoders.reduce(
            (str, encoder) => encoder.encode(str),
            unencodedCell
        )
    }

    private decodeCell(encodedCell: PatchEncodedString) {
        return this.encoders
            .slice()
            .reverse()
            .reduce((str, encoder) => encoder.decode(str), encodedCell)
    }

    // The pipeline of encodings. Operations will be run in order for encoding (and reveresed for decoding).
    private encoders: Encoder[] = [
        {
            encode: (str) => encodeURIComponent(str),
            decode: (str) => decodeURIComponent(str),
        },
        {
            encode: (str) =>
                replaceAll(
                    str,
                    this.grammar.columnDelimiter,
                    this.grammar.encodedColumnDelimiter
                ),
            decode: (str) =>
                replaceAll(
                    str,
                    this.grammar.encodedColumnDelimiter,
                    this.grammar.columnDelimiter
                ),
        },
        {
            encode: (str) =>
                replaceAll(
                    str,
                    this.grammar.rowDelimiter,
                    this.grammar.encodedRowDelimiter
                ),
            decode: (str) =>
                replaceAll(
                    str,
                    this.grammar.encodedRowDelimiter,
                    this.grammar.rowDelimiter
                ),
        },
        {
            // Turn "%20" into "+" for prettier urls.
            encode: (str) => str.replace(/\%20/g, "+"),
            decode: (str) => str.replace(/\+/g, "%20"),
        },
    ]
}

interface Encoder {
    encode: (str: string) => string
    decode: (str: string) => string
}

const replaceAll = (str: string, search: string, replace: string) =>
    str.split(search).join(replace)
