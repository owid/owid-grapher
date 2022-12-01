#! /usr/bin/env jest
import { variableAnnotationAllowedColumnNamesAndTypes } from "./AdminSessionTypes.js"
import {
    parseToOperation,
    NumberAtom,
    StringAtom,
    BooleanAtom,
    JsonPointerSymbol,
    Operation,
    ArithmeticOperation,
    BinaryLogicOperation,
    ArithmeticOperator,
    ComparisonOperator,
    NumericComparison,
    allBinaryLogicOperators,
    allComparisonOperators,
    BinaryLogicOperators,
    EqualityComparision,
    EqualityOperator,
    StringContainsOperation,
    OperationContext,
} from "./SqlFilterSExpression.js"
const context: OperationContext = {
    grapherConfigFieldName: "grapherConfig",
    whitelistedColumnNamesAndTypes:
        variableAnnotationAllowedColumnNamesAndTypes,
}
function checkIsomorphism(operation: Operation): void {
    return expect(parseToOperation(operation.toSExpr(), context)).toEqual(
        operation
    )
}

function checkSql(sExpr: string, expectedSql: string | undefined): void {
    return expect(parseToOperation(sExpr, context)?.toSql()).toEqual(
        expectedSql
    )
}

describe("parse simple filters expressions", () => {
    it("should parse atoms correctly", async () => {
        expect(parseToOperation("", context)).toEqual(undefined)
        expect(parseToOperation("()", context)).toEqual(undefined)
        expect(parseToOperation("43", context)).toEqual(new NumberAtom(43))
        expect(parseToOperation(`"hello"`, context)).toEqual(
            new StringAtom("hello")
        )

        expect(parseToOperation("true", context)).toEqual(new BooleanAtom(true))
        expect(parseToOperation("false", context)).toEqual(
            new BooleanAtom(false)
        )
        expect(parseToOperation("/jsonPointer/4", context)).toEqual(
            new JsonPointerSymbol("/jsonPointer/4", context)
        )
    })
    it("should round-trip atoms correctly", async () => {
        checkIsomorphism(new NumberAtom(42))
        checkIsomorphism(new StringAtom("hello"))
        checkIsomorphism(new BooleanAtom(true))
        checkIsomorphism(new JsonPointerSymbol("/jsonPointer/4", context))
    })
    it("should round-trip odd values correctly", async () => {
        checkIsomorphism(new NumberAtom(-42))
        // checkIsomorphism(new NumberAtom(Number.NaN)) - we don't support NaN for now
        checkIsomorphism(new NumberAtom(Number.POSITIVE_INFINITY))
        checkIsomorphism(new NumberAtom(Number.NEGATIVE_INFINITY))
        checkIsomorphism(new StringAtom(""))
        checkIsomorphism(new StringAtom("🔥"))
        checkIsomorphism(new StringAtom('"'))
        checkIsomorphism(new StringAtom("'"))
        checkIsomorphism(new StringAtom("\\ hello \\"))
        checkIsomorphism(new StringAtom('\\" hello'))
        checkIsomorphism(new StringAtom("\\' hello"))
    })
    it("should round trip arithmetic operations correctly", async () => {
        checkIsomorphism(
            new ArithmeticOperation(ArithmeticOperator.addition, [
                new NumberAtom(5),
                new NumberAtom(42),
                new NumberAtom(17),
            ])
        )
        checkIsomorphism(
            new ArithmeticOperation(ArithmeticOperator.subtraction, [
                new NumberAtom(5),
                new NumberAtom(42),
                new NumberAtom(17),
            ])
        )
        checkIsomorphism(
            new ArithmeticOperation(ArithmeticOperator.multiplication, [
                new NumberAtom(5),
                new NumberAtom(42),
                new NumberAtom(17),
            ])
        )
        checkIsomorphism(
            new ArithmeticOperation(ArithmeticOperator.division, [
                new NumberAtom(5),
                new NumberAtom(42),
                new NumberAtom(17),
            ])
        )
    })
    it("should round trip comparision operations correctly", async () => {
        const compCreator = (op: ComparisonOperator): NumericComparison =>
            new NumericComparison(op, [new NumberAtom(5), new NumberAtom(42)])
        allComparisonOperators.forEach((op) =>
            checkIsomorphism(compCreator(op))
        )
    })
    it("should round trip binary logic operations correctly", async () => {
        checkIsomorphism(
            new StringContainsOperation(
                new JsonPointerSymbol("/map/projection", context),
                new StringAtom("Europe")
            )
        )
    })
    it("should round trip string contains operations correctly", async () => {
        const compCreator = (op: BinaryLogicOperators): BinaryLogicOperation =>
            new BinaryLogicOperation(op, [
                new BooleanAtom(true),
                new EqualityComparision(EqualityOperator.unequal, [
                    new NumberAtom(5),
                    new NumberAtom(42),
                ]),
            ])
        allBinaryLogicOperators.forEach((op) =>
            checkIsomorphism(compCreator(op))
        )
    })
})

describe("transpile to expected SQL", () => {
    it("should transpile atoms correctly to SQL", async () => {
        checkSql("", undefined)
        checkSql("42", "42")
        checkSql(`"hello"`, "'hello'")
        checkSql(`true`, "true")
    })

    it("should transpile simple operations correctly to SQL", async () => {
        checkSql("(+ 4 3)", "(4+3)")
        checkSql("(- 4 1 2)", "(4-1-2)")
        checkSql("(* 4 1 2)", "(4*1*2)")
        checkSql("(/ 4 1 2)", "(4/1/2)")
        checkSql("(= 4 3)", "(4 = 3)")
        checkSql("(<> 4 1)", "(4 <> 1)")
        checkSql("(< 4 3)", "(4 < 3)")
        checkSql("(<= 4 1)", "(4 <= 1)")
        checkSql("(> 4 3)", "(4 > 3)")
        checkSql("(>= 4 1)", "(4 >= 1)")
        checkSql("(AND true false false)", "(true AND false AND false)")
        checkSql("(OR true false false)", "(true OR false OR false)")
        checkSql("(NOT true)", "(NOT true)")
        checkSql(
            '(CONTAINS /map/projection "Europe")',
            "(JSON_EXTRACT(grapherConfig, \"$.map.projection\") COLLATE utf8mb4_0900_ai_ci LIKE '%Europe%')"
        )
        checkSql('(= "hello" "hello")', "('hello' = 'hello')")
        checkSql('(= "hello\\\\" "hello")', "('hello\\\\' = 'hello')")
        checkSql(
            '(= "hello\'; DROP TABLE USER" "hello")',
            "('hello''; DROP TABLE USER' = 'hello')"
        )
    })

    it("Should error on invalid s-expressions", async () => {
        expect(() => parseToOperation("(", context)).toThrow() // unbalanced parens
        expect(() => parseToOperation(")", context)).toThrow() // unbalanced parens
        expect(() => parseToOperation("((( ))", context)).toThrow() // unbalanced parens
        expect(() => parseToOperation('((( ")"))', context)).toThrow() // unbalanced parens
        expect(() => parseToOperation('(")', context)).toThrow() // unbalanced double quotes
        expect(() => parseToOperation("(= 1 2 3)", context)).toThrow() // binary arity exceeded
        expect(() => parseToOperation("(1 2)", context)).toThrow() // non-function in prime position
        expect(() => parseToOperation("(= 1)", context)).toThrow() // arity too low
        expect(() => parseToOperation("(+ 1 2) (+ 1 2)", context)).toThrow() // multiple top level expressions
        expect(() => parseToOperation('(+ "hello" "world")', context)).toThrow() // type mismatch
    })

    it("should transpile some more complicated expressions correctly to SQL", async () => {
        checkSql(
            "(AND (NOT (< 1 2)) (= /firstYear /map/lastYear) (<> (/ 1 2) (/ 2 (+ 1 1))))",
            `((NOT (1 < 2)) AND (JSON_EXTRACT(grapherConfig, "$.firstYear") = JSON_EXTRACT(grapherConfig, "$.map.lastYear")) AND ((1/2) <> (2/(1+1))))`
        )
    })
})
