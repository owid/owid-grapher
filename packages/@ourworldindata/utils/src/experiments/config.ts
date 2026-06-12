import {
    DATA_PAGE_METADATA_EXPERIMENT_ID,
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
            { id: "treatment", fraction: 1.0 },
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
