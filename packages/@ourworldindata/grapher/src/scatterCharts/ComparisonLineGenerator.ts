import Formula from "fparser"
import { scaleLinear, scaleLog } from "d3-scale"
import { ScaleType } from "@ourworldindata/types"

export function generateComparisonLinePoints(
    lineFunction: string = "x",
    xScaleDomain: [number, number],
    yScaleDomain: [number, number],
    xScaleType: ScaleType,
    yScaleType: ScaleType
): [number, number][] {
    const formula = parseEquation(lineFunction)
    const yFunc = (x: number): number | undefined =>
        evalFormula(formula, { x }, undefined)

    // Construct control data by running the equation across sample points
    const numPoints = 500

    const scaleFunction = xScaleType === ScaleType.log ? scaleLog : scaleLinear
    const scale = scaleFunction().domain(xScaleDomain).range([0, numPoints])

    const controlData: Array<[number, number]> = []
    for (let i = 0; i < numPoints; i++) {
        const x = scale.invert(i)
        const y = yFunc(x)

        if (y === undefined || Number.isNaN(x) || Number.isNaN(y)) continue
        if (xScaleType === ScaleType.log && x <= 0) continue
        if (yScaleType === ScaleType.log && y <= 0) continue
        if (y > yScaleDomain[1]) continue
        controlData.push([x, y])
    }

    return controlData
}

export function evalFormula<D>(
    expr: Formula | undefined,
    context: Record<string, number>,
    defaultOnError: D
): number | D {
    if (expr === undefined) return defaultOnError
    try {
        return expr.evaluate(context) as number
    } catch {
        return defaultOnError
    }
}

export function parseEquation(equation: string): Formula | undefined {
    try {
        const formula = new Formula(equation)
        formula.ln = Math.log
        formula.e = Math.E
        return formula
    } catch (e) {
        console.error(e)
        return undefined
    }
}
