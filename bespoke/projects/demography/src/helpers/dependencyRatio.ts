import type { Simulation } from "./useSimulation.js"
import type { AgeZone, PopulationBySex } from "./types.js"
import {
    COLOR_CHILDREN,
    COLOR_WORKING,
    CONTROL_YEARS,
    HISTORICAL_END_YEAR,
    MAX_AGE,
    PYRAMID_AGE_GROUPS,
    RETIREMENT_AGE,
    USER_MODIFIED_COLOR_LIGHT,
    WORKING_AGE,
} from "./constants.js"
import { parseAgeGroup } from "./utils.js"
import { getInterpolatedValue } from "../model/projectionRunner.js"

export type RetirementAgePoints = Record<number, number>

export interface DependencyAgeBreakdown {
    young: number
    working: number
    old: number
    total: number
    youngPct: number
    workingPct: number
    oldPct: number
    dependencyRatio: number
}

export const MIN_RETIREMENT_AGE = 50
export const MAX_RETIREMENT_AGE = 90

export function defaultRetirementAgePoints(): RetirementAgePoints {
    return Object.fromEntries(
        CONTROL_YEARS.map((year) => [year, RETIREMENT_AGE])
    )
}

export function normalizeRetirementAgePoints(
    assumptions?: Record<number, number>
): RetirementAgePoints {
    const defaults = defaultRetirementAgePoints()
    if (!assumptions) return defaults

    return Object.fromEntries(
        CONTROL_YEARS.map((year) => {
            const value = assumptions[year]
            return [year, clampRetirementAge(value ?? defaults[year])]
        })
    )
}

export function clampRetirementAge(age: number): number {
    if (!Number.isFinite(age)) return RETIREMENT_AGE
    return Math.max(
        MIN_RETIREMENT_AGE,
        Math.min(MAX_RETIREMENT_AGE, Math.round(age))
    )
}

export function getRetirementAgeForYear(
    points: RetirementAgePoints,
    year: number
): number {
    return clampRetirementAge(
        getInterpolatedValue(points, year, HISTORICAL_END_YEAR, CONTROL_YEARS)
    )
}

export function computeDependencyAgeBreakdown(
    population: PopulationBySex | null,
    retirementAge: number
): DependencyAgeBreakdown {
    if (!population) {
        return {
            young: 0,
            working: 0,
            old: 0,
            total: 0,
            youngPct: 0,
            workingPct: 0,
            oldPct: 0,
            dependencyRatio: 0,
        }
    }

    const upperAge = clampRetirementAge(retirementAge)
    let young = 0
    let working = 0
    let old = 0

    for (let age = 0; age <= MAX_AGE; age++) {
        const pop = (population.female[age] || 0) + (population.male[age] || 0)
        if (age < WORKING_AGE) {
            young += pop
        } else if (age < upperAge) {
            working += pop
        } else {
            old += pop
        }
    }

    const total = young + working + old
    const dependencyRatio = working === 0 ? 0 : ((young + old) / working) * 100

    return {
        young,
        working,
        old,
        total,
        youngPct: total > 0 ? (young / total) * 100 : 0,
        workingPct: total > 0 ? (working / total) * 100 : 0,
        oldPct: total > 0 ? (old / total) * 100 : 0,
        dependencyRatio,
    }
}

export function getDependencyBreakdownForYear(
    simulation: Simulation,
    retirementAgePoints: RetirementAgePoints,
    year: number
): DependencyAgeBreakdown {
    const retirementAge = getRetirementAgeForYear(retirementAgePoints, year)
    return computeDependencyAgeBreakdown(
        simulation.getPopulationForYear(year),
        retirementAge
    )
}

export function getAgeZonesForRetirementAge(retirementAge: number): AgeZone[] {
    const upperAge = clampRetirementAge(retirementAge)
    const ageGroupLabels = [...PYRAMID_AGE_GROUPS].reverse()

    const retired: string[] = []
    const working: string[] = []
    const children: string[] = []

    for (const label of ageGroupLabels) {
        const { startAge, endAge } = parseAgeGroup(label)
        if (endAge >= upperAge) {
            retired.push(label)
        } else if (startAge >= WORKING_AGE) {
            working.push(label)
        } else {
            children.push(label)
        }
    }

    return [
        {
            zone: "retired",
            label: `Retired (${upperAge}+)`,
            color: USER_MODIFIED_COLOR_LIGHT,
            ageGroups: retired,
        },
        {
            zone: "working",
            label: "",
            color: COLOR_WORKING,
            ageGroups: working,
        },
        {
            zone: "children",
            label: `Children (<${WORKING_AGE})`,
            color: COLOR_CHILDREN,
            ageGroups: children,
        },
    ]
}
