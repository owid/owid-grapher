import {
    BASELINE_SCENARIO,
    ProjectionsFileJson,
    REGION_STACK_ORDER,
    ScenarioId,
    WORLD,
} from "./PovertyProjectionsConstants.js"

export interface ProjectionPoint {
    year: number
    ratio: number
    poorPop: number
}

export interface EntitySeries {
    entity: string
    /** The published series: estimates up to the year before
     * firstProjectionYear, the baseline projection from there on */
    baseline: ProjectionPoint[]
    /** Alternative scenario series. Each starts at the last pre-projection
     * year with the baseline value, so the lines connect to the estimates. */
    scenarios: Map<ScenarioId, ProjectionPoint[]>
}

export interface ProjectionsData {
    povertyLineCents: number
    years: number[]
    firstProjectionYear: number
    byEntity: Map<string, EntitySeries>
}

export function parseProjectionsFile(
    json: ProjectionsFileJson
): ProjectionsData {
    const byEntity = new Map<string, EntitySeries>()

    json.entities.forEach((entity, entityIndex) => {
        const baseline = json.years.map((year, yearIndex) => ({
            year,
            ratio: json.headcountRatio[entityIndex][yearIndex],
            poorPop: json.poorPop[entityIndex][yearIndex],
        }))

        // The point the projected lines branch off from
        const branchPoint = baseline.find(
            (point) => point.year === json.firstProjectionYear - 1
        )

        const scenarios = new Map<ScenarioId, ProjectionPoint[]>(
            json.scenarios.map((scenario) => [
                scenario.id,
                [
                    ...(branchPoint ? [branchPoint] : []),
                    ...json.scenarioYears.map((year, yearIndex) => ({
                        year,
                        ratio: scenario.headcountRatio[entityIndex][yearIndex],
                        poorPop: scenario.poorPop[entityIndex][yearIndex],
                    })),
                ],
            ])
        )

        byEntity.set(entity, { entity, baseline, scenarios })
    })

    return {
        povertyLineCents: json.povertyLineCents,
        years: json.years,
        firstProjectionYear: json.firstProjectionYear,
        byEntity,
    }
}

/** Split a full series into the historical (solid) and projected (dotted)
 * segments. Both include the last pre-projection year, so the drawn paths
 * connect seamlessly. */
export function splitAtProjection(
    points: ProjectionPoint[],
    firstProjectionYear: number
): { historical: ProjectionPoint[]; projected: ProjectionPoint[] } {
    return {
        historical: points.filter((point) => point.year < firstProjectionYear),
        projected: points.filter(
            (point) => point.year >= firstProjectionYear - 1
        ),
    }
}

/** The series drawn for an entity's projected years under a scenario
 * selection: the baseline itself, or the alternative scenario */
export function getProjectedSeries(
    series: EntitySeries,
    scenario: ScenarioId | typeof BASELINE_SCENARIO,
    firstProjectionYear: number
): ProjectionPoint[] {
    if (scenario === BASELINE_SCENARIO)
        return splitAtProjection(series.baseline, firstProjectionYear).projected
    return series.scenarios.get(scenario) ?? []
}

export interface StackedYearRow {
    year: number
    /** Number of people in poverty per region */
    values: Record<string, number>
}

/** Build the rows stacked by the stacked-area variant: the regions'
 * estimates up to the projection boundary, continued with the selected
 * scenario (or the baseline projection) from there on */
export function buildStackedRows(
    data: ProjectionsData,
    scenario: ScenarioId | typeof BASELINE_SCENARIO
): StackedYearRow[] {
    return data.years.map((year) => {
        const values: Record<string, number> = {}
        for (const region of REGION_STACK_ORDER) {
            const series = data.byEntity.get(region)
            if (!series) continue
            const source =
                scenario === BASELINE_SCENARIO ||
                year < data.firstProjectionYear
                    ? series.baseline
                    : series.scenarios.get(scenario)
            values[region] =
                source?.find((point) => point.year === year)?.poorPop ?? 0
        }
        return { year, values }
    })
}

/** The total number of people in poverty under the baseline projection,
 * from the last pre-projection year onwards. Shown as a reference line in
 * the stacked-area variant when an alternative scenario is selected.
 * Computed as the sum of the regions so it matches the stacked total. */
export function buildBaselineTotals(
    data: ProjectionsData
): { year: number; total: number }[] {
    return data.years
        .filter((year) => year >= data.firstProjectionYear - 1)
        .map((year) => ({
            year,
            total: REGION_STACK_ORDER.reduce((sum, region) => {
                const series = data.byEntity.get(region)
                const point = series?.baseline.find((p) => p.year === year)
                return sum + (point?.poorPop ?? 0)
            }, 0),
        }))
}

/** The World series to show in tooltips: the sum of the regions, so it is
 * consistent with the stacked total */
export function getStackedTotal(row: StackedYearRow): number {
    return REGION_STACK_ORDER.reduce(
        (sum, region) => sum + (row.values[region] ?? 0),
        0
    )
}

export { WORLD }
