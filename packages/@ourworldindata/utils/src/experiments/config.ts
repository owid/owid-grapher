import {
    DATA_PAGE_METADATA_EXPERIMENT_ID,
    DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM,
    DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
    EXPERIMENT_PREFIX,
} from "./constants.js"
import { Experiment } from "./Experiment.js"

/*
 * Hard-coded active experiments.
 */
export const experiments: Experiment[] = [
    /*
     * Experiment: all-charts-vs-featured-v1
     *
     * This experiment trials the "Featured metrics" block in place of the "All Charts" block on
     * a sample of modular topic pages and data pages. The goal of the experiment is to
     * get a feel for differences in user engagement, controlling for the the location it appears.
     *
     * Conditions:
     * - (a) status quo (all charts block)
     * - (b) featured metrics block (treatment)
     *
     */
    new Experiment({
        id: "all-charts-vs-featured-v1",
        expires: "2026-03-24T00:00:00.000Z",
        arms: [
            {
                id: "all-charts",
                fraction: 0.7,
                replaysSessionSampleRate: 0.2,
            },
            {
                id: "featured-metrics",
                fraction: 0.3,
                replaysSessionSampleRate: 0.33,
            },
        ],
        paths: [
            // modular topic pages
            "/population-growth",
            "/poverty",
            "/co2-and-greenhouse-gas-emissions",
            "/life-expectancy",
            "/agricultural-production",
            "/natural-disasters",
            "/causes-of-death",
            "/war-and-peace",
            "/migration",
            "/artificial-intelligence",
            "/child-mortality",
            "/economic-growth",
            "/economic-inequality",
            "/democracy",
            "/climate-change",
            // data pages
            "/grapher/democracy-index-eiu",
            "/grapher/gdp-per-capita-worldbank",
            "/grapher/co-emissions-per-capita",
            "/grapher/life-expectancy",
            "/grapher/child-mortality",
            "/grapher/population",
            "/grapher/human-rights-index-vdem",
            "/grapher/share-of-population-in-extreme-poverty",
            "/grapher/economic-inequality-gini-index",
            "/grapher/per-capita-energy-use",
            "/grapher/children-born-per-woman",
            "/grapher/nuclear-warhead-stockpiles-lines",
            "/grapher/daily-per-capita-caloric-supply",
            "/grapher/eating-disorders-prevalence",
            "/grapher/share-electricity-nuclear",
            "/grapher/mean-years-of-schooling-long-run",
            "/grapher/female-homicide-victims",
            "/grapher/share-of-individuals-using-the-internet",
            "/grapher/prevalence-of-undernourishment",
            "/grapher/incidence-of-hivaids",
        ],
    }),
    new Experiment({
        id: "user-survey-role-v1",
        expires: "2026-03-20T00:00:00.000Z",
        arms: [
            { id: "long-list", fraction: 1 / 3 },
            { id: "short-list", fraction: 1 / 3 },
            { id: "free-form", fraction: 1 / 3 },
        ],
        paths: ["/"],
    }),
    /*
     * Experiment: data-page-metadata-v1
     *
     * Trials a redesigned "metadata box" beneath the chart on data pages. The
     * box consolidates "What you should know about this indicator", FAQs, data
     * sources, and citation guidance into a single collapsible block, with an
     * indicator switcher for charts that plot multiple Y-indicators.
     *
     * Conditions:
     * - (a) control: the current data page (AboutThisData + Sources/Reuse sections)
     * - (b) treatment: the new metadata box in place of those sections
     */
    new Experiment({
        id: DATA_PAGE_METADATA_EXPERIMENT_ID,
        expires: "2026-12-31T00:00:00.000Z",
        arms: [
            { id: "control", fraction: 0.0 },
            { id: "treatment", fraction: 1.0, replaysSessionSampleRate: 0.33 },
        ],
        paths: [
            // single indicator data pages (multi-indicator data pages aren't supported yet)
            "/grapher/gdp-per-capita-maddison-project-database",
            "/grapher/co-emissions-per-capita",
            "/grapher/democracy-index-eiu",
            "/grapher/life-expectancy",
            "/grapher/cross-country-literacy-rates",
            "/grapher/human-development-index",
            "/grapher/share-of-population-in-extreme-poverty",
            "/grapher/human-rights-index-vdem",
            "/grapher/daily-per-capita-caloric-supply",
            "/grapher/per-capita-energy-use",
        ],
    }),
    /*
     * Experiment: data-page-metadata-v2
     *
     * The randomised follow-up to data-page-metadata-v1, which ran at 100%
     * treatment on 10 pages and so had no control arm — every read was
     * quasi-experimental (see the writeup for the diff-in-diff machinery that
     * required). This one is cluster randomised: 300 data pages, 150 of them
     * assigned to the redesign, each page fixed to one arm for every visitor.
     *
     * Page-level rather than visitor-level assignment because the two designs
     * differ in server-rendered markup: serving both from one page would mean
     * baking both metadata trees and hiding one, which duplicates indexable
     * content and double-fires the components' own analytics. Clustering costs
     * power — placebo-calibrated MDE on first-time bounce is ~3.2pp over 2
     * weeks / ~2.5pp over 4 (the metadata-click outcomes are far better
     * powered) — which is why the page count is 300 rather than v1's 10.
     *
     * Pre-registered selection, drawn by
     * analytics:experiments/experiment_data_page_metadata_v2_sampling.ipynb
     * (seed 20260827) before any outcome was observed:
     *   1. Eligible = standard single-indicator data page (not a plain grapher
     *      page, not multi-dim, not a redirect), not already in v1.
     *   2. Ranked by first-time landing sessions, Feb 1 - Aug 24 2026 — a
     *      pre-period traffic measure, so selection never conditions on an
     *      outcome. The top 300 were enrolled.
     *   3. Matched on traffic: rank-adjacent pairs (#1-#2, #3-#4, ...), one
     *      page of each of the 150 pairs drawn to treatment by seeded coin
     *      flip, so the arms are balanced across the traffic distribution.
     *
     * Conditions:
     * - (a) control: the current data page (AboutThisData + Sources/Reuse sections)
     * - (b) treatment: the new metadata box in place of those sections
     */
    new Experiment({
        id: DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
        expires: "2026-12-31T00:00:00.000Z",
        unitOfAssignment: "page",
        arms: [
            { id: "control", fraction: 0.5 },
            {
                id: DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM,
                fraction: 0.5,
                replaysSessionSampleRate: 0.33,
            },
        ],
        // Each page's arm is fixed here rather than drawn at request time, so
        // the assignment is reproducible at bake time and auditable in review.
        pathArms: {
            // --- treatment (150 pages) ---
            "/grapher/age-dependency-ratio-old": "treatment",
            "/grapher/agriculture-share-gdp": "treatment",
            "/grapher/air-passengers-carried": "treatment",
            "/grapher/annual-co-emissions-by-region": "treatment",
            "/grapher/annual-co-emissions-from-aviation": "treatment",
            "/grapher/annual-co2-cement": "treatment",
            "/grapher/annual-co2-emissions-per-country": "treatment",
            "/grapher/annual-number-of-fires": "treatment",
            "/grapher/annual-working-hours-per-worker": "treatment",
            "/grapher/average-battery-cell-price": "treatment",
            "/grapher/average-hourly-earnings": "treatment",
            "/grapher/average-monthly-surface-temperature": "treatment",
            "/grapher/average-precipitation-per-year": "treatment",
            "/grapher/bipolar-disorder-prevalence": "treatment",
            "/grapher/cancer-death-rate-who-mdb": "treatment",
            "/grapher/cancer-death-rates": "treatment",
            "/grapher/carbon-dioxide-emissions-factor": "treatment",
            "/grapher/child-mortality": "treatment",
            "/grapher/children-born-per-woman": "treatment",
            "/grapher/children-per-woman-un": "treatment",
            "/grapher/co2-emissions-transport": "treatment",
            "/grapher/co2-long-term-concentration": "treatment",
            "/grapher/coal-consumption-by-country-terawatt-hours-twh":
                "treatment",
            "/grapher/cocoa-bean-production": "treatment",
            "/grapher/cost-space-launches-low-earth-orbit": "treatment",
            "/grapher/covid-world-unvaccinated-people": "treatment",
            "/grapher/crude-birth-rate": "treatment",
            "/grapher/crude-death-rate": "treatment",
            "/grapher/cumulative-co-emissions": "treatment",
            "/grapher/daily-meat-consumption-per-person": "treatment",
            "/grapher/daily-per-capita-protein-supply": "treatment",
            "/grapher/data-centers-share-electricity-demand": "treatment",
            "/grapher/death-rate-from-cancer-for-15-to-49-year-olds":
                "treatment",
            "/grapher/death-rates-road-incidents": "treatment",
            "/grapher/deaths-in-wars-by-war-1800-2011-bar-chart": "treatment",
            "/grapher/depressive-disorders-prevalence-ihme": "treatment",
            "/grapher/economic-inequality-gini-index": "treatment",
            "/grapher/electoral-democracy-index": "treatment",
            "/grapher/electricity-demand": "treatment",
            "/grapher/electricity-generation": "treatment",
            "/grapher/energy-intensity": "treatment",
            "/grapher/estimated-destroyable-area-by-nuclear-weapons-deliverable-in-first-strike":
                "treatment",
            "/grapher/fire-death-rates": "treatment",
            "/grapher/foreign-aid-given-as-a-share-of-national-income":
                "treatment",
            "/grapher/foreign-aid-given-per-capita": "treatment",
            "/grapher/foreign-aid-received-net": "treatment",
            "/grapher/forest-area-as-share-of-land-area": "treatment",
            "/grapher/fossil-fuels-share-energy": "treatment",
            "/grapher/free-and-fair-elections-index": "treatment",
            "/grapher/freedom-score-fh": "treatment",
            "/grapher/future-life-expectancy-projections": "treatment",
            "/grapher/gdp-per-capita-penn-world-table": "treatment",
            "/grapher/gdp-per-person-employed-constant-ppp": "treatment",
            "/grapher/gdp-world-regions-stacked-area": "treatment",
            "/grapher/gender-development-index": "treatment",
            "/grapher/ghg-per-kg-poore": "treatment",
            "/grapher/ghg-per-protein-poore": "treatment",
            "/grapher/global-average-gdp-per-capita-over-the-long-run":
                "treatment",
            "/grapher/global-gdp-over-the-long-run": "treatment",
            "/grapher/global-mine-production-minerals": "treatment",
            "/grapher/gross-national-income-per-capita-undp": "treatment",
            "/grapher/gross-national-income-per-capita-worldbank": "treatment",
            "/grapher/happiness-cantril-ladder": "treatment",
            "/grapher/healthy-life-expectancy-at-birth": "treatment",
            "/grapher/hiv-death-rates": "treatment",
            "/grapher/homicide-rate": "treatment",
            "/grapher/homicide-rate-unodc": "treatment",
            "/grapher/human-development-index-groups": "treatment",
            "/grapher/hydropower-generation": "treatment",
            "/grapher/infectious-disease-death-rates": "treatment",
            "/grapher/inflation-of-consumer-prices": "treatment",
            "/grapher/international-tourist-departures": "treatment",
            "/grapher/international-tourist-trips": "treatment",
            "/grapher/labor-productivity-per-hour-pennworldtable": "treatment",
            "/grapher/lgbt-legal-equality-index": "treatment",
            "/grapher/lgbt-rights-index": "treatment",
            "/grapher/life-expectancy-hmd-unwpp": "treatment",
            "/grapher/long-run-birth-rate": "treatment",
            "/grapher/maize-production": "treatment",
            "/grapher/maternal-mortality": "treatment",
            "/grapher/mean-years-of-schooling-long-run": "treatment",
            "/grapher/median-income-after-tax-lis": "treatment",
            "/grapher/migrant-stock-share": "treatment",
            "/grapher/military-spending-sipri": "treatment",
            "/grapher/milk-production-tonnes": "treatment",
            "/grapher/mobile-cellular-subscriptions-per-100-people":
                "treatment",
            "/grapher/monthly-spending-data-center-us": "treatment",
            "/grapher/nasa-annual-budget": "treatment",
            "/grapher/natural-disasters-by-type": "treatment",
            "/grapher/number-of-internet-users": "treatment",
            "/grapher/number-of-measles-cases": "treatment",
            "/grapher/number-of-natural-disaster-events": "treatment",
            "/grapher/number-suicide-deaths": "treatment",
            "/grapher/obesity-prevalence-adults-who-gho": "treatment",
            "/grapher/oil-production-by-country": "treatment",
            "/grapher/per-capita-egg-consumption-kilograms-per-year":
                "treatment",
            "/grapher/per-capita-ghg-emissions": "treatment",
            "/grapher/per-capita-milk-consumption": "treatment",
            "/grapher/per-capita-oil": "treatment",
            "/grapher/pesticide-use-tonnes": "treatment",
            "/grapher/physicians-per-1000-people": "treatment",
            "/grapher/police-officers-per-1000-people": "treatment",
            "/grapher/political-corruption-index": "treatment",
            "/grapher/political-regime": "treatment",
            "/grapher/population-density-by-city": "treatment",
            "/grapher/population-unwpp": "treatment",
            "/grapher/prevalence-of-undernourishment": "treatment",
            "/grapher/price-of-lithium-ion-battery-cells": "treatment",
            "/grapher/prison-population-rate": "treatment",
            "/grapher/private-investment-in-artificial-intelligence":
                "treatment",
            "/grapher/proportion-using-safely-managed-drinking-water":
                "treatment",
            "/grapher/public-health-expenditure-share-gdp": "treatment",
            "/grapher/public-sector-employment-as-a-share-of-total-employment":
                "treatment",
            "/grapher/refugee-population-by-country-or-territory-of-asylum":
                "treatment",
            "/grapher/registered-vehicles-per-1000-people": "treatment",
            "/grapher/researchers-in-rd-per-million-people": "treatment",
            "/grapher/rule-of-law-index": "treatment",
            "/grapher/schizophrenia-prevalence": "treatment",
            "/grapher/scientific-publications-per-million": "treatment",
            "/grapher/share-electricity-solar": "treatment",
            "/grapher/share-healthy-diet-unaffordable": "treatment",
            "/grapher/share-living-with-less-than-320-int--per-day":
                "treatment",
            "/grapher/share-living-with-less-than-upper-middle-income-poverty-line":
                "treatment",
            "/grapher/share-of-adults-defined-as-obese": "treatment",
            "/grapher/share-of-births-outside-marriage": "treatment",
            "/grapher/share-of-government-expenditure-going-to-interest-payments":
                "treatment",
            "/grapher/share-of-population-with-severe-food-insecurity":
                "treatment",
            "/grapher/share-of-the-population-with-completed-tertiary-education":
                "treatment",
            "/grapher/share-of-urban-population-living-in-slums": "treatment",
            "/grapher/share-with-mental-and-substance-disorders": "treatment",
            "/grapher/so-emissions-by-world-region-in-million-tonnes":
                "treatment",
            "/grapher/solar-energy-consumption": "treatment",
            "/grapher/solar-pv-prices": "treatment",
            "/grapher/sugar-cane-production": "treatment",
            "/grapher/tax-revenues-as-a-share-of-gdp-unu-wider": "treatment",
            "/grapher/ti-corruption-perception-index": "treatment",
            "/grapher/tomato-production": "treatment",
            "/grapher/total-alcohol-consumption-per-capita-litres-of-pure-alcohol":
                "treatment",
            "/grapher/total-ghg-emissions": "treatment",
            "/grapher/total-population-living-in-extreme-poverty-by-world-region":
                "treatment",
            "/grapher/tourism-gdp-proportion-of-total-gdp": "treatment",
            "/grapher/universal-health-coverage-index": "treatment",
            "/grapher/vegetable-consumption-per-capita": "treatment",
            "/grapher/voter-turnout-of-registered-voters": "treatment",
            "/grapher/wealth-share-richest-1-percent": "treatment",
            "/grapher/weekly-growth-covid-cases": "treatment",
            "/grapher/wind-generation": "treatment",
            "/grapher/world-bank-income-groups": "treatment",
            "/grapher/world-regions-according-to-the-world-bank": "treatment",
            "/grapher/yearly-number-of-objects-launched-into-outer-space":
                "treatment",
            // --- control (150 pages) ---
            "/grapher/academic-freedom-index": "control",
            "/grapher/age-dependency-ratio-of-working-age-population":
                "control",
            "/grapher/age-standardized-deaths-from-all-causes": "control",
            "/grapher/annual-area-burnt-by-wildfires": "control",
            "/grapher/annual-carbon-dioxide-emissions": "control",
            "/grapher/annual-healthcare-expenditure-per-capita": "control",
            "/grapher/annual-industrial-robots-installed": "control",
            "/grapher/annual-number-of-births-by-world-region": "control",
            "/grapher/annual-temperature-anomalies": "control",
            "/grapher/anxiety-disorders-prevalence": "control",
            "/grapher/asthma-prevalence": "control",
            "/grapher/average-annual-surface-temperature": "control",
            "/grapher/average-height-of-men-by-year-of-birth": "control",
            "/grapher/average-height-of-men-for-selected-countries": "control",
            "/grapher/banana-production": "control",
            "/grapher/cancer-incidence": "control",
            "/grapher/carbon-intensity-electricity": "control",
            "/grapher/cardiovascular-disease-death-rates": "control",
            "/grapher/cattle-livestock-count-heads": "control",
            "/grapher/cereal-production": "control",
            "/grapher/civil-society-participation-index": "control",
            "/grapher/co2-intensity": "control",
            "/grapher/coal-production-by-country": "control",
            "/grapher/coal-proved-reserves": "control",
            "/grapher/consumer-price-index": "control",
            "/grapher/consumption-co2-emissions": "control",
            "/grapher/consumption-co2-per-capita": "control",
            "/grapher/crude-oil-prices": "control",
            "/grapher/cumulative-co2-emissions-region": "control",
            "/grapher/cumulative-covid-deaths-region": "control",
            "/grapher/cumulative-covid-vaccinations": "control",
            "/grapher/cumulative-installed-wind-energy-capacity-gigawatts":
                "control",
            "/grapher/daily-median-income": "control",
            "/grapher/daily-per-capita-fat-supply": "control",
            "/grapher/damage-costs-from-natural-disasters": "control",
            "/grapher/days-of-vacation-and-holidays": "control",
            "/grapher/death-rates-due-to-low-physical-activity-gbd": "control",
            "/grapher/deaths-from-cancer-gbd": "control",
            "/grapher/deaths-in-armed-conflicts-by-country": "control",
            "/grapher/democracy-index-polity": "control",
            "/grapher/diabetes-prevalence": "control",
            "/grapher/earthquake-deaths": "control",
            "/grapher/eating-disorders-prevalence": "control",
            "/grapher/economic-damage-from-natural-disasters": "control",
            "/grapher/european-overseas-colonies-and-their-colonizers":
                "control",
            "/grapher/excess-mortality-p-scores-average-baseline": "control",
            "/grapher/female-labor-force-participation-rates": "control",
            "/grapher/fertilizer-total-use": "control",
            "/grapher/fish-and-seafood-consumption-per-capita": "control",
            "/grapher/foreign-aid-given-net": "control",
            "/grapher/foreign-direct-investment-net-inflows-as-share-of-gdp":
                "control",
            "/grapher/fossil-fuels-per-capita": "control",
            "/grapher/freedom-of-expression-index": "control",
            "/grapher/fruit-consumption-per-capita": "control",
            "/grapher/gdp-maddison-project-database": "control",
            "/grapher/gdp-per-capita-growth": "control",
            "/grapher/gdp-per-capita-worldbank": "control",
            "/grapher/gdp-per-capita-worldbank-constant-usd": "control",
            "/grapher/gdp-worldbank": "control",
            "/grapher/gdp-worldbank-constant-usd": "control",
            "/grapher/gender-gap-in-average-wages-ilo": "control",
            "/grapher/gender-inequality-index-from-the-human-development-report":
                "control",
            "/grapher/global-plastics-production": "control",
            "/grapher/global-temperature-anomalies-by-el-nino-la-nina":
                "control",
            "/grapher/growth-of-global-trade": "control",
            "/grapher/health-expenditure-and-financing-per-capita": "control",
            "/grapher/historical-gov-spending-gdp": "control",
            "/grapher/homicide-rates-from-firearms": "control",
            "/grapher/human-capital-index-in-2018": "control",
            "/grapher/human-papillomavirus-vaccine-immunization-schedule":
                "control",
            "/grapher/income-share-top-1-before-tax-wid": "control",
            "/grapher/industrial-robots-in-operation-per-1000-employees":
                "control",
            "/grapher/inequality-adjusted-human-development-index": "control",
            "/grapher/infant-mortality": "control",
            "/grapher/installed-geothermal-capacity": "control",
            "/grapher/installed-solar-pv-capacity": "control",
            "/grapher/international-tourist-arrivals-by-region-of-origin":
                "control",
            "/grapher/liberal-democracy-index": "control",
            "/grapher/life-expectancy-unwpp": "control",
            "/grapher/living-languages": "control",
            "/grapher/male-female-ratio-suicides-rates": "control",
            "/grapher/malnutrition-death-rates": "control",
            "/grapher/manufacturing-value-added-to-gdp": "control",
            "/grapher/meat-supply-per-person": "control",
            "/grapher/migrant-stock-total": "control",
            "/grapher/military-spending-as-a-share-of-gdp-sipri": "control",
            "/grapher/most-common-religion": "control",
            "/grapher/multidimensional-poverty-index-mpi": "control",
            "/grapher/net-official-development-assistance-and-aid-received":
                "control",
            "/grapher/nuclear-energy-generation": "control",
            "/grapher/number-airline-passengers": "control",
            "/grapher/number-species-threatened": "control",
            "/grapher/oil-consumption-by-country": "control",
            "/grapher/oil-prices-inflation-adjusted": "control",
            "/grapher/oil-proved-reserves": "control",
            "/grapher/palm-oil-production": "control",
            "/grapher/parkinsons-disease-prevalence-ihme": "control",
            "/grapher/participatory-democracy-index": "control",
            "/grapher/peak-birth-month": "control",
            "/grapher/per-capita-electricity-generation": "control",
            "/grapher/period-average-age-of-mothers": "control",
            "/grapher/pesticide-use-per-hectare-of-cropland": "control",
            "/grapher/political-polarization-score": "control",
            "/grapher/population": "control",
            "/grapher/population-density": "control",
            "/grapher/population-of-the-worlds-largest-cities": "control",
            "/grapher/population-regions-with-projections": "control",
            "/grapher/primary-energy-cons": "control",
            "/grapher/refugee-population-by-country-or-territory-of-origin":
                "control",
            "/grapher/renewable-share-energy": "control",
            "/grapher/renewable-water-resources-per-capita": "control",
            "/grapher/reported-cases-of-measles": "control",
            "/grapher/research-spending-gdp": "control",
            "/grapher/rice-production": "control",
            "/grapher/self-reported-trust-attitudes": "control",
            "/grapher/sex-ratio-at-birth": "control",
            "/grapher/share-electricity-nuclear": "control",
            "/grapher/share-electricity-renewables": "control",
            "/grapher/share-of-adults-who-are-overweight": "control",
            "/grapher/share-of-adults-who-smoke": "control",
            "/grapher/share-of-children-younger-than-5-who-suffer-from-stunting":
                "control",
            "/grapher/share-of-consumer-expenditure-spent-on-food": "control",
            "/grapher/share-of-individuals-using-the-internet": "control",
            "/grapher/share-of-people-who-say-they-are-happy": "control",
            "/grapher/share-of-population-urban": "control",
            "/grapher/share-of-the-population-infected-with-hiv": "control",
            "/grapher/share-of-the-population-with-access-to-electricity":
                "control",
            "/grapher/share-of-women-in-parliament": "control",
            "/grapher/share-with-drug-use-disorders": "control",
            "/grapher/social-spending-oecd-longrun": "control",
            "/grapher/solar-electricity-per-capita": "control",
            "/grapher/soybean-production": "control",
            "/grapher/suicide-death-rates": "control",
            "/grapher/test-scores-ai-capabilities-relative-human-performance":
                "control",
            "/grapher/total-factor-productivity": "control",
            "/grapher/total-gov-expenditure-percapita-oecd": "control",
            "/grapher/trade-as-share-of-gdp": "control",
            "/grapher/trips-by-domestic-tourists-per-person": "control",
            "/grapher/unemployment-rate": "control",
            "/grapher/urban-and-rural-population": "control",
            "/grapher/urban-population-share-2050": "control",
            "/grapher/urban-vs-rural-majority": "control",
            "/grapher/wealth-share-richest-10-percent": "control",
            "/grapher/weekly-covid-cases": "control",
            "/grapher/weekly-covid-deaths": "control",
            "/grapher/weekly-growth-covid-deaths": "control",
            "/grapher/wheat-production": "control",
            "/grapher/who-regions": "control",
            "/grapher/women-business-and-the-law-index": "control",
            "/grapher/women-civil-liberties-index": "control",
        },
    }),
]

/**
 * True if an experiment with the given raw id (i.e. without the `exp-`
 * prefix the `Experiment` constructor adds) is registered, not expired, and
 * the given url is in its `paths` list. Centralises the lookup so callers
 * don't need to know about the prefix convention or the expiry semantics.
 * The actual path-matching is delegated to `Experiment.isUrlInPaths`.
 */
export function isUrlInActiveExperiment(rawId: string, url: string): boolean {
    const exp = findActiveExperiment(rawId)
    return !!exp && exp.isUrlInPaths(url)
}

/**
 * The registered, unexpired experiment with the given raw id (i.e. without the
 * `exp-` prefix the `Experiment` constructor adds), if any.
 */
export function findActiveExperiment(rawId: string): Experiment | undefined {
    const id = `${EXPERIMENT_PREFIX}-${rawId}`
    const exp = experiments.find((e) => e.id === id)
    return exp && !exp.isExpired() ? exp : undefined
}

/**
 * The arm a page-assigned experiment puts the given url in, or `undefined` if
 * the experiment isn't active or the url isn't enrolled.
 */
export function getActiveExperimentArmForUrl(
    rawId: string,
    url: string
): string | undefined {
    return findActiveExperiment(rawId)?.getArmForUrl(url)
}

/**
 * True if the given data page url should render the redesigned metadata layout.
 *
 * Two experiments can put a page on the new design: v1, which enrolled 10 pages
 * at 100% treatment (path membership alone means treatment), and v2, which
 * cluster randomises 200 pages and so has a real control arm. This is the
 * single source of truth — the baker uses it to decide which pages get the
 * extra per-indicator metadata loaded, and the data page component uses it to
 * pick the markup, so the two can never disagree.
 */
export function isDataPageMetadataRedesignActive(url: string): boolean {
    return (
        isUrlInActiveExperiment(DATA_PAGE_METADATA_EXPERIMENT_ID, url) ||
        getActiveExperimentArmForUrl(
            DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
            url
        ) === DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM
    )
}
