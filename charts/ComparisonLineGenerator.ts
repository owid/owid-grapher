import { Parser, Expression } from "expr-eval"
import { scaleLinear, scaleLog } from "d3-scale"
import { ScaleType } from "./ChartConstants"

export function generateComparisonLinePoints(
    lineFunction: string = "x",
    xScaleDomain: [number, number],
    yScaleDomain: [number, number],
    xScaleType: ScaleType,
    yScaleType: ScaleType
) {
    const expr = parseEquation(lineFunction)?.simplify({
        e: Math.E,
        pi: Math.PI
    })
    const yFunc = (x: number) => evalExpression(expr, { x }, undefined)

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

        if (y === undefined) continue
        if (xScaleType === "log" && x <= 0) continue
        if (yScaleType === "log" && y <= 0) continue
        if (y > yScaleDomain[1]) continue
        controlData.push([x, y])
    }

    return controlData
}

function evalExpression<D>(
    expr: Expression | undefined,
    context: Record<string, number>,
    defaultOnError: D
) {
    if (expr === undefined) return defaultOnError
    try {
        return expr.evaluate(context) as number
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
