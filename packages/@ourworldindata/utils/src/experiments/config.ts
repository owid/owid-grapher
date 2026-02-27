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
     * - (b) search block shown (treat1)
     * - (c) search block shown, with other horizontal nav affordances removed (treat2)
     *
     */
    new Experiment({
        id: "data-page-search-v1",
        expires: "2026-12-31T00:00:00.000Z",
        arms: [
            { id: "control", fraction: 0.8 },
            {
                id: "treat1",
                fraction: 0.1,
                replaysSessionSampleRate: 0.25,
            },
            {
                id: "treat2",
                fraction: 0.1,
                replaysSessionSampleRate: 0.25,
            },
        ],
        paths: [
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
        expires: "2026-12-31T00:00:00.000Z",
        arms: [
            { id: "all-charts", fraction: 0.7 },
            {
                id: "featured-metrics",
                fraction: 0.3,
                replaysSessionSampleRate: 0.25,
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
