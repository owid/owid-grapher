import { describe, expect, it } from "vitest"

import type { ScenarioParams } from "../model/scenarios"
import {
    DEMOGRAPHY_COUNTRY_PARAM,
    DEMOGRAPHY_FERTILITY_PARAM,
    DEMOGRAPHY_LIFE_EXPECTANCY_PARAM,
    DEMOGRAPHY_NET_MIGRATION_PARAM,
    DEMOGRAPHY_TAB_PARAM,
    DEMOGRAPHY_YEAR_PARAM,
    parseSimulationUrlState,
    simulationStateToQueryParams,
    type SimulationUrlWriteState,
} from "./urlState"
import { END_YEAR } from "./constants"

const baselineScenarioParams: ScenarioParams = {
    fertilityRate: { 2030: 1.4, 2050: 1.5, 2100: 1.6 },
    lifeExpectancy: { 2030: 80, 2050: 85, 2100: 90 },
    netMigrationRate: { 2030: 0, 2050: 0.5, 2100: 1 },
}

// Defaults that match the relevant baseline so the test inputs only need to
// override what they want to assert on.
const baseWriteState: SimulationUrlWriteState = {
    entityName: "Japan",
    includeEntityName: true,
    scenarioParams: baselineScenarioParams,
    baselineScenarioParams,
    tab: "fertilityRate",
    baselineTab: "fertilityRate",
    year: END_YEAR,
    baselineYear: END_YEAR,
}

describe(parseSimulationUrlState, () => {
    it("parses country and assumption params", () => {
        expect(
            parseSimulationUrlState(
                "?demographyCountry=JPN&demographyFertility=1.2,1.4,1.7&demographyLifeExpectancy=84,88,92&demographyNetMigration=-1,0,1"
            )
        ).toEqual({
            entityName: "Japan",
            fertilityRateAssumptions: { 2030: 1.2, 2050: 1.4, 2100: 1.7 },
            lifeExpectancyAssumptions: { 2030: 84, 2050: 88, 2100: 92 },
            netMigrationRateAssumptions: { 2030: -1, 2050: 0, 2100: 1 },
            tab: undefined,
            year: undefined,
        })
    })

    it("accepts legacy URLs that use the country name", () => {
        expect(
            parseSimulationUrlState("?demographyCountry=Japan").entityName
        ).toBe("Japan")
    })

    it("passes through entities not in Grapher's code lookup", () => {
        expect(
            parseSimulationUrlState("?demographyCountry=Atlantis").entityName
        ).toBe("Atlantis")
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

    it("parses tab and year", () => {
        const parsed = parseSimulationUrlState(
            "?demographyTab=lifeExpectancy&demographyYear=2050"
        )
        expect(parsed.tab).toBe("lifeExpectancy")
        expect(parsed.year).toBe(2050)
    })

    it("rejects invalid tab values", () => {
        expect(
            parseSimulationUrlState("?demographyTab=garbage").tab
        ).toBeUndefined()
    })

    it("rejects non-integer and out-of-range years", () => {
        expect(
            parseSimulationUrlState("?demographyYear=abc").year
        ).toBeUndefined()
        expect(
            parseSimulationUrlState("?demographyYear=2050.5").year
        ).toBeUndefined()
        expect(
            parseSimulationUrlState("?demographyYear=1800").year
        ).toBeUndefined()
        expect(
            parseSimulationUrlState("?demographyYear=2200").year
        ).toBeUndefined()
    })
})

describe(simulationStateToQueryParams, () => {
    it("omits params that match the baseline", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                baselineEntityName: "Japan",
            })
        ).toEqual({})
    })

    it("serializes country and changed assumptions", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                baselineEntityName: "United States",
                scenarioParams: {
                    fertilityRate: { 2030: 1.2, 2050: 1.4, 2100: 1.7 },
                    lifeExpectancy: { 2030: 84, 2050: 88, 2100: 92 },
                    netMigrationRate: { 2030: -1, 2050: 0, 2100: 1 },
                },
            })
        ).toEqual({
            [DEMOGRAPHY_COUNTRY_PARAM]: "JPN",
            [DEMOGRAPHY_FERTILITY_PARAM]: "1.2,1.4,1.7",
            [DEMOGRAPHY_LIFE_EXPECTANCY_PARAM]: "84,88,92",
            // 2100 (1) matches baseline so it's omitted to avoid lossy round-trips
            [DEMOGRAPHY_NET_MIGRATION_PARAM]: "-1.0,0.0,",
        })
    })

    it("omits unchanged control points so reloads don't show false modifications", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                baselineEntityName: "Japan",
                scenarioParams: {
                    fertilityRate: { 2030: 1.4, 2050: 2.0, 2100: 1.6 },
                    lifeExpectancy: baselineScenarioParams.lifeExpectancy,
                    netMigrationRate: baselineScenarioParams.netMigrationRate,
                },
            })
        ).toEqual({
            [DEMOGRAPHY_FERTILITY_PARAM]: ",2.0,",
        })
    })

    it("uses the entity name when no code is known", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                entityName: "Atlantis",
                baselineEntityName: "Japan",
            })
        ).toMatchObject({ [DEMOGRAPHY_COUNTRY_PARAM]: "Atlantis" })
    })

    it("does not serialize auto-detected countries before user selection", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                entityName: "France",
                includeEntityName: false,
            })
        ).toEqual({})
    })

    it("omits tab and year when they match the baseline", () => {
        const result = simulationStateToQueryParams({
            ...baseWriteState,
            baselineEntityName: "Japan",
        })
        expect(result).not.toHaveProperty(DEMOGRAPHY_TAB_PARAM)
        expect(result).not.toHaveProperty(DEMOGRAPHY_YEAR_PARAM)
    })

    it("serializes tab when it differs from the baseline", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                baselineEntityName: "Japan",
                tab: "lifeExpectancy",
                baselineTab: "fertilityRate",
            })
        ).toEqual({ [DEMOGRAPHY_TAB_PARAM]: "lifeExpectancy" })
    })

    it("serializes year when it differs from the baseline", () => {
        expect(
            simulationStateToQueryParams({
                ...baseWriteState,
                baselineEntityName: "Japan",
                year: 2050,
            })
        ).toEqual({ [DEMOGRAPHY_YEAR_PARAM]: "2050" })
    })
})
