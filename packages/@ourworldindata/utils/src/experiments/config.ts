import { Experiment } from "./Experiment.js"

/*
 * Hard-coded active experiments.
 */
export const experiments: Experiment[] = [
    /*
     * Experiment: dp-search-v1
     *
     * This experiment trials a search block on data pages beneath the grapher, compared
     * to the status quo of no search block. The search block surfaces a search input
     * and a list of suggested searches. This experiment is run on a sample of data pages.
     * The goal of the experiment is to get a feel for user demand for horizontal navigation,
     * both in absolute terms and in terms of the kinds of content they organically want to
     * navigate to next.
     *
     * Conditions:
     * - (a) status quo (control)
     * - (b) search block shown, search bar only (treat1)
     * - (c) search block shown, with suggested-search pills populated from
     *       the OWID topic vocabulary based on the data page's topic tags (treat2)
     * - (d) same as treat2, plus the Research & Writing block and the
     *       "Charts that include this data" block are hidden — the most
     *       aggressive variant (treat3)
     *
     */
    new Experiment({
        id: "data-page-search-v1",
        expires: "2026-12-31T00:00:00.000Z",
        arms: [
            { id: "control", fraction: 0 },
            {
                id: "treat1",
                fraction: 0.33,
                replaysSessionSampleRate: 0.25,
            },
            {
                id: "treat2",
                fraction: 0.33,
                replaysSessionSampleRate: 0.25,
            },
            {
                id: "treat3",
                fraction: 0.34,
                replaysSessionSampleRate: 0.25,
            },
        ],
        paths: [
            "/grapher/democracy-index-eiu",
            "/grapher/gdp-per-capita-worldbank",
            "/grapher/gdp-per-capita-maddison-project-database",
            "/grapher/life-expectancy",
            "/grapher/co-emissions-per-capita",
            "/grapher/human-development-index",
            "/grapher/population",
            "/grapher/human-rights-index-vdem",
            "/grapher/per-capita-energy-use",
            "/grapher/share-of-population-in-extreme-poverty",
            "/grapher/oil-production-by-country",
            "/grapher/carbon-intensity-electricity",
            "/grapher/share-electricity-renewables",
            "/grapher/unemployment-rate",
            "/grapher/economic-inequality-gini-index",
            "/grapher/child-mortality",
            "/grapher/cross-country-literacy-rates",
            "/grapher/gender-inequality-index-from-the-human-development-report",
            "/grapher/daily-per-capita-caloric-supply",
            "/grapher/number-of-measles-cases",
        ],
    }),
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
]
