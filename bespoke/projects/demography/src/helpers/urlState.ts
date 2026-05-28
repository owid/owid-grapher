import { queryParamsToStr, strToQueryParams } from "@ourworldindata/utils"
import { codeToEntityName, entityNameToCode } from "@ourworldindata/grapher"

import { CONTROL_YEARS, START_YEAR, END_YEAR } from "./constants.js"
import { isValidParameterKey, type ParameterKey } from "./types.js"
import type { ScenarioParams } from "../model/scenarios.js"

export const DEMOGRAPHY_COUNTRY_PARAM = "demographyCountry"
export const DEMOGRAPHY_FERTILITY_PARAM = "demographyFertility"
export const DEMOGRAPHY_LIFE_EXPECTANCY_PARAM = "demographyLifeExpectancy"
export const DEMOGRAPHY_NET_MIGRATION_PARAM = "demographyNetMigration"
export const DEMOGRAPHY_TAB_PARAM = "demographyTab"
export const DEMOGRAPHY_YEAR_PARAM = "demographyYear"

const DEMOGRAPHY_URL_PARAM_KEYS = [
    DEMOGRAPHY_COUNTRY_PARAM,
    DEMOGRAPHY_FERTILITY_PARAM,
    DEMOGRAPHY_LIFE_EXPECTANCY_PARAM,
    DEMOGRAPHY_NET_MIGRATION_PARAM,
    DEMOGRAPHY_TAB_PARAM,
    DEMOGRAPHY_YEAR_PARAM,
] as const

const ASSUMPTION_PARAM_CONFIG = {
    fertilityRate: {
        param: DEMOGRAPHY_FERTILITY_PARAM,
        decimals: 1,
    },
    lifeExpectancy: {
        param: DEMOGRAPHY_LIFE_EXPECTANCY_PARAM,
        decimals: 0,
    },
    netMigrationRate: {
        param: DEMOGRAPHY_NET_MIGRATION_PARAM,
        decimals: 1,
    },
} as const

type AssumptionParamKey = keyof typeof ASSUMPTION_PARAM_CONFIG

export function isControlPointModified(
    userVal: number,
    refVal: number,
    parameterKey: AssumptionParamKey
): boolean {
    const { decimals } = ASSUMPTION_PARAM_CONFIG[parameterKey]
    return formatNumber(userVal, decimals) !== formatNumber(refVal, decimals)
}

export interface SimulationUrlState {
    entityName?: string
    fertilityRateAssumptions?: Record<number, number>
    lifeExpectancyAssumptions?: Record<number, number>
    netMigrationRateAssumptions?: Record<number, number>
    tab?: ParameterKey
    year?: number
}

export interface SimulationUrlWriteState {
    entityName: string
    baselineEntityName?: string
    includeEntityName: boolean
    scenarioParams: ScenarioParams
    baselineScenarioParams: ScenarioParams
    tab: ParameterKey
    baselineTab: ParameterKey
    year: number
    baselineYear: number
}

export function parseSimulationUrlState(
    queryStr = typeof window !== "undefined" ? window.location.search : ""
): SimulationUrlState {
    const params = strToQueryParams(queryStr)
    const entityCode = getStringParam(params[DEMOGRAPHY_COUNTRY_PARAM])
    const entityName = entityCode ? codeToEntityName(entityCode) : undefined

    return {
        entityName,
        fertilityRateAssumptions: parseAssumptionParam(
            params[DEMOGRAPHY_FERTILITY_PARAM]
        ),
        lifeExpectancyAssumptions: parseAssumptionParam(
            params[DEMOGRAPHY_LIFE_EXPECTANCY_PARAM]
        ),
        netMigrationRateAssumptions: parseAssumptionParam(
            params[DEMOGRAPHY_NET_MIGRATION_PARAM]
        ),
        tab: parseTabParam(params[DEMOGRAPHY_TAB_PARAM]),
        year: parseYearParam(params[DEMOGRAPHY_YEAR_PARAM]),
    }
}

export function updateWindowUrlForSimulationState(
    state: SimulationUrlWriteState
): void {
    if (typeof window === "undefined") return

    const currentParams = strToQueryParams(window.location.search)
    for (const key of DEMOGRAPHY_URL_PARAM_KEYS) {
        delete currentParams[key]
    }

    const demographyParams = simulationStateToQueryParams(state)
    const nextQueryStr = queryParamsToStr({
        ...currentParams,
        ...demographyParams,
    })

    const currentQueryStr = window.location.search
    if (nextQueryStr === currentQueryStr) return

    history.replaceState(
        null,
        document.title,
        window.location.pathname + nextQueryStr + window.location.hash
    )
}

export function simulationStateToQueryParams(
    state: SimulationUrlWriteState
): Record<string, string> {
    const params: Record<string, string> = {}

    if (
        state.includeEntityName &&
        state.entityName &&
        state.entityName !== state.baselineEntityName
    ) {
        params[DEMOGRAPHY_COUNTRY_PARAM] = entityNameToCode(state.entityName)
    }

    for (const [key, config] of Object.entries(ASSUMPTION_PARAM_CONFIG)) {
        const parameterKey = key as keyof typeof ASSUMPTION_PARAM_CONFIG
        if (
            !areControlPointsEqual(
                state.scenarioParams[parameterKey],
                state.baselineScenarioParams[parameterKey],
                config.decimals
            )
        ) {
            params[config.param] = serializeAssumptionParam(
                state.scenarioParams[parameterKey],
                state.baselineScenarioParams[parameterKey],
                config.decimals
            )
        }
    }

    if (state.tab !== state.baselineTab) {
        params[DEMOGRAPHY_TAB_PARAM] = state.tab
    }

    if (state.year !== state.baselineYear) {
        params[DEMOGRAPHY_YEAR_PARAM] = String(state.year)
    }

    return params
}

function getStringParam(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    return trimmed || undefined
}

function parseAssumptionParam(
    value: string | undefined
): Record<number, number> | undefined {
    if (!value) return undefined

    const parts = value.split(",")
    const result: Record<number, number> = {}

    for (let i = 0; i < CONTROL_YEARS.length; i++) {
        const raw = parts[i]?.trim()
        if (!raw) continue

        const parsed = Number(raw)
        if (Number.isFinite(parsed)) {
            result[CONTROL_YEARS[i]] = parsed
        }
    }

    return Object.keys(result).length > 0 ? result : undefined
}

function serializeAssumptionParam(
    points: Record<number, number>,
    baseline: Record<number, number>,
    decimals: number
): string {
    return CONTROL_YEARS.map((year) => {
        const formatted = formatNumber(points[year], decimals)
        if (formatted === formatNumber(baseline[year], decimals)) return ""
        return formatted
    }).join(",")
}

function areControlPointsEqual(
    current: Record<number, number>,
    baseline: Record<number, number>,
    decimals: number
): boolean {
    return CONTROL_YEARS.every(
        (year) =>
            formatNumber(current[year], decimals) ===
            formatNumber(baseline[year], decimals)
    )
}

function formatNumber(value: number, decimals: number): string {
    return value.toFixed(decimals)
}

function parseTabParam(value: string | undefined): ParameterKey | undefined {
    const trimmed = value?.trim()
    return isValidParameterKey(trimmed) ? trimmed : undefined
}

function parseYearParam(value: string | undefined): number | undefined {
    if (!value) return undefined
    const n = Number(value)
    if (!Number.isInteger(n)) return undefined
    if (n < START_YEAR || n > END_YEAR) return undefined
    return n
}
