/**
 * Population stabilization via binary search + gradient descent.
 *
 * Given current scenario parameters, finds values for one parameter type
 * (TFR, life expectancy, or migration) that keep the total population
 * roughly constant from HISTORICAL_END_YEAR to END_YEAR.
 *
 * The first control point is kept fixed; only later points are adjusted.
 */

import type { ScenarioParams } from "./scenarios"
import type { BaselineParams } from "./model"
import { getTotalPopulationFromArrays } from "./model"
import {
    runProjectionFinalPopulation,
    runProjectionTrajectory,
} from "./projectionRunner"
import { ParameterKey, PopulationBySex } from "../helpers/types.js"
import {
    CONTROL_YEARS,
    END_YEAR,
    HISTORICAL_END_YEAR,
} from "../helpers/constants.js"

const OPTIMIZATION_CONFIG: Record<
    ParameterKey,
    {
        epsilon: number
        learningRate: number
        bounds: { min: number; max: number }
    }
> = {
    fertilityRate: {
        epsilon: 0.05,
        learningRate: 0.15,
        bounds: { min: 0.5, max: 6.0 },
    },
    lifeExpectancy: {
        epsilon: 0.5,
        learningRate: 0.8,
        bounds: { min: 40, max: 130 },
    },
    netMigrationRate: {
        epsilon: 1.0,
        learningRate: 2.5,
        bounds: { min: -30, max: 50 },
    },
}

const MAX_ITERATIONS_PER_POINT = 8
const CONVERGENCE_THRESHOLD = 0.001

interface ProjectionContext {
    startPopulation: PopulationBySex
    baselineParams: BaselineParams
}

function runTrajectory(
    params: ScenarioParams,
    ctx: ProjectionContext
): Record<number, number> {
    return runProjectionTrajectory({
        startPopulation: ctx.startPopulation,
        baselineParams: ctx.baselineParams,
        scenarioParams: params,
        historicalEndYear: HISTORICAL_END_YEAR,
        endYear: END_YEAR,
        controlYears: CONTROL_YEARS,
    })
}

function runFinalPop(params: ScenarioParams, ctx: ProjectionContext): number {
    return runProjectionFinalPopulation({
        startPopulation: ctx.startPopulation,
        baselineParams: ctx.baselineParams,
        scenarioParams: params,
        historicalEndYear: HISTORICAL_END_YEAR,
        endYear: END_YEAR,
        controlYears: CONTROL_YEARS,
    })
}

function cloneParams(p: ScenarioParams): ScenarioParams {
    return {
        fertilityRate: { ...p.fertilityRate },
        lifeExpectancy: { ...p.lifeExpectancy },
        netMigrationRate: { ...p.netMigrationRate },
    }
}

function computeTrajectoryError(
    trajectory: Record<number, number>,
    targetPop: number,
    controlYear: number
): number {
    let weightedSumSq = 0
    let totalWeight = 0

    for (let year = HISTORICAL_END_YEAR + 1; year <= END_YEAR; year++) {
        const pop = trajectory[year]
        if (pop === undefined) continue

        const deviation = pop - targetPop
        let weight = year >= controlYear ? 2.0 : 1.0
        const yearsFromStart = year - HISTORICAL_END_YEAR
        weight *= Math.pow(0.99, yearsFromStart)

        weightedSumSq += weight * deviation * deviation
        totalWeight += weight
    }

    return totalWeight > 0 ? Math.sqrt(weightedSumSq / totalWeight) : 0
}

function computeNumericalGradient(
    params: ScenarioParams,
    parameterKey: ParameterKey,
    controlYear: number,
    targetPop: number,
    ctx: ProjectionContext
): { gradient: number; errorPlus: number; errorMinus: number } {
    const config = OPTIMIZATION_CONFIG[parameterKey]
    const epsilon = config.epsilon
    const currentValue = params[parameterKey][controlYear]

    const paramsPlus = cloneParams(params)
    paramsPlus[parameterKey][controlYear] = Math.min(
        currentValue + epsilon,
        config.bounds.max
    )

    const paramsMinus = cloneParams(params)
    paramsMinus[parameterKey][controlYear] = Math.max(
        currentValue - epsilon,
        config.bounds.min
    )

    const trajectoryPlus = runTrajectory(paramsPlus, ctx)
    const trajectoryMinus = runTrajectory(paramsMinus, ctx)

    const errorPlus = computeTrajectoryError(
        trajectoryPlus,
        targetPop,
        controlYear
    )
    const errorMinus = computeTrajectoryError(
        trajectoryMinus,
        targetPop,
        controlYear
    )

    const actualEpsilon =
        paramsPlus[parameterKey][controlYear] -
        paramsMinus[parameterKey][controlYear]
    const gradient =
        actualEpsilon > 0 ? (errorPlus - errorMinus) / actualEpsilon : 0

    return { gradient, errorPlus, errorMinus }
}

function optimizeControlPoint(
    params: ScenarioParams,
    parameterKey: ParameterKey,
    controlYear: number,
    targetPop: number,
    ctx: ProjectionContext
): void {
    const config = OPTIMIZATION_CONFIG[parameterKey]
    let currentValue = params[parameterKey][controlYear]
    let learningRate = config.learningRate
    let bestValue = currentValue
    let bestError = Infinity

    for (let i = 0; i < MAX_ITERATIONS_PER_POINT; i++) {
        const { gradient, errorPlus, errorMinus } = computeNumericalGradient(
            params,
            parameterKey,
            controlYear,
            targetPop,
            ctx
        )

        const currentError = (errorPlus + errorMinus) / 2

        if (currentError < bestError) {
            bestError = currentError
            bestValue = currentValue
        }

        if (Math.abs(gradient) < 1e-10) break

        const adaptiveLR = Math.min(
            learningRate,
            (Math.abs(currentValue - config.bounds.min) /
                (Math.abs(gradient) + 1e-6)) *
                0.3,
            (Math.abs(config.bounds.max - currentValue) /
                (Math.abs(gradient) + 1e-6)) *
                0.3
        )

        const newValue = Math.max(
            config.bounds.min,
            Math.min(config.bounds.max, currentValue - adaptiveLR * gradient)
        )

        const relativeChange =
            Math.abs(newValue - currentValue) / (Math.abs(currentValue) + 1e-6)
        if (relativeChange < CONVERGENCE_THRESHOLD) break

        currentValue = newValue
        params[parameterKey][controlYear] = currentValue
        learningRate *= 0.85
    }

    params[parameterKey][controlYear] = bestValue
}

function findStableParameterValue(
    scenarioParams: ScenarioParams,
    parameterKey: ParameterKey,
    fixedControlYears: Set<number>,
    ctx: ProjectionContext,
    targetPop: number
): number {
    const config = OPTIMIZATION_CONFIG[parameterKey]
    let lo = config.bounds.min
    let hi = config.bounds.max
    let bestValue = (lo + hi) / 2
    let bestError = Infinity

    function createTestParams(value: number): ScenarioParams {
        const p = cloneParams(scenarioParams)
        for (const year of CONTROL_YEARS) {
            if (fixedControlYears.has(year)) continue
            p[parameterKey][year] = value
        }
        return p
    }

    for (let i = 0; i < 15; i++) {
        const mid = (lo + hi) / 2
        const testParams = createTestParams(mid)
        const finalPop = runFinalPop(testParams, ctx)
        const popChange = finalPop - targetPop
        const error = Math.abs(popChange)

        if (error < bestError) {
            bestError = error
            bestValue = mid
        }

        if (error < targetPop * 0.001) break

        if (popChange > 0) {
            hi = mid
        } else {
            lo = mid
        }

        if (Math.abs(hi - lo) < 0.0001) break
    }

    return bestValue
}

export interface StabilizeResult {
    params: ScenarioParams
}

/**
 * Find parameter values that stabilize population.
 * Keeps the first control point fixed; adjusts 2050 and 2100.
 */
export function stabilizeParameter(
    parameterKey: ParameterKey,
    scenarioParams: ScenarioParams,
    baselineParams: BaselineParams,
    startPopulation: PopulationBySex
): StabilizeResult {
    const targetPop = getTotalPopulationFromArrays(
        startPopulation.female,
        startPopulation.male
    )

    const ctx: ProjectionContext = { startPopulation, baselineParams }

    const fixedControlYears = new Set([CONTROL_YEARS[0]])
    const adjustableControlYears = CONTROL_YEARS.slice(1)

    // Phase 1: Binary search for initial flat estimate
    const initialValue = findStableParameterValue(
        scenarioParams,
        parameterKey,
        fixedControlYears,
        ctx,
        targetPop
    )

    // Initialize working params
    const params = cloneParams(scenarioParams)
    for (const year of adjustableControlYears) {
        params[parameterKey][year] = initialValue
    }

    // Phase 2: Gradient descent on each adjustable control point
    for (const controlYear of adjustableControlYears) {
        optimizeControlPoint(params, parameterKey, controlYear, targetPop, ctx)
    }

    // Phase 3: Refinement pass
    for (const controlYear of adjustableControlYears) {
        optimizeControlPoint(params, parameterKey, controlYear, targetPop, ctx)
    }

    return { params }
}
