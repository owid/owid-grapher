import parse = require("s-expression")
import pointer from "json8-pointer"
import { isArray, subtract, tail, without } from "lodash"
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

export interface Operation {
    toSql(): string
    toSExpr(): string
    expressionType: ExpressionType
}

abstract class NumericOperation implements Operation {
    abstract toSql(): string
    abstract toSExpr(): string
    expressionType: ExpressionType = ExpressionType.numeric
}

abstract class BooleanOperation implements Operation {
    abstract toSql(): string
    abstract toSExpr(): string
    expressionType: ExpressionType = ExpressionType.boolean
}

abstract class StringOperation implements Operation {
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
    constructor(v: boolean) {
        super()
        this.value = v
    }
    value: boolean
    toSql(): string {
        return this.value.toString()
    }

    toSExpr(): string {
        return this.value.toString()
    }
}

export class NumberAtom extends NumericOperation {
    constructor(v: number) {
        super()
        this.value = v
    }
    value: number
    toSql(): string {
        return this.value.toString()
    }

    toSExpr(): string {
        return this.value.toString()
    }
}

export class StringAtom extends StringOperation {
    constructor(v: string) {
        super()
        this.value = v
    }
    expressionType = ExpressionType.string
    value: string
    toSql(): string {
        return `'${this.value.toString()}'`
    }

    toSExpr(): string {
        return `"${this.value.toString()}"`
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
    static jsonPointerRegex: RegExp = /^[\w\d/-~]+$/
    static columnName: string = "grapherConfig" // TODO: this should come from context
    constructor(v: string) {
        if (!JsonPointerSymbol.jsonPointerRegex.test(v))
            throw Error(`Invalid Json Pointer: ${v} - did not match regex`)
        this.value = v
    }
    arity = Arity.nullary
    expressionType = ExpressionType.any
    value: string
    toSql(): string {
        return `JSON_EXTRACT(${
            JsonPointerSymbol.columnName
        }, "${jsonPointerToJsonPath(this.value.toString())}")`
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
    constructor(operator: ArithmeticOperator, operands: NumericOperation[]) {
        super()
        this.operator = operator
        this.operands = operands
    }

    operator: ArithmeticOperator
    operands: NumericOperation[]
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

export enum ComparisonOperator {
    equal = "=",
    unequal = "<>",
    less = "<",
    lessOrEqual = "<=",
    more = ">",
    moreOrEqual = ">=",
}

export const allComparisionOperators = [
    ComparisonOperator.equal,
    ComparisonOperator.unequal,
    ComparisonOperator.less,
    ComparisonOperator.lessOrEqual,
    ComparisonOperator.more,
    ComparisonOperator.moreOrEqual,
]

export class NumericComparision extends BooleanOperation {
    constructor(
        operator: ComparisonOperator,
        operands: [NumericOperation, NumericOperation]
    ) {
        super()
        this.operator = operator
        this.operands = operands
    }

    operator: ComparisonOperator
    operands: [NumericOperation, NumericOperation]
    toSql(): string {
        return `${this.operands[0].toSql()} ${
            this.operator
        } ${this.operands[1].toSql()}` // we emit too many parenthesis here but don't want to deal with precedence rn
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
    constructor(operator: BinaryLogicOperators, operands: BooleanOperation[]) {
        super()
        this.operator = operator
        this.operands = operands
    }

    operator: BinaryLogicOperators
    operands: BooleanOperation[]
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
    constructor(operand: BooleanOperation) {
        super()
        this.operand = operand
    }

    operand: BooleanOperation
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
    ctor(args: Operation[]): Operation
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
const comparisionOperatorInfos = allComparisionOperators.map(
    (op) =>
        [
            op.toString(),
            {
                arity: Arity.binary,
                operandsType: ExpressionType.numeric,
                ctor: (args: Operation[]): Operation =>
                    new NumericComparision(
                        op,
                        args as [NumericOperation, NumericOperation]
                    ),
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
const operationFactoryMap = new Map<string, OperationInfo>([
    //...(allArithmeticOperators.map(op => [op, {arity: Arity.nary, operandsType: ExpressionType.numeric, ctor: arithMeticCtor}])
    ...arithmeticOperatorInfos,
    ...comparisionOperatorInfos,
    ...binaryLogicOperatorInfos,
    [
        "NOT",
        {
            arity: Arity.unary,
            operandsType: ExpressionType.boolean,
            ctor: (args: Operation[]): Operation => new Negation(args[0]),
        },
    ],
])

export function parseOperationRecursive(
    sExpr: SExprAtom | undefined
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
                throw Error(`Unkown function ${firstElement}!`)

            // Check if the arity matches the number of arguments
            const expectedArgs = arityToNumberMap.get(op.arity)
            const parsedArgs = without(
                tail(sExpr).map(parseOperationRecursive),
                undefined
            ) as Operation[]
            if (
                expectedArgs !== undefined &&
                parsedArgs.length !== expectedArgs
            )
                throw Error(
                    `Function ${firstElement} expected ${expectedArgs} arguments but got ${parsedArgs.length}`
                )

            // Check if the types of the arguments match the expected type for this operation
            if (
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
            return op.ctor(parsedArgs)
        }
    }
    // our s-expression parser library turns quoted strings like "hello" into String instances to
    // differentiate them from unquoted symbols
    else if (sExpr instanceof String) {
        if (sExpr === "") return undefined
        else return new StringAtom(sExpr.valueOf())
    } else if (typeof sExpr === "string") {
        let num: number
        if (sExpr === "") return undefined
        else if (sExpr === "true") return new BooleanAtom(true)
        else if (sExpr === "false") return new BooleanAtom(false)
        // Handling NaN correctly throught the entire DSL is hard - let's see if we can just drop it
        else if (sExpr === "NaN") return undefined
        else if ((num = Number.parseFloat(sExpr))) return new NumberAtom(num)
        else return new JsonPointerSymbol(sExpr) // this will throw if the symbol is not a JsonPointer which is the only valid symbol we know of
    } else throw Error(`Unexpected type in parseToOperation: ${sExpr}!`)
}

export function parseToOperation(
    sexpressionString: string
): Operation | undefined {
    // Use the s-expression library to turn character strings with parens into
    // nested arrays. The parsed datastructure is thus (potentially nested) arrays
    // that contain either string primitives or String instances. This is a bit odd
    // but useful - the latter is used to represent quoted strings, the primitive
    // string is used for everything, which means numbers, booleans and symbols.
    //
    const sExpr = parse(sexpressionString) as SExprAtom
    const result = parseOperationRecursive(sExpr)
    return result
}
