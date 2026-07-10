import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
    ENTITIES,
    getEntityColor,
    POVERTY_LINES,
    ProjectionsFileJson,
    REGION_STACK_ORDER,
    SCENARIOS,
    WB_REGIONS,
    WORLD,
} from "./PovertyProjectionsConstants.js"
import {
    buildBaselineTotals,
    buildStackedRows,
    getStackedTotal,
    parseProjectionsFile,
    splitAtProjection,
} from "./PovertyProjectionsData.js"

const dataDir = fileURLToPath(new URL("../data", import.meta.url))

const dataFiles: ProjectionsFileJson[] = POVERTY_LINES.map((line) =>
    JSON.parse(
        fs.readFileSync(
            path.join(dataDir, `projections-${line.cents}.json`),
            "utf-8"
        )
    )
)

describe("committed projections data files", () => {
    it("has one data file per poverty line", () => {
        expect(dataFiles.map((file) => file.povertyLineCents)).toEqual(
            POVERTY_LINES.map((line) => line.cents)
        )
    })

    it("has the expected entities, in the expected order", () => {
        for (const file of dataFiles) {
            expect(file.entities).toEqual(ENTITIES)
        }
        expect(ENTITIES[0]).toBe(WORLD)
        expect(new Set(REGION_STACK_ORDER)).toEqual(new Set(WB_REGIONS))
    })

    it("has identical years and scenario years across files", () => {
        const [reference, ...rest] = dataFiles
        for (const file of rest) {
            expect(file.years).toEqual(reference.years)
            expect(file.scenarioYears).toEqual(reference.scenarioYears)
            expect(file.firstProjectionYear).toBe(reference.firstProjectionYear)
        }
    })

    it("has contiguous years starting in 1990, and scenario years starting at the projection boundary", () => {
        for (const file of dataFiles) {
            expect(file.years[0]).toBe(1990)
            for (let i = 1; i < file.years.length; i++) {
                expect(file.years[i]).toBe(file.years[i - 1] + 1)
            }
            expect(file.scenarioYears[0]).toBe(file.firstProjectionYear)
            for (let i = 1; i < file.scenarioYears.length; i++) {
                expect(file.scenarioYears[i]).toBe(
                    file.scenarioYears[i - 1] + 1
                )
            }
            expect(file.years.at(-1)).toBe(file.scenarioYears.at(-1))
        }
    })

    it("has all scenarios, in the expected order", () => {
        for (const file of dataFiles) {
            expect(file.scenarios.map((scenario) => scenario.id)).toEqual(
                SCENARIOS.map((scenario) => scenario.id)
            )
        }
    })

    it("has dense, in-range values", () => {
        for (const file of dataFiles) {
            const matrices = [
                {
                    ratios: file.headcountRatio,
                    counts: file.poorPop,
                    years: file.years,
                },
                ...file.scenarios.map((scenario) => ({
                    ratios: scenario.headcountRatio,
                    counts: scenario.poorPop,
                    years: file.scenarioYears,
                })),
            ]
            for (const { ratios, counts, years } of matrices) {
                expect(ratios).toHaveLength(ENTITIES.length)
                expect(counts).toHaveLength(ENTITIES.length)
                for (const row of ratios) {
                    expect(row).toHaveLength(years.length)
                    for (const value of row) {
                        expect(typeof value).toBe("number")
                        expect(Number.isFinite(value)).toBe(true)
                        expect(value).toBeGreaterThanOrEqual(0)
                        expect(value).toBeLessThanOrEqual(100)
                    }
                }
                for (const row of counts) {
                    expect(row).toHaveLength(years.length)
                    for (const value of row) {
                        expect(Number.isFinite(value)).toBe(true)
                        expect(value).toBeGreaterThanOrEqual(0)
                    }
                }
            }
        }
    })

    it("has regions that sum approximately to the World", () => {
        for (const file of dataFiles) {
            const worldIndex = file.entities.indexOf(WORLD)
            file.years.forEach((_, yearIndex) => {
                const regionSum = file.entities.reduce(
                    (sum, entity, entityIndex) =>
                        entity === WORLD
                            ? sum
                            : sum + file.poorPop[entityIndex][yearIndex],
                    0
                )
                const world = file.poorPop[worldIndex][yearIndex]
                expect(Math.abs(regionSum - world)).toBeLessThan(
                    Math.max(world * 0.01, 1e6)
                )
            })
        }
    })

    it("has a color for every entity", () => {
        for (const entity of ENTITIES) {
            expect(getEntityColor(entity), entity).not.toBe("#cccccc")
        }
    })
})

describe(parseProjectionsFile, () => {
    const data = parseProjectionsFile(dataFiles[0])

    it("parses every entity with a full baseline series", () => {
        expect(data.byEntity.size).toBe(ENTITIES.length)
        for (const entity of ENTITIES) {
            const series = data.byEntity.get(entity)
            expect(series?.baseline).toHaveLength(dataFiles[0].years.length)
        }
    })

    it("prepends the last pre-projection year to every scenario series", () => {
        const world = data.byEntity.get(WORLD)!
        const branchYear = data.firstProjectionYear - 1
        const baselineBranchPoint = world.baseline.find(
            (point) => point.year === branchYear
        )
        for (const scenario of SCENARIOS) {
            const points = world.scenarios.get(scenario.id)!
            expect(points[0]).toEqual(baselineBranchPoint)
            expect(points).toHaveLength(dataFiles[0].scenarioYears.length + 1)
        }
    })
})

describe(splitAtProjection, () => {
    const data = parseProjectionsFile(dataFiles[0])

    it("splits the baseline into segments sharing the boundary point", () => {
        const world = data.byEntity.get(WORLD)!
        const { historical, projected } = splitAtProjection(
            world.baseline,
            data.firstProjectionYear
        )
        expect(historical.at(-1)?.year).toBe(data.firstProjectionYear - 1)
        expect(projected[0]?.year).toBe(data.firstProjectionYear - 1)
        expect(projected.at(-1)?.year).toBe(data.years.at(-1))
        expect(historical.length + projected.length).toBe(data.years.length + 1)
    })
})

describe(buildStackedRows, () => {
    const data = parseProjectionsFile(dataFiles[0])

    it("uses the baseline before the boundary and the scenario after it", () => {
        const scenarioId = SCENARIOS[0].id
        const rows = buildStackedRows(data, scenarioId)
        const region = REGION_STACK_ORDER[0]
        const series = data.byEntity.get(region)!

        const before = rows.find(
            (row) => row.year === data.firstProjectionYear - 1
        )!
        expect(before.values[region]).toBe(
            series.baseline.find(
                (point) => point.year === data.firstProjectionYear - 1
            )?.poorPop
        )

        const after = rows.find((row) => row.year === data.firstProjectionYear)!
        expect(after.values[region]).toBe(
            series.scenarios
                .get(scenarioId)!
                .find((point) => point.year === data.firstProjectionYear)
                ?.poorPop
        )
    })

    it("computes totals matching the baseline reference line at the boundary", () => {
        const rows = buildStackedRows(data, "baseline")
        const totals = buildBaselineTotals(data)
        const boundaryRow = rows.find(
            (row) => row.year === data.firstProjectionYear
        )!
        const boundaryTotal = totals.find(
            (point) => point.year === data.firstProjectionYear
        )!
        expect(getStackedTotal(boundaryRow)).toBeCloseTo(boundaryTotal.total, 5)
    })
})
