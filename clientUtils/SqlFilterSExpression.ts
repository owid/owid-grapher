import parse from "s-expression"
import pointer from "json8-pointer"
import { isArray, tail, without } from "lodash-es"
// This type models what we get from the s-expression library. This library
// transforms lists in S-Expressions into array, strings inside double quotes
// as String (note the uppercase! It really uses the rarely used String object) and
// all other tokes like numbers or symbols as normal string.
export type SExprAtom = string | String | SExprAtom[] // eslint-disable-line @typescript-eslint/ban-types

export enum Arity {
    nullary = "nullary",
    unary = "unary",
    binary = "binary",
    nary = "nary",
}

const arityToNumberMap = new Map([
    [Arity.nullary, 0],
    [Arity.unary, 1],
    [Arity.binary, 2],
    [Arity.nary, undefined],
])

export interface OperationContext {
    readonly grapherConfigFieldName: string
    readonly whitelistedColumnNamesAndTypes: Map<string, ExpressionType>
}

export interface Operation {
    toSql(): string
    toSExpr(): string
    expressionType: ExpressionType
}

export abstract class NumericOperation implements Operation {
    abstract toSql(): string
    abstract toSExpr(): string
    expressionType: ExpressionType = ExpressionType.numeric
}

export abstract class BooleanOperation implements Operation {
    abstract toSql(): string
    abstract toSExpr(): string
    expressionType: ExpressionType = ExpressionType.boolean
}

export abstract class StringOperation implements Operation {
    abstract toSql(): string
    abstract toSExpr(): string
    expressionType: ExpressionType = ExpressionType.string
}

export enum ExpressionType {
    numeric = "numeric",
    boolean = "boolean",
    string = "string",
    any = "any", // This is used for values we can't type check e.g. jsonpath queries that might return anything
}

export class BooleanAtom extends BooleanOperation {
    constructor(public value: boolean) {
        super()
    }
    toSql(): string {
        return this.value.toString()
    }

    toSExpr(): string {
        return this.value.toString()
    }
}

export class NumberAtom extends NumericOperation {
    constructor(public value: number) {
        super()
    }
    toSql(): string {
        return this.value.toString()
    }

    toSExpr(): string {
        return this.value.toString()
    }
}
const quoteReplaceRegex = /'/g
const backslashReplaceRegex = /\\/g
const doubleQuoteReplaceRegex = /"/g
export class StringAtom extends StringOperation {
    constructor(public value: string) {
        super()
    }
    expressionType = ExpressionType.string
    escapedValue(): string {
        return this.value
            .toString()
            .replace(quoteReplaceRegex, "''")
            .replace(backslashReplaceRegex, "\\\\")
    }
    toSql(): string {
        return `'${this.escapedValue()}'` // escape single quotes to avoid SQL injection attacks :)
    }

    toSExpr(): string {
        return `"${this.value
            .toString()
            .replace(backslashReplaceRegex, "\\\\")
            .replace(doubleQuoteReplaceRegex, '\\"')}"`
    }
}

function jsonPointerToJsonPath(jsonpointer: string): string {
    const pointerFragments = pointer.decode(jsonpointer)
    let path = "$"
    for (const fragment of pointerFragments) {
        const number = Number.parseInt(fragment)
        if (!Number.isNaN(number)) path += `[${number}]`
        else path += `.${fragment}`
    }
    return path
}

export class JsonPointerSymbol implements Operation {
    // Json pointer is actually less restrictive and allows pretty much all unicode
    // code points but for the foreseeable future we will only have \w and \d, _ and -
    // characters in actual use. Tilde is from json pointer to escape / inside field names
    // We also disallow empty jsonPointer for now even though they are legal (if you
    // want to enable them then make sure that the parsing decisions outside of here
    // all correctly allow this)
    static jsonPointerRegex: RegExp = /^\/[\w\d/\-~_]+$/
    columnName: string
    static isValidJsonPointer(str: string): boolean {
        return JsonPointerSymbol.jsonPointerRegex.test(str)
    }
    constructor(public value: string, operationContext: OperationContext) {
        if (!JsonPointerSymbol.isValidJsonPointer(value))
            throw Error(`Invalid Json Pointer: ${value} - did not match regex`)
        this.columnName = operationContext.grapherConfigFieldName
    }
    arity = Arity.nullary
    expressionType = ExpressionType.any
    toSql(): string {
        return `JSON_EXTRACT(${this.columnName}, "${jsonPointerToJsonPath(
            this.value.toString()
        )}")`
    }

    toSExpr(): string {
        return this.value.toString()
    }
}

export class SqlColumnName implements Operation {
    // NOTE: this is a temporary solution for the beginning of using S Expressions for filtering.
    //       Once we start using this in more places, declaring the whitelist of columns that are
    //       valid to query needs to come from the piece of code that wants to use the expression.
    //       I think we should not start allowing expressions that traverse foreign keys and instead
    //       create views and whitelist column names in those if we need more complex filters

    static isValidSqlColumnName(
        str: string,
        operationContext: OperationContext
    ): boolean {
        return operationContext.whitelistedColumnNamesAndTypes.has(str)
    }
    constructor(public value: string, operationContext: OperationContext) {
        if (!SqlColumnName.isValidSqlColumnName(value, operationContext))
            throw Error(
                `Invalid column name: ${value} - did not match the set of allowed columns`
            )
        this.expressionType =
            operationContext.whitelistedColumnNamesAndTypes.get(this.value)!
    }
    arity = Arity.nullary
    expressionType: ExpressionType
    toSql(): string {
        return `${this.value}`
    }

    toSExpr(): string {
        return this.value.toString()
    }
}

export enum ArithmeticOperator {
    addition = "+",
    subtraction = "-",
    multiplication = "*",
    division = "/",
}

export const allArithmeticOperators = [
    ArithmeticOperator.addition,
    ArithmeticOperator.subtraction,
    ArithmeticOperator.multiplication,
    ArithmeticOperator.division,
]

export class ArithmeticOperation extends NumericOperation {
    constructor(
        public operator: ArithmeticOperator,
        public operands: NumericOperation[]
    ) {
        super()
    }

    toSql(): string {
        return `(${this.operands
            .map((operand) => operand.toSql())
            .join(this.operator)})` // we emit too many parenthesis here but don't want to deal with precedence rn
    }

    toSExpr(): string {
        const operands = this.operands.map((op) => op.toSExpr()).join(" ")
        return `(${this.operator} ${operands})`
    }
}

export enum NullCheckOperator {
    isNull = "ISNULL",
    isNotNull = "ISNOTNULL",
}

export const allNullCheckOperators = [
    NullCheckOperator.isNull,
    NullCheckOperator.isNotNull,
]

export class NullCheckOperation extends BooleanOperation {
    constructor(public operator: NullCheckOperator, public operand: Operation) {
        super()
    }

    toSql(): string {
        if (this.operator === NullCheckOperator.isNull)
            return `${this.operand.toSql()} IS NULL`
        else return `${this.operand.toSql()} IS NOT NULL`
    }

    toSExpr(): string {
        return `(${this.operator} ${this.operand.toSExpr()})`
    }
}

export enum EqualityOperator {
    equal = "=",
    unequal = "<>",
}

export const allEqualityOperators = [
    EqualityOperator.equal,
    EqualityOperator.unequal,
]

export class EqualityComparision extends BooleanOperation {
    constructor(
        public operator: EqualityOperator,
        public operands: Operation[]
    ) {
        super()
    }

    toSql(): string {
        return `(${this.operands
            .map((operand) => operand.toSql())
            .join(" " + this.operator + " ")})` // we emit too many parenthesis here but don't want to deal with precedence rn
    }

    toSExpr(): string {
        const operands = this.operands.map((op) => op.toSExpr()).join(" ")
        return `(${this.operator} ${operands})`
    }
}

export class StringContainsOperation extends BooleanOperation {
    constructor(
        public container: StringOperation,
        public searchString: StringAtom
    ) {
        super()
    }

    toSql(): string {
        return `(${this.container.toSql()} LIKE '%${this.searchString.escapedValue()}%')`
    }

    toSExpr(): string {
        return `(CONTAINS ${this.container.toSExpr()} ${this.searchString.toSExpr()})`
    }
}

export enum ComparisonOperator {
    less = "<",
    lessOrEqual = "<=",
    greater = ">",
    greaterOrEqual = ">=",
}

export const allComparisonOperators = [
    ComparisonOperator.less,
    ComparisonOperator.lessOrEqual,
    ComparisonOperator.greater,
    ComparisonOperator.greaterOrEqual,
]

export class NumericComparison extends BooleanOperation {
    constructor(
        public operator: ComparisonOperator,
        public operands: [Operation, Operation]
    ) {
        super()
    }

    toSql(): string {
        return `(${this.operands[0].toSql()} ${
            this.operator
        } ${this.operands[1].toSql()})` // we emit too many parenthesis here but don't want to deal with precedence rn
    }

    toSExpr(): string {
        const operands = this.operands.map((op) => op.toSExpr()).join(" ")
        return `(${this.operator} ${operands})`
    }
}

export enum BinaryLogicOperators {
    and = "AND",
    or = "OR",
}

export const allBinaryLogicOperators = [
    BinaryLogicOperators.and,
    BinaryLogicOperators.or,
]

export class BinaryLogicOperation extends BooleanOperation {
    constructor(
        public operator: BinaryLogicOperators,
        public operands: BooleanOperation[]
    ) {
        super()
    }

    toSql(): string {
        return `(${this.operands
            .map((operand) => operand.toSql())
            .join(" " + this.operator + " ")})` // we emit too many parenthesis here but don't want to deal with precedence rn
    }

    toSExpr(): string {
        const operands = this.operands.map((op) => op.toSExpr()).join(" ")
        return `(${this.operator} ${operands})`
    }
}

export class Negation extends BooleanOperation {
    constructor(public operand: BooleanOperation) {
        super()
    }

    toSql(): string {
        return `(NOT ${this.operand.toSql()})` // we emit too many parenthesis here but don't want to deal with precedence rn
    }

    toSExpr(): string {
        return `(NOT ${this.operand.toSExpr()})`
    }
}

interface OperationInfo {
    arity: Arity
    operandsType: ExpressionType
    ctor(args: Operation[], context: OperationContext): Operation
}

const arithmeticOperatorInfos = allArithmeticOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.nary,
                operandsType: ExpressionType.numeric,
                ctor: (args: Operation[]): Operation =>
                    new ArithmeticOperation(op, args as NumericOperation[]),
            },
        ] as const
)
const equalityOperatorInfos = allEqualityOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.binary,
                operandsType: ExpressionType.any,
                ctor: (args: Operation[]): Operation =>
                    new EqualityComparision(op, args),
            },
        ] as const
)
const comparisionOperatorInfos = allComparisonOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.binary,
                operandsType: ExpressionType.any,
                ctor: (args: Operation[]): Operation =>
                    new NumericComparison(op, args as [Operation, Operation]),
            },
        ] as const
)
const binaryLogicOperatorInfos = allBinaryLogicOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.nary,
                operandsType: ExpressionType.boolean,
                ctor: (args: Operation[]): Operation =>
                    new BinaryLogicOperation(op, args as BooleanOperation[]),
            },
        ] as const
)
const nullCheckOperatorInfos = allNullCheckOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.unary,
                operandsType: ExpressionType.any,
                ctor: (args: Operation[]): Operation =>
                    new NullCheckOperation(op, args[0]),
            },
        ] as const
)
const operationFactoryMap = new Map<string, OperationInfo>([
    //...(allArithmeticOperators.map(op => [op, {arity: Arity.nary, operandsType: ExpressionType.numeric, ctor: arithMeticCtor}])
    ...arithmeticOperatorInfos,
    ...equalityOperatorInfos,
    ...comparisionOperatorInfos,
    ...binaryLogicOperatorInfos,
    ...nullCheckOperatorInfos,
    [
        "NOT",
        {
            arity: Arity.unary,
            operandsType: ExpressionType.boolean,
            ctor: (args: Operation[]): Operation => new Negation(args[0]),
        },
    ],
    [
        "CONTAINS",
        {
            arity: Arity.binary,
            operandsType: ExpressionType.string,
            ctor: (args: Operation[]): Operation =>
                new StringContainsOperation(args[0], args[1] as StringAtom),
        },
    ],
])

export function parseOperationRecursive(
    sExpr: SExprAtom | undefined,
    context: OperationContext
): Operation | undefined {
    if (sExpr === undefined) return undefined
    if (isArray(sExpr)) {
        if (sExpr.length === 0) return undefined
        else {
            const firstElement = sExpr[0]
            // The first element of a list in an SExpression has to be a function. In our
            // parser this means that it has to be of type string which is what symbols end up as
            // (actual verbatim strings that are quoted are String instances and nested lists are arrays)
            if (typeof firstElement !== "string")
                throw Error(
                    `First element in list was not a symbol! ${firstElement}`
                )
            const op = operationFactoryMap.get(firstElement)
            if (op === undefined)
                throw Error(`Unknown function ${firstElement}!`)

            // Check if the arity matches the number of arguments
            const expectedArgs = arityToNumberMap.get(op.arity)
            const parsedArgs = without(
                tail(sExpr).map((subexpr) =>
                    parseOperationRecursive(subexpr, context)
                ),
                undefined
            ) as Operation[]
            if (
                expectedArgs !== undefined &&
                parsedArgs.length !== expectedArgs
            )
                throw Error(
                    `Function ${firstElement} expected ${expectedArgs} arguments but got ${parsedArgs.length}`
                )

            // Check if the types of the arguments match the expected type for this operation unless the operation accepts type "any"
            if (
                op.operandsType !== ExpressionType.any &&
                !parsedArgs.every(
                    (item) =>
                        item.expressionType === op.operandsType ||
                        item.expressionType === ExpressionType.any
                )
            )
                throw Error(
                    `Operation ${firstElement} expected arguments of type ${op.operandsType} but not all arguments were of that type`
                )

            // All checks passed, construct and return the Operator
            return op.ctor(parsedArgs, context)
        }
    }
    // our s-expression parser library turns quoted strings like "hello" into String instances to
    // differentiate them from unquoted symbols
    else if (sExpr instanceof String) {
        if (sExpr === "") return undefined
        else return new StringAtom(sExpr.valueOf())
    } else if (typeof sExpr === "string") {
        const num: number = Number.parseFloat(sExpr)
        if (sExpr === "") return undefined
        else if (sExpr === "true") return new BooleanAtom(true)
        else if (sExpr === "false") return new BooleanAtom(false)
        // Handling NaN correctly throught the entire DSL is hard - let's see if we can just drop it
        else if (sExpr === "NaN") return undefined
        else if (!Number.isNaN(num)) return new NumberAtom(num)
        else if (SqlColumnName.isValidSqlColumnName(sExpr, context))
            return new SqlColumnName(sExpr, context)
        else return new JsonPointerSymbol(sExpr, context) // this will throw if the symbol is not a JsonPointer which is the only valid symbol we know of
    } else throw Error(`Unexpected type in parseToOperation: ${sExpr}!`)
}

export function parseToOperation(
    sexpressionString: string,
    context: OperationContext
): Operation | undefined {
    // Use the s-expression library to turn character strings with parens into
    // nested arrays. The parsed datastructure is thus (potentially nested) arrays
    // that contain either string primitives or String instances. This is a bit odd
    // but useful - the latter is used to represent quoted strings, the primitive
    // string is used for everything, which means numbers, booleans and symbols.
    //
    const sExpr = parse(sexpressionString) as SExprAtom
    const result = parseOperationRecursive(sExpr, context)
    return result
}
