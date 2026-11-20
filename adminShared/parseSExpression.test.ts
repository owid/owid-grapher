import { describe, expect, it } from "vitest"
import { parseSExpression, SExpressionSyntaxError } from "./parseSExpression.js"

const sym = (value: string) => ({ type: "symbol", value })
const str = (value: string) => ({ type: "string", value })

describe(parseSExpression, () => {
    it("parses nested lists, symbols and strings", () => {
        expect(
            parseSExpression('(AND (= /type "LineChart") (> /yAxis/max 1.5))')
        ).toEqual([
            sym("AND"),
            [sym("="), sym("/type"), str("LineChart")],
            [sym(">"), sym("/yAxis/max"), sym("1.5")],
        ])
    })

    it("keeps numbers and booleans as symbols for the caller to interpret", () => {
        expect(parseSExpression("(= true -1e3)")).toEqual([
            sym("="),
            sym("true"),
            sym("-1e3"),
        ])
    })

    it("distinguishes a quoted string from a symbol with the same text", () => {
        expect(parseSExpression('(= true "true")')).toEqual([
            sym("="),
            sym("true"),
            str("true"),
        ])
    })

    it("returns undefined for empty input and an empty array for ()", () => {
        expect(parseSExpression("")).toBeUndefined()
        expect(parseSExpression("  \n ")).toBeUndefined()
        expect(parseSExpression("()")).toEqual([])
    })

    it("handles escapes inside strings", () => {
        // A string ending in an escaped backslash must not swallow the closing quote
        expect(parseSExpression('"hello\\\\"')).toEqual(str("hello\\"))
        expect(parseSExpression('"say \\"hi\\""')).toEqual(str('say "hi"'))
        expect(parseSExpression('"a\\nb\\tc"')).toEqual(str("a\nb\tc"))
        // Unknown escapes keep the escaped character
        expect(parseSExpression('"a\\qb"')).toEqual(str("aqb"))
    })

    it("treats delimiters and special characters inside strings literally", () => {
        expect(parseSExpression("(= \"a (b); c, 'd'\" 1)")).toEqual([
            sym("="),
            str("a (b); c, 'd'"),
            sym("1"),
        ])
    })

    it.each([
        ["(", "unclosed paren"],
        [")", "unexpected closing paren"],
        ["((( ))", "unbalanced parens"],
        ['((( ")"))', "paren inside string doesn't close the list"],
        ['(")', "unterminated string"],
        ['"abc', "unterminated top-level string"],
        ['"abc\\', "string ending in a lone backslash"],
        ["(+ 1 2) (+ 1 2)", "multiple top-level expressions"],
        ["(= 'a 1)", "quote outside a string"],
        ["(= a,b 1)", "comma outside a string"],
        ["(= a\\ b 1)", "backslash outside a string"],
    ])("throws on %s (%s)", (input) => {
        expect(() => parseSExpression(input)).toThrow(SExpressionSyntaxError)
    })
})
