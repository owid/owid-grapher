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
     * quasi-experimental. v2 is cluster randomised between pages: 330 data
     * pages, 165 assigned to the redesign and 165 kept on the current design,
     * each page fixed to one arm for every visitor. 330 rather than 300 is an
     * attrition buffer: if a page breaks mid-run (unpublished, re-slugged,
     * migrated to a multi-dim page) it and its pair partner are dropped and
     * ≥300 healthy pages remain.
     *
     * Page-level rather than visitor-level assignment because the two designs
     * differ in server-rendered markup: serving both from one page would mean
     * baking both metadata trees and hiding one, which duplicates indexable
     * content and double-fires the components' own analytics.
     *
     * Only the 165 TREATMENT pages are listed here, v1-style: this config's
     * one job is to make those pages bake with the metadata box. The full
     * pre-registered assignment — all 330 pages, both arms, the 165 traffic
     * pairs, seed 20260907, drawn 2026-09-09 before any outcome existed — is
     * committed in the internal analytics repo
     * (experiments/briefs/data_page_metadata_v2_20260803/assignment_v2_165T165C.json,
     * PR owid/analytics#1038), and the analysis identifies arms by slug and
     * date range from that file. Do not add, remove or re-slug entries here
     * mid-run without updating the analytics record: the two lists must stay
     * identical, and a control page must never appear here.
     *
     * Eligibility (as drawn): standard single-indicator data page, currently
     * published per its config JSON, in none of the three redirect ledgers,
     * ≥5 coview recommendations in related_charts (so the treatment design's
     * cards render), not in v1, verified live on 2026-09-09. Ranked by past-90-
     * day first-time landing sessions, matched into rank-adjacent pairs, one
     * seeded coin flip per pair. Realised traffic split 50.4/49.6.
     *
     * Known kludge, accepted: like v1, the middleware sets an
     * exp-data-page-metadata-v2=treatment cookie at path "/" for visitors of
     * these pages, which Tag Manager then forwards to GA4 on all their later
     * page views (including control pages). The GA4 experiment param is
     * therefore NOT how arms are identified — the slug lists are.
     *
     * Conditions:
     * - (a) control: the current data page (AboutThisData + Sources/Reuse sections)
     * - (b) treatment: the new metadata box in place of those sections
     *
     * Ending the experiment: edit this config and rebake in the same step.
     * Letting the expiry date flip the gate would leave baked treatment markup
     * hydrating against control on 165 pages until each one is rebaked. Remove
     * or update the fixtures in experiments.test.ts in the same PR: they look
     * this experiment up by id at collection time and fail CI if it is gone.
     */
    new Experiment({
        id: DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
        expires: "2026-12-31T00:00:00.000Z",
        arms: [
            { id: "control", fraction: 0.0 },
            { id: DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM, fraction: 1.0 },
        ],
        // The 165 treatment pages, sorted, exactly as in the analytics record.
        paths: [
            "/grapher/age-dependency-ratio-of-working-age-population",
            "/grapher/age-dependency-ratio-old",
            "/grapher/agricultural-output-dollars",
            "/grapher/agriculture-share-gdp",
            "/grapher/air-passengers-carried",
            "/grapher/annual-area-burnt-by-wildfires",
            "/grapher/annual-carbon-dioxide-emissions",
            "/grapher/annual-co2-cement",
            "/grapher/annual-co2-emissions-per-country",
            "/grapher/annual-healthcare-expenditure-per-capita",
            "/grapher/annual-temperature-anomalies",
            "/grapher/average-annual-surface-temperature",
            "/grapher/average-height-of-men-by-year-of-birth",
            "/grapher/bipolar-disorder-prevalence",
            "/grapher/burden-of-disease",
            "/grapher/carbon-dioxide-emissions-factor",
            "/grapher/cereal-production",
            "/grapher/child-mortality",
            "/grapher/children-born-per-woman",
            "/grapher/chocolate-consumption-per-person",
            "/grapher/civil-society-participation-index",
            "/grapher/co2-emissions-transport",
            "/grapher/coffee-production-by-region",
            "/grapher/consumer-price-index",
            "/grapher/covid-world-unvaccinated-people",
            "/grapher/crude-birth-rate",
            "/grapher/crude-death-rate",
            "/grapher/cumulative-co-emissions",
            "/grapher/cumulative-co2-emissions-region",
            "/grapher/cumulative-covid-deaths-region",
            "/grapher/cumulative-covid-vaccinations",
            "/grapher/data-centers-share-electricity-demand",
            "/grapher/death-rate-from-malnutrition",
            "/grapher/deaths-due-to-measles-gbd",
            "/grapher/deaths-from-conflict-and-terrorism",
            "/grapher/deaths-from-diarrheal-diseases",
            "/grapher/deaths-in-armed-conflicts-by-country",
            "/grapher/deliberative-democracy-index-vdem",
            "/grapher/dengue-incidence",
            "/grapher/diabetes-prevalence",
            "/grapher/drowning-death-rates",
            "/grapher/earthquake-deaths",
            "/grapher/electoral-democracy-index",
            "/grapher/energy-intensity",
            "/grapher/excess-mortality-p-scores-projected-baseline",
            "/grapher/female-homicide-rate",
            "/grapher/fire-death-rates",
            "/grapher/foreign-aid-received-net",
            "/grapher/foreign-direct-investment-net-inflows-as-share-of-gdp",
            "/grapher/forest-area-as-share-of-land-area",
            "/grapher/free-and-fair-elections-index",
            "/grapher/freedom-of-expression-index",
            "/grapher/freedom-score-fh",
            "/grapher/fruit-consumption-per-capita",
            "/grapher/future-life-expectancy-projections",
            "/grapher/gdp-maddison-project-database",
            "/grapher/gdp-penn-world-table",
            "/grapher/gdp-per-capita-worldbank-constant-usd",
            "/grapher/gdp-per-person-employed-constant-ppp",
            "/grapher/gdp-world-regions-stacked-area",
            "/grapher/gender-inequality-index-from-the-human-development-report",
            "/grapher/ghg-per-kg-poore",
            "/grapher/global-gdp-over-the-long-run",
            "/grapher/global-plastics-production",
            "/grapher/global-precipitation-anomaly",
            "/grapher/health-expenditure-and-financing-per-capita",
            "/grapher/healthy-life-expectancy-at-birth",
            "/grapher/homicide-rate",
            "/grapher/homicide-rate-unodc",
            "/grapher/homicide-rates-from-firearms",
            "/grapher/households-air-conditioning",
            "/grapher/human-papillomavirus-vaccine-immunization-schedule",
            "/grapher/incidence-of-malaria",
            "/grapher/inequality-adjusted-human-development-index",
            "/grapher/infant-mortality",
            "/grapher/inflation-of-consumer-prices",
            "/grapher/installed-solar-pv-capacity",
            "/grapher/international-tourist-trips",
            "/grapher/international-tourist-trips-per-1000-people",
            "/grapher/labor-productivity-per-hour-pennworldtable",
            "/grapher/labor-share-of-gdp",
            "/grapher/land-area-km",
            "/grapher/land-use-protein-poore",
            "/grapher/life-expectancy-hmd-unwpp",
            "/grapher/lithium-production",
            "/grapher/living-languages",
            "/grapher/locations-of-ongoing-armed-conflicts",
            "/grapher/maternal-mortality",
            "/grapher/mean-years-of-schooling-long-run",
            "/grapher/median-income-after-tax-lis",
            "/grapher/methane-emissions",
            "/grapher/migrant-stock-total",
            "/grapher/military-spending-as-a-share-of-gdp-sipri",
            "/grapher/milk-production-tonnes",
            "/grapher/mobile-cellular-subscriptions-per-100-people",
            "/grapher/monthly-spending-data-center-us",
            "/grapher/monthly-temperature-anomalies",
            "/grapher/multidimensional-poverty-index-mpi",
            "/grapher/net-zero-targets",
            "/grapher/number-airline-passengers",
            "/grapher/number-of-natural-disaster-events",
            "/grapher/number-species-threatened",
            "/grapher/oil-prices-inflation-adjusted",
            "/grapher/outdoor-air-pollution-exposure",
            "/grapher/parameters-in-notable-artificial-intelligence-systems",
            "/grapher/parkinsons-disease-prevalence-ihme",
            "/grapher/per-capita-egg-consumption-kilograms-per-year",
            "/grapher/per-capita-ghg-emissions",
            "/grapher/per-capita-milk-consumption",
            "/grapher/period-average-age-of-mothers",
            "/grapher/pesticide-use-per-hectare-of-cropland",
            "/grapher/political-corruption-index",
            "/grapher/political-polarization-score",
            "/grapher/population-density",
            "/grapher/population-of-the-worlds-largest-cities",
            "/grapher/population-unwpp",
            "/grapher/potato-production",
            "/grapher/poultry-production-tonnes",
            "/grapher/prison-population-rate",
            "/grapher/projections-extreme-poverty-wb",
            "/grapher/refugee-population-by-country-or-territory-of-asylum",
            "/grapher/refugee-population-by-country-or-territory-of-origin",
            "/grapher/reported-rabies-deaths",
            "/grapher/rice-production",
            "/grapher/road-accident-deaths-per-passenger-kilometers",
            "/grapher/schizophrenia-prevalence",
            "/grapher/self-reported-trust-attitudes",
            "/grapher/share-companies-using-artificial-intelligence",
            "/grapher/share-living-with-less-than-1-int--per-day",
            "/grapher/share-living-with-less-than-10-int--per-day",
            "/grapher/share-living-with-less-than-320-int--per-day",
            "/grapher/share-living-with-less-than-upper-middle-income-poverty-line",
            "/grapher/share-of-adults-defined-as-obese",
            "/grapher/share-of-adults-who-smoke",
            "/grapher/share-of-births-outside-marriage",
            "/grapher/share-of-consumer-expenditure-spent-on-food",
            "/grapher/share-of-cumulative-co2",
            "/grapher/share-of-government-expenditure-going-to-interest-payments",
            "/grapher/share-of-individuals-using-the-internet",
            "/grapher/share-of-out-of-pocket-expenditure-on-healthcare",
            "/grapher/share-of-population-urban",
            "/grapher/share-of-the-population-with-access-to-electricity",
            "/grapher/share-people-vaccinated-covid",
            "/grapher/share-with-drug-use-disorders",
            "/grapher/so-emissions-by-world-region-in-million-tonnes",
            "/grapher/social-spending-oecd-longrun",
            "/grapher/solar-pv-prices",
            "/grapher/soybean-production",
            "/grapher/test-scores-ai-capabilities-relative-human-performance",
            "/grapher/tomato-production",
            "/grapher/total-alcohol-consumption-per-capita-litres-of-pure-alcohol",
            "/grapher/total-ghg-emissions",
            "/grapher/total-gov-expenditure-percapita-oecd",
            "/grapher/tourism-gdp-proportion-of-total-gdp",
            "/grapher/unemployment-rate",
            "/grapher/universal-health-coverage-index",
            "/grapher/urban-population-share-2050",
            "/grapher/voter-turnout-of-registered-voters",
            "/grapher/weekly-covid-deaths",
            "/grapher/weekly-growth-covid-deaths",
            "/grapher/wheat-production",
            "/grapher/wheat-yields",
            "/grapher/wine-consumption-per-capita",
            "/grapher/world-bank-income-groups",
            "/grapher/yearly-number-of-objects-launched-into-outer-space",
        ],
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
    const id = `${EXPERIMENT_PREFIX}-${rawId}`
    const exp = experiments.find((e) => e.id === id)
    return !!exp && !exp.isExpired() && exp.isUrlInPaths(url)
}

/**
 * True if the given data page url should render the redesigned metadata layout.
 *
 * Two experiments put a page on the new design, both at 100% treatment on their
 * listed paths: v1 (10 pages) and v2 (the 165 treatment pages of the 330-page
 * randomised design; its controls are not listed here). This is the single
 * source of truth — the baker uses it to decide which pages get the extra
 * per-indicator metadata loaded, and the data page component uses it to pick
 * the markup, so the two can never disagree.
 */
export function isDataPageMetadataRedesignActive(url: string): boolean {
    return (
        isUrlInActiveExperiment(DATA_PAGE_METADATA_EXPERIMENT_ID, url) ||
        isUrlInActiveExperiment(DATA_PAGE_METADATA_V2_EXPERIMENT_ID, url)
    )
}
