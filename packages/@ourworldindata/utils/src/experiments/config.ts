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
     * required). This one is cluster randomised: 200 data pages, 100 of them
     * assigned to the redesign, each page fixed to one arm for every visitor.
     *
     * Page-level rather than visitor-level assignment because the two designs
     * differ in server-rendered markup: serving both from one page would mean
     * baking both metadata trees and hiding one, which duplicates indexable
     * content and double-fires the components' own analytics. Clustering costs
     * power (MDE ~2.6pp on first-time bounce over 4 weeks, vs ~1.0pp if we
     * randomised visitors), which is why the page count is 200 rather than v1's 10.
     *
     * Pre-registered selection, fixed before any outcome was observed:
     *   1. Eligible = standard single-indicator data page (not a plain grapher
     *      page, not multi-dim, not a redirect), not already in v1.
     *   2. Ranked by first-time landing sessions, Feb 1 - Jul 31 2026 — a
     *      pre-period traffic measure, so selection never conditions on an
     *      outcome. The top 200 were taken.
     *   3. Matched into 100 pairs by Mahalanobis distance on (log landing
     *      sessions, baseline first-time bounce rate), then exactly one page of
     *      each pair drawn to treatment with seed 20260803. Pooled baseline
     *      bounce came out at 84.3% treatment vs 83.9% control.
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
            // --- treatment (100 pages) ---
            "/grapher/age-dependency-ratio-of-working-age-population":
                "treatment",
            "/grapher/annual-co-emissions-by-region": "treatment",
            "/grapher/annual-co2-cement": "treatment",
            "/grapher/asthma-prevalence": "treatment",
            "/grapher/average-height-of-men-by-year-of-birth": "treatment",
            "/grapher/average-height-of-men-for-selected-countries":
                "treatment",
            "/grapher/average-monthly-surface-temperature": "treatment",
            "/grapher/carbon-dioxide-emissions-factor": "treatment",
            "/grapher/cattle-livestock-count-heads": "treatment",
            "/grapher/child-mortality": "treatment",
            "/grapher/children-born-per-woman": "treatment",
            "/grapher/coal-consumption-by-country-terawatt-hours-twh":
                "treatment",
            "/grapher/coal-production-by-country": "treatment",
            "/grapher/coal-proved-reserves": "treatment",
            "/grapher/cost-space-launches-low-earth-orbit": "treatment",
            "/grapher/covid-world-unvaccinated-people": "treatment",
            "/grapher/crude-birth-rate": "treatment",
            "/grapher/crude-oil-prices": "treatment",
            "/grapher/cumulative-co-emissions": "treatment",
            "/grapher/democracy-index-polity": "treatment",
            "/grapher/depressive-disorders-prevalence-ihme": "treatment",
            "/grapher/earthquake-deaths": "treatment",
            "/grapher/economic-inequality-gini-index": "treatment",
            "/grapher/electricity-generation": "treatment",
            "/grapher/energy-intensity": "treatment",
            "/grapher/excess-mortality-p-scores-average-baseline": "treatment",
            "/grapher/female-labor-force-participation-rates": "treatment",
            "/grapher/foreign-aid-received-net": "treatment",
            "/grapher/forest-area-as-share-of-land-area": "treatment",
            "/grapher/fossil-fuels-per-capita": "treatment",
            "/grapher/freedom-of-expression-index": "treatment",
            "/grapher/freedom-score-fh": "treatment",
            "/grapher/gdp-per-person-employed-constant-ppp": "treatment",
            "/grapher/gdp-worldbank": "treatment",
            "/grapher/gender-gap-in-average-wages-ilo": "treatment",
            "/grapher/gender-inequality-index-from-the-human-development-report":
                "treatment",
            "/grapher/ghg-per-protein-poore": "treatment",
            "/grapher/gross-national-income-per-capita-worldbank": "treatment",
            "/grapher/happiness-cantril-ladder": "treatment",
            "/grapher/homicide-rate-unodc": "treatment",
            "/grapher/income-share-top-1-before-tax-wid": "treatment",
            "/grapher/industrial-robots-in-operation-per-1000-employees":
                "treatment",
            "/grapher/infant-mortality": "treatment",
            "/grapher/installed-geothermal-capacity": "treatment",
            "/grapher/international-tourist-trips": "treatment",
            "/grapher/labor-productivity-per-hour-pennworldtable": "treatment",
            "/grapher/liberal-democracy-index": "treatment",
            "/grapher/life-expectancy-hmd-unwpp": "treatment",
            "/grapher/malnutrition-death-rates": "treatment",
            "/grapher/manufacturing-value-added-to-gdp": "treatment",
            "/grapher/median-income-after-tax-lis": "treatment",
            "/grapher/migrant-stock-share": "treatment",
            "/grapher/migrant-stock-total": "treatment",
            "/grapher/military-spending-sipri": "treatment",
            "/grapher/milk-production-tonnes": "treatment",
            "/grapher/natural-disasters-by-type": "treatment",
            "/grapher/nuclear-energy-generation": "treatment",
            "/grapher/number-airline-passengers": "treatment",
            "/grapher/number-of-natural-disaster-events": "treatment",
            "/grapher/oil-consumption-by-country": "treatment",
            "/grapher/oil-prices-inflation-adjusted": "treatment",
            "/grapher/oil-proved-reserves": "treatment",
            "/grapher/parkinsons-disease-prevalence-ihme": "treatment",
            "/grapher/per-capita-egg-consumption-kilograms-per-year":
                "treatment",
            "/grapher/period-average-age-of-mothers": "treatment",
            "/grapher/physicians-per-1000-people": "treatment",
            "/grapher/political-corruption-index": "treatment",
            "/grapher/political-polarization-score": "treatment",
            "/grapher/population": "treatment",
            "/grapher/population-density": "treatment",
            "/grapher/population-density-by-city": "treatment",
            "/grapher/population-regions-with-projections": "treatment",
            "/grapher/prevalence-of-undernourishment": "treatment",
            "/grapher/refugee-population-by-country-or-territory-of-origin":
                "treatment",
            "/grapher/registered-vehicles-per-1000-people": "treatment",
            "/grapher/renewable-share-energy": "treatment",
            "/grapher/research-spending-gdp": "treatment",
            "/grapher/rule-of-law-index": "treatment",
            "/grapher/schizophrenia-prevalence": "treatment",
            "/grapher/share-electricity-nuclear": "treatment",
            "/grapher/share-of-adults-defined-as-obese": "treatment",
            "/grapher/share-of-the-population-infected-with-hiv": "treatment",
            "/grapher/solar-energy-consumption": "treatment",
            "/grapher/solar-pv-prices": "treatment",
            "/grapher/soybean-production": "treatment",
            "/grapher/tax-revenues-as-a-share-of-gdp-unu-wider": "treatment",
            "/grapher/test-scores-ai-capabilities-relative-human-performance":
                "treatment",
            "/grapher/ti-corruption-perception-index": "treatment",
            "/grapher/tomato-production": "treatment",
            "/grapher/total-alcohol-consumption-per-capita-litres-of-pure-alcohol":
                "treatment",
            "/grapher/total-factor-productivity": "treatment",
            "/grapher/total-population-living-in-extreme-poverty-by-world-region":
                "treatment",
            "/grapher/unemployment-rate": "treatment",
            "/grapher/universal-health-coverage-index": "treatment",
            "/grapher/urban-population-share-2050": "treatment",
            "/grapher/voter-turnout-of-registered-voters": "treatment",
            "/grapher/wealth-share-richest-1-percent": "treatment",
            "/grapher/weekly-growth-covid-deaths": "treatment",
            "/grapher/world-bank-income-groups": "treatment",
            "/grapher/world-regions-according-to-the-world-bank": "treatment",
            // --- control (100 pages) ---
            "/grapher/agriculture-share-gdp": "control",
            "/grapher/annual-area-burnt-by-wildfires": "control",
            "/grapher/annual-co2-emissions-per-country": "control",
            "/grapher/annual-number-of-fires": "control",
            "/grapher/annual-temperature-anomalies": "control",
            "/grapher/annual-working-hours-per-worker": "control",
            "/grapher/anxiety-disorders-prevalence": "control",
            "/grapher/average-battery-cell-price": "control",
            "/grapher/average-precipitation-per-year": "control",
            "/grapher/carbon-intensity-electricity": "control",
            "/grapher/children-per-woman-un": "control",
            "/grapher/civil-society-participation-index": "control",
            "/grapher/co2-emissions-transport": "control",
            "/grapher/co2-intensity": "control",
            "/grapher/co2-long-term-concentration": "control",
            "/grapher/cocoa-bean-production": "control",
            "/grapher/consumer-price-index": "control",
            "/grapher/consumption-co2-per-capita": "control",
            "/grapher/cumulative-covid-vaccinations": "control",
            "/grapher/cumulative-installed-wind-energy-capacity-gigawatts":
                "control",
            "/grapher/daily-median-income": "control",
            "/grapher/daily-per-capita-protein-supply": "control",
            "/grapher/deaths-in-armed-conflicts-by-country": "control",
            "/grapher/diabetes-prevalence": "control",
            "/grapher/eating-disorders-prevalence": "control",
            "/grapher/economic-damage-from-natural-disasters": "control",
            "/grapher/electoral-democracy-index": "control",
            "/grapher/european-overseas-colonies-and-their-colonizers":
                "control",
            "/grapher/fertilizer-total-use": "control",
            "/grapher/fish-and-seafood-consumption-per-capita": "control",
            "/grapher/foreign-aid-given-per-capita": "control",
            "/grapher/fossil-fuels-share-energy": "control",
            "/grapher/free-and-fair-elections-index": "control",
            "/grapher/gdp-maddison-project-database": "control",
            "/grapher/gdp-per-capita-penn-world-table": "control",
            "/grapher/gdp-per-capita-worldbank": "control",
            "/grapher/gdp-per-capita-worldbank-constant-usd": "control",
            "/grapher/gdp-worldbank-constant-usd": "control",
            "/grapher/ghg-per-kg-poore": "control",
            "/grapher/global-gdp-over-the-long-run": "control",
            "/grapher/global-plastics-production": "control",
            "/grapher/growth-of-global-trade": "control",
            "/grapher/healthy-life-expectancy-at-birth": "control",
            "/grapher/historical-gov-spending-gdp": "control",
            "/grapher/hiv-death-rates": "control",
            "/grapher/homicide-rates-from-firearms": "control",
            "/grapher/human-capital-index-in-2018": "control",
            "/grapher/human-development-index-groups": "control",
            "/grapher/inflation-of-consumer-prices": "control",
            "/grapher/installed-solar-pv-capacity": "control",
            "/grapher/international-tourist-arrivals-by-region-of-origin":
                "control",
            "/grapher/lgbt-legal-equality-index": "control",
            "/grapher/life-expectancy-unwpp": "control",
            "/grapher/mean-years-of-schooling-long-run": "control",
            "/grapher/military-spending-as-a-share-of-gdp-sipri": "control",
            "/grapher/mobile-cellular-subscriptions-per-100-people": "control",
            "/grapher/monthly-spending-data-center-us": "control",
            "/grapher/multidimensional-poverty-index-mpi": "control",
            "/grapher/nasa-annual-budget": "control",
            "/grapher/number-of-internet-users": "control",
            "/grapher/number-of-measles-cases": "control",
            "/grapher/number-species-threatened": "control",
            "/grapher/oil-production-by-country": "control",
            "/grapher/peak-birth-month": "control",
            "/grapher/per-capita-electricity-generation": "control",
            "/grapher/per-capita-ghg-emissions": "control",
            "/grapher/per-capita-oil": "control",
            "/grapher/pesticide-use-tonnes": "control",
            "/grapher/political-regime": "control",
            "/grapher/prison-population-rate": "control",
            "/grapher/proportion-using-safely-managed-drinking-water":
                "control",
            "/grapher/renewable-water-resources-per-capita": "control",
            "/grapher/reported-cases-of-measles": "control",
            "/grapher/rice-production": "control",
            "/grapher/self-reported-trust-attitudes": "control",
            "/grapher/sex-ratio-at-birth": "control",
            "/grapher/share-electricity-renewables": "control",
            "/grapher/share-electricity-solar": "control",
            "/grapher/share-of-adults-who-are-overweight": "control",
            "/grapher/share-of-individuals-using-the-internet": "control",
            "/grapher/share-of-population-urban": "control",
            "/grapher/share-of-population-with-severe-food-insecurity":
                "control",
            "/grapher/share-of-the-population-with-access-to-electricity":
                "control",
            "/grapher/share-of-urban-population-living-in-slums": "control",
            "/grapher/share-with-mental-and-substance-disorders": "control",
            "/grapher/social-spending-oecd-longrun": "control",
            "/grapher/solar-electricity-per-capita": "control",
            "/grapher/sugar-cane-production": "control",
            "/grapher/suicide-death-rates": "control",
            "/grapher/total-ghg-emissions": "control",
            "/grapher/tourism-gdp-proportion-of-total-gdp": "control",
            "/grapher/trade-as-share-of-gdp": "control",
            "/grapher/urban-and-rural-population": "control",
            "/grapher/vegetable-consumption-per-capita": "control",
            "/grapher/wealth-share-richest-10-percent": "control",
            "/grapher/weekly-covid-cases": "control",
            "/grapher/weekly-covid-deaths": "control",
            "/grapher/wheat-production": "control",
            "/grapher/wind-generation": "control",
            "/grapher/yearly-number-of-objects-launched-into-outer-space":
                "control",
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
