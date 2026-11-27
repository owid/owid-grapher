// A minimal S-expression parser for the admin's filter DSL, e.g.
// `(AND (= /type "LineChart") (> /yAxis/max 100))`.
//
// Lists become arrays, double-quoted strings become `string` nodes and every
// other token (numbers, booleans, function names, JSON pointers, column names)
// becomes a `symbol` node. Interpreting symbols is up to the caller.

export interface SExprSymbol {
    type: "symbol"
    value: string
}

export interface SExprString {
    type: "string"
    value: string
}

export type SExpr = SExprSymbol | SExprString | SExpr[]

export class SExpressionSyntaxError extends Error {
    constructor(
        message: string,
        public position: number
    ) {
        super(`Syntax error at position ${position}: ${message}`)
        this.name = "SExpressionSyntaxError"
    }
}

const whitespaceRegex = /\s/
// Characters that end a symbol
const delimiterRegex = /[\s()"]/
// Characters that have a meaning in other Lisps (quoting, escaping) but not in
// our DSL. They're rejected outside strings rather than silently misread.
const reservedRegex = /['`,\\]/

const stringEscapes: Record<string, string> = {
    n: "\n",
    t: "\t",
    r: "\r",
    f: "\f",
    b: "\b",
}

/**
 * Parses a single S-expression. Returns undefined for empty or
 * whitespace-only input.
 *
 * @throws {SExpressionSyntaxError} On unbalanced parentheses, unterminated
 *   strings, reserved characters outside strings, or more than one
 *   top-level expression.
 */
export function parseSExpression(source: string): SExpr | undefined {
    let pos = 0

    const skipWhitespace = (): void => {
        while (pos < source.length && whitespaceRegex.test(source[pos])) pos++
    }

    const parseString = (): SExprString => {
        const start = pos
        pos++ // opening quote
        let value = ""
        while (pos < source.length) {
            const char = source[pos]
            if (char === '"') {
                pos++
                return { type: "string", value }
            }
            if (char === "\\") {
                pos++
                if (pos >= source.length) break
                const escaped = source[pos]
                value += stringEscapes[escaped] ?? escaped
            } else {
                value += char
            }
            pos++
        }
        throw new SExpressionSyntaxError("Unterminated string", start)
    }

    const parseSymbol = (): SExprSymbol => {
        const start = pos
        while (pos < source.length && !delimiterRegex.test(source[pos])) {
            if (reservedRegex.test(source[pos]))
                throw new SExpressionSyntaxError(
                    `Unexpected character \`${source[pos]}\` (only allowed inside double-quoted strings)`,
                    pos
                )
            pos++
        }
        return { type: "symbol", value: source.slice(start, pos) }
    }

    const parseList = (): SExpr[] => {
        const start = pos
        pos++ // opening paren
        const items: SExpr[] = []
        while (true) {
            skipWhitespace()
            if (pos >= source.length)
                throw new SExpressionSyntaxError("Unclosed `(`", start)
            if (source[pos] === ")") {
                pos++
                return items
            }
            items.push(parseExpression())
        }
    }

    const parseExpression = (): SExpr => {
        const char = source[pos]
        if (char === "(") return parseList()
        if (char === ")")
            throw new SExpressionSyntaxError("Unexpected `)`", pos)
        if (char === '"') return parseString()
        return parseSymbol()
    }

    skipWhitespace()
    if (pos >= source.length) return undefined
    const expression = parseExpression()
    skipWhitespace()
    if (pos < source.length)
        throw new SExpressionSyntaxError(
            "Unexpected input after the expression",
            pos
        )
    return expression
}
