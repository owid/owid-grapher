import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

// List of line and slope charts that have a single dimension and a single
// available entity. For these charts, adding a discrete bar chart tab doesn't
// make sense since they would display only a single bar. These slugs were
// identified by checking `grapher.availableEntityNames.length <= 1` and
// `grapher.yColumnSlugs.length <= 1` for all line and slope charts.
const excludedSlugs = [
    "ai-performance-imagenet",
    "air-passengers-per-fatality",
    "annual-number-of-people-receiving-antiretroviral-therapy-through-pepfar",
    "annual-patents-invention-united-states-1790",
    "arctic-sea-ice-coverage-19352014",
    "aviation-fatalities-per-million-passengers",
    "aviation-share-co2",
    "co2-long-term-concentration",
    "coal-output-per-worker-in-the-united-kingdom",
    "computer-chess-ability",
    "cost-of-generating-electricity-new-capacity-using-photovoltaic-cells-in-the-us-19762009",
    "cost-of-sequencing-a-full-human-genome",
    "cost-per-gigabase-dna-sequencing",
    "countries-data-antibiotic-livestock",
    "covid-vaccine-share-boosters",
    "crude-oil-prices",
    "cumulative-gravitational-wave-observations",
    "deaths-from-smallpox-in-london",
    "diphtheria-cases-in-the-united-states",
    "efficiency-of-lighting-in-the-united-kingdom-lumen-hours-per-kilowatt-hour",
    "electricity-air-conditioning",
    "employment-in-the-coal-industry-in-the-united-kingdom",
    "fatal-airliner-accidents-per-million-flights",
    "fatality-rates-due-to-lightning-in-the-us",
    "funding-for-trachoma",
    "gdp-per-capita-in-the-uk-since-1270",
    "global-average-gdp-per-capita-over-the-long-run",
    "global-commodity-prices-19602019",
    "global-death-rate-in-violent-political-conflicts-over-the-long-run",
    "global-deaths-in-violent-political-conflicts-over-the-long-run",
    "global-forestry-area-1958-2014",
    "global-gdp-over-the-long-run",
    "global-hydro-consumption",
    "global-incidence-of-child-labour",
    "global-plastics-production",
    "global-smallpox-cases",
    "green-climate-gcf-fund-pledges",
    "heat-wave-index-usa",
    "hours-of-work-per-1000-lumen-hours",
    "india-government-debt-as-a-percentage-of-gdp-19802019",
    "international-capital-flows",
    "interpersonal-trust-in-the-us",
    "labor-force-participation-rate-of-men-65-years-and-older-in-the-usa",
    "labor-productivity-agriculture-sweden",
    "labor-productivity-per-hour",
    "long-run-methane-concentration",
    "long-term-cod-catch",
    "material-footprint-per-capita",
    "material-footprint-per-unit-of-gdp",
    "mention-of-the-word-capitalism-in-new-york-times-articles",
    "monthly-ocean-heat-2000m",
    "monthly-upper-ocean-heat",
    "nasa-annual-budget",
    "nitrous-oxide-long",
    "non-commercial-flight-distance-records",
    "northern-hemisphere-temperatures-over-the-long-run-deviation-from-1951-1990-mean-temperature-c",
    "number-of-countries-having-implemented-a-vat",
    "number-of-countries-reporting-data-on-vaccinations",
    "number-of-measles-cases",
    "number-of-users-participating-issue-or-pull-request-owid-covid-repository",
    "number-un-peacekeeping-missions",
    "oecd-average-trust-in-governments",
    "oil-prices-inflation-adjusted",
    "percentage-of-persons-without-health-insurance-coverage-us",
    "population-of-england-millennium",
    "prevalence-of-undernourishment-in-developing-countries-since-1970",
    "price-per-kg-of-gold",
    "protein-folding-prediction-accuracy",
    "public-trust-in-government",
    "quantum-bits-per-processor",
    "rate-of-violent-victimizations-at-school-us",
    "rubella-cases-in-the-united-states",
    "share-of-clinical-trials-that-report-results-within-a-year-over-time",
    "share-of-the-workforce-employed-in-the-coal-industry-united-kingdom",
    "solar-pv-prices",
    "supercomputer-power-flops",
    "sweden-official-covid-deaths",
    "the-amount-of-cod-caught-in-the-grand-banks-north-atlantic-fisheries-18512018",
    "the-growth-of-government-in-the-uk",
    "the-linear-scale-in-natural-logs-and-a-linear-function",
    "the-price-for-lighting-per-million-lumen-hours-in-the-uk-in-british-pound",
    "the-productivity-of-labour-in-producing-light-lumen-hours-per-hour-of-labour-1800-to-the-present",
    "the-ratio-scale-and-an-exponential-function",
    "total-gdp-in-the-uk-since-1270",
    "transistors-per-microprocessor",
    "uk-gdp-growth-19572016",
    "uk-government-debt-as-a-percentage-of-gdp-17272016",
    "uk-inflation-rate-19892019",
    "uk-log-of-real-gdp-per-capita-in-2011-us",
    "uk-real-gdp-per-capita-in-2011-us-dollars",
    "uk-unemployment-rate-19712017",
    "un-peacekeeping-forces",
    "wage-of-craftsmen-relative-to-that-of-laborers-in-england-1200-2000",
    "what-percentage-of-the-us-public-approves-of-working-wives",
    "working-hours-uk-millennium",
    "world-trade-exports-constant-prices",
]

export class AddDiscreteBarChartTabToAllLineCharts1752507940867
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Add a discrete bar chart tab to all line charts.
            // Exceptions:
            // - Single-entity charts (included in the excludedSlugs array)
            // - Charts without a timeline
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        '$.chartTypes',
                        JSON_ARRAY_APPEND(${column}->'$.chartTypes', '$', 'DiscreteBar')
                    )
                    WHERE
                        ${column}->>'$.slug' NOT IN (?)
                        AND (${column}->>'$.hideTimeline' IS NULL OR ${column}->>'$.hideTimeline' = 'false')
                        AND JSON_SEARCH(${column}->'$.chartTypes', 'one', 'LineChart') IS NOT NULL
                        AND JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar') IS NULL
                `,
                [excludedSlugs]
            )

            // For all charts that shouldn't have a discrete bar chart tab,
            // set `chartTypes` to `LineChart` if it's not already set
            // (because otherwise it would fallback to LineChart/DiscreteBar)
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        '$.chartTypes',
                        JSON_ARRAY('LineChart')
                    )
                    WHERE
                        (
                            ${column}->>'$.slug' IN (?)
                            OR ${column}->>'$.hideTimeline' = 'true'
                        )
                        AND ${column}->>'$.chartTypes' IS NULL
                `,
                [excludedSlugs]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Remove the discrete bar chart tab from all line charts
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        '$.chartTypes',
                        JSON_REMOVE(
                            ${column}->'$.chartTypes',
                            JSON_UNQUOTE(JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar'))
                        )
                    )
                    WHERE
                        JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar') IS NOT NULL
                        AND JSON_SEARCH(${column}->'$.chartTypes', 'one', 'LineChart') IS NOT NULL
                `
            )
        }
    }
}
