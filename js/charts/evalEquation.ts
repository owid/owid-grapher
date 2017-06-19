import {Parser} from 'expr-eval'

export default function evalEquation(equation, context, defaultOnError) {
    try {
        const parser = new Parser()
        const expr = parser.parse(equation)
        return expr.evaluate(context)
    } catch (e) {
        //console.error(e)
        return defaultOnError
    }
}