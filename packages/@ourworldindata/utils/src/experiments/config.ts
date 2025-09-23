import { SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE } from "@ourworldindata/types"
import { Experiment } from "./Experiment.js"

/*
 * Hard-coded active experiments.
 */
export const experiments: Experiment[] = [
    new Experiment({
        /*
         * Experiment: data-page-insight-btns-2
         *
         * Goal of experiment is to better understand user demand for "insights"
         * when viewing a data page. Each arm shows the user one or more buttons
         * beneath the grapher, varying the number of buttons and the type of text in
         * these buttons.
         *
         * Conditions:
         * - (a) "placebo" vs "generic" vs "specific" text
         *     - placebo text is button text that does not refer to insights (e.g. "Data sources and measurement")
         *     - generic text is button text that refers to a generic insights page (e.g. "View insights about this data")
         *     - specific text is button text that describes a concrete insight (e.g. "Women live longer than men, but how much longer varies widely around the world")
         * - (b) 1 vs 3 links shown
         * Control arm: no changes
         * Control arm control1: "what you should know about this data" block is moved down the page (also the case in all treatment arms)
         * Treatment arm treat00: placebo - 1 link
         * Treatment arm treat10: generic - 1 link
         * Treatment arm treat01: placebo - 3 links
         * Treatment arm treat11: generic - 3 links
         * Treatment arm treat20: specific - 1 link
         * Treatment arm treat21: specific - 3 links
         */
        id: "data-page-insight-btns-2",
        expires: "2025-10-01T00:00:00.000Z",
        arms: [
            {
                id: "control",
                fraction: 0.51,
                replaysSessionSampleRate:
                    SENTRY_DEFAULT_REPLAYS_SESSION_SAMPLE_RATE,
            },
            { id: "control1", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat00", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat10", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat01", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat11", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat20", fraction: 0.07, replaysSessionSampleRate: 1 },
            { id: "treat21", fraction: 0.07, replaysSessionSampleRate: 1 },
        ],
        paths: [
            "/grapher/co-emissions-per-capita",
            "/grapher/life-expectancy",
            "/grapher/child-mortality",
            "/grapher/population",
            "/grapher/population-density",
            "/grapher/carbon-intensity-electricity",
            "/grapher/human-rights-index-vdem",
            "/grapher/share-of-population-in-extreme-poverty",
            "/grapher/economic-inequality-gini-index",
            "/grapher/per-capita-energy-use",
        ],
    }),
]
