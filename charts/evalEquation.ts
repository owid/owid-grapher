import { Parser } from "expr-eval"

export function evalEquation(
    equation: string,
    context: { [key: string]: any },
    defaultOnError: any
) {
    try {
        const parser = new Parser()
        const expr = parser.parse(equation)
        return expr.evaluate(context)
    } catch (e) {
        //console.error(e)
        return defaultOnError
    }
}
