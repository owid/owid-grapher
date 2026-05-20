import { describe, expect, it } from "vitest"

import type { ScenarioParams } from "../model/scenarios"
import {
    DEMOGRAPHY_COUNTRY_PARAM,
    DEMOGRAPHY_FERTILITY_PARAM,
    DEMOGRAPHY_LIFE_EXPECTANCY_PARAM,
    DEMOGRAPHY_NET_MIGRATION_PARAM,
    DEMOGRAPHY_RETIREMENT_AGE_PARAM,
    parseSimulationUrlState,
    simulationStateToQueryParams,
} from "./urlState"

const baselineScenarioParams: ScenarioParams = {
    fertilityRate: { 2030: 1.4, 2050: 1.5, 2100: 1.6 },
    lifeExpectancy: { 2030: 80, 2050: 85, 2100: 90 },
    netMigrationRate: { 2030: 0, 2050: 0.5, 2100: 1 },
}

describe(parseSimulationUrlState, () => {
    it("parses country and assumption params", () => {
        expect(
            parseSimulationUrlState(
                "?demographyCountry=Japan&demographyFertility=1.2,1.4,1.7&demographyLifeExpectancy=84,88,92&demographyNetMigration=-1,0,1&demographyRetirementAge=65,67,70"
            )
        ).toEqual({
            entityName: "Japan",
            fertilityRateAssumptions: { 2030: 1.2, 2050: 1.4, 2100: 1.7 },
            lifeExpectancyAssumptions: { 2030: 84, 2050: 88, 2100: 92 },
            netMigrationRateAssumptions: { 2030: -1, 2050: 0, 2100: 1 },
            retirementAgeAssumptions: { 2030: 65, 2050: 67, 2100: 70 },
        })
    })

    it("skips empty and invalid assumption entries", () => {
        expect(
            parseSimulationUrlState("?demographyFertility=1.2,nope,1.7")
                .fertilityRateAssumptions
        ).toEqual({ 2030: 1.2, 2100: 1.7 })
    })

    it("ignores Grapher's un-namespaced country param", () => {
        expect(parseSimulationUrlState("?country=Japan").entityName).toBe(
            undefined
        )
    })
})

describe(simulationStateToQueryParams, () => {
    it("omits params that match the baseline", () => {
        expect(
            simulationStateToQueryParams({
                entityName: "Japan",
                baselineEntityName: "Japan",
                includeEntityName: true,
                scenarioParams: baselineScenarioParams,
                baselineScenarioParams,
                retirementAgePoints: { 2030: 65, 2050: 65, 2100: 65 },
                baselineRetirementAgePoints: {
                    2030: 65,
                    2050: 65,
                    2100: 65,
                },
            })
        ).toEqual({})
    })

    it("serializes country and changed assumptions", () => {
        expect(
            simulationStateToQueryParams({
                entityName: "Japan",
                baselineEntityName: "United States",
                includeEntityName: true,
                scenarioParams: {
                    fertilityRate: { 2030: 1.2, 2050: 1.4, 2100: 1.7 },
                    lifeExpectancy: { 2030: 84, 2050: 88, 2100: 92 },
                    netMigrationRate: { 2030: -1, 2050: 0, 2100: 1 },
                },
                baselineScenarioParams,
                retirementAgePoints: { 2030: 65, 2050: 67, 2100: 70 },
                baselineRetirementAgePoints: {
                    2030: 65,
                    2050: 65,
                    2100: 65,
                },
            })
        ).toEqual({
            [DEMOGRAPHY_COUNTRY_PARAM]: "Japan",
            [DEMOGRAPHY_FERTILITY_PARAM]: "1.2,1.4,1.7",
            [DEMOGRAPHY_LIFE_EXPECTANCY_PARAM]: "84,88,92",
            [DEMOGRAPHY_NET_MIGRATION_PARAM]: "-1.0,0.0,1.0",
            [DEMOGRAPHY_RETIREMENT_AGE_PARAM]: "65,67,70",
        })
    })

    it("does not serialize auto-detected countries before user selection", () => {
        expect(
            simulationStateToQueryParams({
                entityName: "France",
                includeEntityName: false,
                scenarioParams: baselineScenarioParams,
                baselineScenarioParams,
            })
        ).toEqual({})
    })
})
