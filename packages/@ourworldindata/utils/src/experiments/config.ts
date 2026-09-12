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
     * quasi-experimental. This one is cluster randomised: 330 data pages, 165
     * assigned to the redesign, each page fixed to one arm for every visitor.
     * 330 rather than 300 is an attrition buffer: if a page breaks mid-run
     * (unpublished, re-slugged, migrated to a multi-dim page) it and its pair
     * partner are dropped and ≥300 healthy pages remain.
     *
     * Page-level rather than visitor-level assignment because the two designs
     * differ in server-rendered markup: serving both from one page would mean
     * baking both metadata trees and hiding one, which duplicates indexable
     * content and double-fires the components' own analytics. Clustering costs
     * power — placebo-calibrated MDE on first-time bounce is ~3.3pp over 2
     * weeks / ~2.5pp over 4 (the metadata-click outcomes are far better
     * powered) — which is why the page count is 330 rather than v1's 10.
     *
     * Pre-registered assignment, drawn by a seeded sampling notebook in the
     * internal analytics repo before any outcome was observed (seed 20260907):
     *   1. Eligible = standard single-indicator data page that is currently
     *      published per its config JSON (charts.publishedAt survives
     *      unpublishing, so it is necessary but not sufficient), appears in
     *      none of the three redirect ledgers (chart_slug_redirects,
     *      multi_dim_redirects, redirects), has ≥5 coview recommendations in
     *      related_charts (so the treatment design's cards render), is not in
     *      v1, and was verified live on the site on 2026-09-09.
     *   2. Ranked by first-time landing sessions (cookie-consenting,
     *      non-embed), the past 90 days (Jun 8 - Sep 5 2026). Top 330 enrolled.
     *   3. Matched on traffic: rank-adjacent pairs, one page of each of the
     *      165 pairs drawn to treatment by seeded coin flip. Realised balance:
     *      arms split session traffic 50.4/49.6, every decile 50.0±1.
     *
     * Conditions:
     * - (a) control: the current data page (AboutThisData + Sources/Reuse sections)
     * - (b) treatment: the new metadata box in place of those sections
     *
     * Ending the experiment: edit this config and rebake in the same step.
     * Letting the expiry date flip the gate would leave baked treatment markup
     * hydrating against control on 165 pages until each one is rebaked.
     */
    new Experiment({
        id: DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
        expires: "2026-12-31T00:00:00.000Z",
        unitOfAssignment: "page",
        arms: [
            // Both arms carry the same replay sample rate: replays sampled
            // asymmetrically would make any cross-arm comparison of session
            // recordings meaningless.
            { id: "control", fraction: 0.5, replaysSessionSampleRate: 0.33 },
            {
                id: DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM,
                fraction: 0.5,
                replaysSessionSampleRate: 0.33,
            },
        ],
        // Each page's arm is fixed here rather than drawn at request time, so
        // the assignment is reproducible at bake time and auditable in review.
        pathArms: {
            // --- treatment (165 pages) ---
            "/grapher/age-dependency-ratio-of-working-age-population":
                "treatment",
            "/grapher/age-dependency-ratio-old": "treatment",
            "/grapher/agricultural-output-dollars": "treatment",
            "/grapher/agriculture-share-gdp": "treatment",
            "/grapher/air-passengers-carried": "treatment",
            "/grapher/annual-area-burnt-by-wildfires": "treatment",
            "/grapher/annual-carbon-dioxide-emissions": "treatment",
            "/grapher/annual-co2-cement": "treatment",
            "/grapher/annual-co2-emissions-per-country": "treatment",
            "/grapher/annual-healthcare-expenditure-per-capita": "treatment",
            "/grapher/annual-temperature-anomalies": "treatment",
            "/grapher/average-annual-surface-temperature": "treatment",
            "/grapher/average-height-of-men-by-year-of-birth": "treatment",
            "/grapher/bipolar-disorder-prevalence": "treatment",
            "/grapher/burden-of-disease": "treatment",
            "/grapher/carbon-dioxide-emissions-factor": "treatment",
            "/grapher/cereal-production": "treatment",
            "/grapher/child-mortality": "treatment",
            "/grapher/children-born-per-woman": "treatment",
            "/grapher/chocolate-consumption-per-person": "treatment",
            "/grapher/civil-society-participation-index": "treatment",
            "/grapher/co2-emissions-transport": "treatment",
            "/grapher/coffee-production-by-region": "treatment",
            "/grapher/consumer-price-index": "treatment",
            "/grapher/covid-world-unvaccinated-people": "treatment",
            "/grapher/crude-birth-rate": "treatment",
            "/grapher/crude-death-rate": "treatment",
            "/grapher/cumulative-co-emissions": "treatment",
            "/grapher/cumulative-co2-emissions-region": "treatment",
            "/grapher/cumulative-covid-deaths-region": "treatment",
            "/grapher/cumulative-covid-vaccinations": "treatment",
            "/grapher/data-centers-share-electricity-demand": "treatment",
            "/grapher/death-rate-from-malnutrition": "treatment",
            "/grapher/deaths-due-to-measles-gbd": "treatment",
            "/grapher/deaths-from-conflict-and-terrorism": "treatment",
            "/grapher/deaths-from-diarrheal-diseases": "treatment",
            "/grapher/deaths-in-armed-conflicts-by-country": "treatment",
            "/grapher/deliberative-democracy-index-vdem": "treatment",
            "/grapher/dengue-incidence": "treatment",
            "/grapher/diabetes-prevalence": "treatment",
            "/grapher/drowning-death-rates": "treatment",
            "/grapher/earthquake-deaths": "treatment",
            "/grapher/electoral-democracy-index": "treatment",
            "/grapher/energy-intensity": "treatment",
            "/grapher/excess-mortality-p-scores-projected-baseline":
                "treatment",
            "/grapher/female-homicide-rate": "treatment",
            "/grapher/fire-death-rates": "treatment",
            "/grapher/foreign-aid-received-net": "treatment",
            "/grapher/foreign-direct-investment-net-inflows-as-share-of-gdp":
                "treatment",
            "/grapher/forest-area-as-share-of-land-area": "treatment",
            "/grapher/free-and-fair-elections-index": "treatment",
            "/grapher/freedom-of-expression-index": "treatment",
            "/grapher/freedom-score-fh": "treatment",
            "/grapher/fruit-consumption-per-capita": "treatment",
            "/grapher/future-life-expectancy-projections": "treatment",
            "/grapher/gdp-maddison-project-database": "treatment",
            "/grapher/gdp-penn-world-table": "treatment",
            "/grapher/gdp-per-capita-worldbank-constant-usd": "treatment",
            "/grapher/gdp-per-person-employed-constant-ppp": "treatment",
            "/grapher/gdp-world-regions-stacked-area": "treatment",
            "/grapher/gender-inequality-index-from-the-human-development-report":
                "treatment",
            "/grapher/ghg-per-kg-poore": "treatment",
            "/grapher/global-gdp-over-the-long-run": "treatment",
            "/grapher/global-plastics-production": "treatment",
            "/grapher/global-precipitation-anomaly": "treatment",
            "/grapher/health-expenditure-and-financing-per-capita": "treatment",
            "/grapher/healthy-life-expectancy-at-birth": "treatment",
            "/grapher/homicide-rate": "treatment",
            "/grapher/homicide-rate-unodc": "treatment",
            "/grapher/homicide-rates-from-firearms": "treatment",
            "/grapher/households-air-conditioning": "treatment",
            "/grapher/human-papillomavirus-vaccine-immunization-schedule":
                "treatment",
            "/grapher/incidence-of-malaria": "treatment",
            "/grapher/inequality-adjusted-human-development-index": "treatment",
            "/grapher/infant-mortality": "treatment",
            "/grapher/inflation-of-consumer-prices": "treatment",
            "/grapher/installed-solar-pv-capacity": "treatment",
            "/grapher/international-tourist-trips": "treatment",
            "/grapher/international-tourist-trips-per-1000-people": "treatment",
            "/grapher/labor-productivity-per-hour-pennworldtable": "treatment",
            "/grapher/labor-share-of-gdp": "treatment",
            "/grapher/land-area-km": "treatment",
            "/grapher/land-use-protein-poore": "treatment",
            "/grapher/life-expectancy-hmd-unwpp": "treatment",
            "/grapher/lithium-production": "treatment",
            "/grapher/living-languages": "treatment",
            "/grapher/locations-of-ongoing-armed-conflicts": "treatment",
            "/grapher/maternal-mortality": "treatment",
            "/grapher/mean-years-of-schooling-long-run": "treatment",
            "/grapher/median-income-after-tax-lis": "treatment",
            "/grapher/methane-emissions": "treatment",
            "/grapher/migrant-stock-total": "treatment",
            "/grapher/military-spending-as-a-share-of-gdp-sipri": "treatment",
            "/grapher/milk-production-tonnes": "treatment",
            "/grapher/mobile-cellular-subscriptions-per-100-people":
                "treatment",
            "/grapher/monthly-spending-data-center-us": "treatment",
            "/grapher/monthly-temperature-anomalies": "treatment",
            "/grapher/multidimensional-poverty-index-mpi": "treatment",
            "/grapher/net-zero-targets": "treatment",
            "/grapher/number-airline-passengers": "treatment",
            "/grapher/number-of-natural-disaster-events": "treatment",
            "/grapher/number-species-threatened": "treatment",
            "/grapher/oil-prices-inflation-adjusted": "treatment",
            "/grapher/outdoor-air-pollution-exposure": "treatment",
            "/grapher/parameters-in-notable-artificial-intelligence-systems":
                "treatment",
            "/grapher/parkinsons-disease-prevalence-ihme": "treatment",
            "/grapher/per-capita-egg-consumption-kilograms-per-year":
                "treatment",
            "/grapher/per-capita-ghg-emissions": "treatment",
            "/grapher/per-capita-milk-consumption": "treatment",
            "/grapher/period-average-age-of-mothers": "treatment",
            "/grapher/pesticide-use-per-hectare-of-cropland": "treatment",
            "/grapher/political-corruption-index": "treatment",
            "/grapher/political-polarization-score": "treatment",
            "/grapher/population-density": "treatment",
            "/grapher/population-of-the-worlds-largest-cities": "treatment",
            "/grapher/population-unwpp": "treatment",
            "/grapher/potato-production": "treatment",
            "/grapher/poultry-production-tonnes": "treatment",
            "/grapher/prison-population-rate": "treatment",
            "/grapher/projections-extreme-poverty-wb": "treatment",
            "/grapher/refugee-population-by-country-or-territory-of-asylum":
                "treatment",
            "/grapher/refugee-population-by-country-or-territory-of-origin":
                "treatment",
            "/grapher/reported-rabies-deaths": "treatment",
            "/grapher/rice-production": "treatment",
            "/grapher/road-accident-deaths-per-passenger-kilometers":
                "treatment",
            "/grapher/schizophrenia-prevalence": "treatment",
            "/grapher/self-reported-trust-attitudes": "treatment",
            "/grapher/share-companies-using-artificial-intelligence":
                "treatment",
            "/grapher/share-living-with-less-than-1-int--per-day": "treatment",
            "/grapher/share-living-with-less-than-10-int--per-day": "treatment",
            "/grapher/share-living-with-less-than-320-int--per-day":
                "treatment",
            "/grapher/share-living-with-less-than-upper-middle-income-poverty-line":
                "treatment",
            "/grapher/share-of-adults-defined-as-obese": "treatment",
            "/grapher/share-of-adults-who-smoke": "treatment",
            "/grapher/share-of-births-outside-marriage": "treatment",
            "/grapher/share-of-consumer-expenditure-spent-on-food": "treatment",
            "/grapher/share-of-cumulative-co2": "treatment",
            "/grapher/share-of-government-expenditure-going-to-interest-payments":
                "treatment",
            "/grapher/share-of-individuals-using-the-internet": "treatment",
            "/grapher/share-of-out-of-pocket-expenditure-on-healthcare":
                "treatment",
            "/grapher/share-of-population-urban": "treatment",
            "/grapher/share-of-the-population-with-access-to-electricity":
                "treatment",
            "/grapher/share-people-vaccinated-covid": "treatment",
            "/grapher/share-with-drug-use-disorders": "treatment",
            "/grapher/so-emissions-by-world-region-in-million-tonnes":
                "treatment",
            "/grapher/social-spending-oecd-longrun": "treatment",
            "/grapher/solar-pv-prices": "treatment",
            "/grapher/soybean-production": "treatment",
            "/grapher/test-scores-ai-capabilities-relative-human-performance":
                "treatment",
            "/grapher/tomato-production": "treatment",
            "/grapher/total-alcohol-consumption-per-capita-litres-of-pure-alcohol":
                "treatment",
            "/grapher/total-ghg-emissions": "treatment",
            "/grapher/total-gov-expenditure-percapita-oecd": "treatment",
            "/grapher/tourism-gdp-proportion-of-total-gdp": "treatment",
            "/grapher/unemployment-rate": "treatment",
            "/grapher/universal-health-coverage-index": "treatment",
            "/grapher/urban-population-share-2050": "treatment",
            "/grapher/voter-turnout-of-registered-voters": "treatment",
            "/grapher/weekly-covid-deaths": "treatment",
            "/grapher/weekly-growth-covid-deaths": "treatment",
            "/grapher/wheat-production": "treatment",
            "/grapher/wheat-yields": "treatment",
            "/grapher/wine-consumption-per-capita": "treatment",
            "/grapher/world-bank-income-groups": "treatment",
            "/grapher/yearly-number-of-objects-launched-into-outer-space":
                "treatment",
            // --- control (165 pages) ---
            "/grapher/academic-freedom-index": "control",
            "/grapher/annual-area-burnt-by-wildfires-gwis": "control",
            "/grapher/annual-co-emissions-by-region": "control",
            "/grapher/annual-co-emissions-from-aviation": "control",
            "/grapher/annual-industrial-robots-installed": "control",
            "/grapher/annual-number-of-births-by-world-region": "control",
            "/grapher/annual-number-of-fires": "control",
            "/grapher/annual-share-of-co2-emissions": "control",
            "/grapher/annual-working-hours-per-worker": "control",
            "/grapher/anxiety-disorders-prevalence": "control",
            "/grapher/asthma-prevalence": "control",
            "/grapher/average-battery-cell-price": "control",
            "/grapher/average-height-of-men-for-selected-countries": "control",
            "/grapher/average-hourly-earnings": "control",
            "/grapher/average-monthly-surface-temperature": "control",
            "/grapher/average-precipitation-per-year": "control",
            "/grapher/banana-production": "control",
            "/grapher/beer-consumption-per-person": "control",
            "/grapher/cancer-death-rates": "control",
            "/grapher/cancer-incidence": "control",
            "/grapher/cardiovascular-disease-death-rates": "control",
            "/grapher/cattle-livestock-count-heads": "control",
            "/grapher/cereal-yield": "control",
            "/grapher/child-mortality-igme": "control",
            "/grapher/children-aged-5-17-engaged-in-labor": "control",
            "/grapher/children-per-woman-un": "control",
            "/grapher/co2-intensity": "control",
            "/grapher/co2-long-term-concentration": "control",
            "/grapher/cocoa-bean-production": "control",
            "/grapher/computation-used-to-train-notable-artificial-intelligence-systems":
                "control",
            "/grapher/consumption-co2-emissions": "control",
            "/grapher/consumption-co2-per-capita": "control",
            "/grapher/cost-space-launches-low-earth-orbit": "control",
            "/grapher/covid-vaccination-doses-per-capita": "control",
            "/grapher/crude-oil-prices": "control",
            "/grapher/cumulative-installed-wind-energy-capacity-gigawatts":
                "control",
            "/grapher/daily-meat-consumption-per-person": "control",
            "/grapher/daily-per-capita-protein-supply": "control",
            "/grapher/damage-costs-from-natural-disasters": "control",
            "/grapher/days-of-vacation-and-holidays": "control",
            "/grapher/death-rate-from-famines-by-year": "control",
            "/grapher/death-rate-from-obesity": "control",
            "/grapher/death-rate-smoking": "control",
            "/grapher/death-rates-road-incidents": "control",
            "/grapher/deaths-from-infectious-diseases": "control",
            "/grapher/democracy-index-polity": "control",
            "/grapher/depressive-disorders-prevalence-ihme": "control",
            "/grapher/diarrheal-disease-death-rates": "control",
            "/grapher/eating-disorders-prevalence": "control",
            "/grapher/economic-damage-from-natural-disasters": "control",
            "/grapher/egg-production-thousand-tonnes": "control",
            "/grapher/european-overseas-colonies-and-their-colonizers":
                "control",
            "/grapher/excess-mortality-p-scores-average-baseline": "control",
            "/grapher/exponential-growth-of-computation-in-the-training-of-notable-ai-systems":
                "control",
            "/grapher/female-labor-force-participation-rates": "control",
            "/grapher/fertilizer-total-use": "control",
            "/grapher/fish-and-seafood-consumption-per-capita": "control",
            "/grapher/foreign-aid-given-as-a-share-of-national-income":
                "control",
            "/grapher/foreign-aid-given-net": "control",
            "/grapher/foreign-aid-given-per-capita": "control",
            "/grapher/foreign-aid-received-per-capita": "control",
            "/grapher/gdp-per-capita-growth": "control",
            "/grapher/gdp-per-capita-penn-world-table": "control",
            "/grapher/gdp-per-capita-worldbank": "control",
            "/grapher/gdp-worldbank": "control",
            "/grapher/gdp-worldbank-constant-usd": "control",
            "/grapher/gender-gap-in-average-wages-ilo": "control",
            "/grapher/ghg-kcal-poore": "control",
            "/grapher/ghg-per-protein-poore": "control",
            "/grapher/global-average-gdp-per-capita-over-the-long-run":
                "control",
            "/grapher/global-meat-production": "control",
            "/grapher/global-mine-production-minerals": "control",
            "/grapher/global-temperature-anomalies-by-el-nino-la-nina":
                "control",
            "/grapher/global-temperature-anomalies-by-month": "control",
            "/grapher/gross-national-income-per-capita-undp": "control",
            "/grapher/gross-national-income-per-capita-worldbank": "control",
            "/grapher/growth-of-global-trade": "control",
            "/grapher/happiness-cantril-ladder": "control",
            "/grapher/historical-gov-spending-gdp": "control",
            "/grapher/homicides-by-firearm": "control",
            "/grapher/homicides-unodc": "control",
            "/grapher/human-capital-index-in-2018": "control",
            "/grapher/human-development-index-groups": "control",
            "/grapher/industrial-robots-in-operation-per-1000-employees":
                "control",
            "/grapher/installed-global-renewable-energy-capacity-by-technology":
                "control",
            "/grapher/international-tourist-arrivals-by-region-of-origin":
                "control",
            "/grapher/land-use-kcal-poore": "control",
            "/grapher/land-use-per-kg-poore": "control",
            "/grapher/leading-cause-of-death": "control",
            "/grapher/lgbt-legal-equality-index": "control",
            "/grapher/liberal-democracy-index": "control",
            "/grapher/life-expectancy-unwpp": "control",
            "/grapher/long-run-birth-rate": "control",
            "/grapher/maize-production": "control",
            "/grapher/male-female-ratio-suicides-rates": "control",
            "/grapher/malnutrition-death-rates": "control",
            "/grapher/manufacturing-share-of-total-employment": "control",
            "/grapher/manufacturing-value-added-to-gdp": "control",
            "/grapher/meat-supply-per-person": "control",
            "/grapher/migrant-stock-share": "control",
            "/grapher/military-spending-sipri": "control",
            "/grapher/natural-disasters-by-type": "control",
            "/grapher/net-food-trade-as-a-share-of-domestic-supply": "control",
            "/grapher/number-of-internet-users": "control",
            "/grapher/number-of-measles-cases": "control",
            "/grapher/obesity-prevalence-adults-who-gho": "control",
            "/grapher/oecd-average-trust-in-governments": "control",
            "/grapher/palm-oil-production": "control",
            "/grapher/peak-birth-month": "control",
            "/grapher/people-practicing-open-defecation-of-population":
                "control",
            "/grapher/pesticide-use-tonnes": "control",
            "/grapher/physicians-per-1000-people": "control",
            "/grapher/pig-livestock-count-heads": "control",
            "/grapher/police-officers-per-1000-people": "control",
            "/grapher/political-regime": "control",
            "/grapher/population": "control",
            "/grapher/population-density-by-city": "control",
            "/grapher/population-regions-with-projections": "control",
            "/grapher/prevalence-of-undernourishment": "control",
            "/grapher/private-investment-in-artificial-intelligence": "control",
            "/grapher/proportion-using-safely-managed-drinking-water":
                "control",
            "/grapher/public-health-expenditure-share-gdp": "control",
            "/grapher/public-sector-employment-as-a-share-of-total-employment":
                "control",
            "/grapher/red-list-index": "control",
            "/grapher/registered-vehicles-per-1000-people": "control",
            "/grapher/renewable-water-resources-per-capita": "control",
            "/grapher/reported-cases-of-measles": "control",
            "/grapher/research-spending-gdp": "control",
            "/grapher/researchers-in-rd-per-million-people": "control",
            "/grapher/rice-yields": "control",
            "/grapher/rule-of-law-index": "control",
            "/grapher/same-sex-sexual-acts-legal-mignot": "control",
            "/grapher/scientific-publications-per-million": "control",
            "/grapher/sex-ratio-at-birth": "control",
            "/grapher/share-in-informal-employment": "control",
            "/grapher/share-of-adults-who-are-overweight": "control",
            "/grapher/share-of-children-younger-than-5-who-suffer-from-stunting":
                "control",
            "/grapher/share-of-employment-in-agriculture": "control",
            "/grapher/share-of-population-with-severe-food-insecurity":
                "control",
            "/grapher/share-of-students-from-abroad": "control",
            "/grapher/share-of-the-population-infected-with-hiv": "control",
            "/grapher/share-of-the-population-with-completed-tertiary-education":
                "control",
            "/grapher/share-of-urban-population-living-in-slums": "control",
            "/grapher/share-of-women-in-parliament": "control",
            "/grapher/share-with-mental-and-substance-disorders": "control",
            "/grapher/significant-earthquakes": "control",
            "/grapher/sugar-cane-production": "control",
            "/grapher/suicide-death-rates": "control",
            "/grapher/tax-revenues-as-a-share-of-gdp-unu-wider": "control",
            "/grapher/temperature-anomaly": "control",
            "/grapher/ti-corruption-perception-index": "control",
            "/grapher/total-factor-productivity": "control",
            "/grapher/total-population-in-extreme-poverty": "control",
            "/grapher/total-population-living-in-extreme-poverty-by-world-region":
                "control",
            "/grapher/trade-as-share-of-gdp": "control",
            "/grapher/urban-and-rural-population": "control",
            "/grapher/urban-vs-rural-majority": "control",
            "/grapher/urbanization-vs-gdp": "control",
            "/grapher/vegetable-consumption-per-capita": "control",
            "/grapher/water-withdrawals-per-kg-poore": "control",
            "/grapher/weekly-covid-cases": "control",
            "/grapher/weekly-growth-covid-cases": "control",
            "/grapher/who-regions": "control",
            "/grapher/women-civil-liberties-index": "control",
            "/grapher/world-regions-according-to-the-world-bank": "control",
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
 * cluster randomises 330 data pages and so has a real control arm. This is the
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
