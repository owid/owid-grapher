import { Parser, Expression } from "expr-eval"
import { scaleLinear, scaleLog } from "d3-scale"

export function generateComparisonLinePoints(
    lineFunction: string = "x",
    xScaleDomain: [number, number],
    yScaleDomain: [number, number],
    xScaleType: string,
    yScaleType: string
) {
    const expr = parseEquation(lineFunction)
    const yFunc = (x: number) =>
        evalExpression(expr, { x: x, e: Math.E, pi: Math.PI }, x)

    // Construct control data by running the equation across sample points
    const numPoints = 500
    const scaleFunction = xScaleType === "log" ? scaleLog : scaleLinear
    const scale = scaleFunction()
        .domain(xScaleDomain)
        .range([0, numPoints])
    const controlData: Array<[number, number]> = []
    for (let i = 0; i < numPoints; i++) {
        const x = scale.invert(i)
        const y = yFunc(x)

        if (xScaleType === "log" && x <= 0) continue
        if (yScaleType === "log" && y <= 0) continue
        if (y > yScaleDomain[1]) continue
        controlData.push([x, y])
    }

    return controlData
}

function evalExpression(
    expr: Expression | undefined,
    context: Record<string, any>,
    defaultOnError: any
) {
    if (expr === undefined) return defaultOnError
    try {
        return expr.evaluate(context)
    } catch (e) {
        return defaultOnError
    }
}

function parseEquation(equation: string) {
    try {
        return Parser.parse(equation)
    } catch (e) {
        console.error(e)
        return undefined
    }
}
