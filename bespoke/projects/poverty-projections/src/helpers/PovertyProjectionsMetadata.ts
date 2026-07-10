import {
    ALL_SCENARIOS,
    BASELINE_SCENARIO,
    EXTREME_POVERTY_LINE_CENTS,
    POVERTY_LINES,
    SCENARIOS,
    ScenarioSelection,
    VariantName,
} from "./PovertyProjectionsConstants.js"

// Metadata mirroring the FAUST of the ETL dataset
// garden/wb/2026-03-25/poverty_projections and the published chart
// ourworldindata.org/grapher/projections-extreme-poverty-wb

export const DATA_SOURCE =
    "Lakner et al. (2025) (updated using World Bank PIP in March 2026)"

export const FOOTER_NOTE =
    "This data is expressed in international-$ at 2021 prices. It relates " +
    "to income (measured after taxes and benefits) or to consumption, per " +
    "capita."

const BASELINE_PROJECTIONS_SENTENCES =
    "Projections are from the World Bank. From 2027–2030 they are based on " +
    "growth forecasts from the World Bank and IMF. From 2031, they are " +
    "based on observed 2015–2024 growth rates."

const ADJUSTMENT_SENTENCE =
    "This data is adjusted for inflation and differences in living costs " +
    "between countries."

const ALL_SCENARIOS_SENTENCE =
    "Alternative scenarios show how poverty would change if all countries " +
    "grew at a constant annual rate of 2–8%, or at 2% combined with an " +
    "annual reduction of inequality — as measured by the Gini coefficient — " +
    "of 1% or 2%."

export interface ChartMetadata {
    title: string
    subtitle: string
    note: string
    source: string
}

export function getChartMetadata({
    variant,
    povertyLineCents,
    scenario,
    firstProjectionYear,
}: {
    variant: VariantName
    povertyLineCents: number
    scenario: ScenarioSelection
    firstProjectionYear: number
}): ChartMetadata {
    const povertyLine =
        POVERTY_LINES.find((line) => line.cents === povertyLineCents) ??
        POVERTY_LINES[0]
    const isExtremePoverty = povertyLine.cents === EXTREME_POVERTY_LINE_CENTS

    // Mirrors the phrasing of the world_bank_pip grapher configs: the
    // International Poverty Line is phrased as extreme poverty, the other
    // lines mention the poverty line itself
    const livingBelow = isExtremePoverty
        ? "living in extreme poverty"
        : `living below ${povertyLine.label}`

    const selectedScenario = SCENARIOS.find((s) => s.id === scenario)

    const title =
        scenario === ALL_SCENARIOS
            ? `Share of the world population ${livingBelow} — projection scenarios`
            : (variant === "share"
                  ? `Share of the population ${livingBelow} by world region`
                  : `Total population ${livingBelow} by world region`) +
              (selectedScenario ? ` — ${selectedScenario.label} scenario` : "")

    // The projection sentences describe the selection: the World Bank's
    // current forecasts, one alternative scenario, or the full range
    const projectionSentences =
        scenario === BASELINE_SCENARIO
            ? BASELINE_PROJECTIONS_SENTENCES
            : scenario === ALL_SCENARIOS
              ? `${BASELINE_PROJECTIONS_SENTENCES} ${ALL_SCENARIOS_SENTENCE}`
              : [
                    `Projections from ${firstProjectionYear} onwards show a World Bank scenario in which ${selectedScenario?.assumption}.`,
                    ...(variant === "stacked-area"
                        ? [
                              "The dashed line shows the World Bank's projection based on current forecasts, for comparison.",
                          ]
                        : []),
                ].join(" ")

    const subtitle = [
        povertyLine.definition,
        ADJUSTMENT_SENTENCE,
        projectionSentences,
    ].join(" ")

    return { title, subtitle, note: FOOTER_NOTE, source: DATA_SOURCE }
}
