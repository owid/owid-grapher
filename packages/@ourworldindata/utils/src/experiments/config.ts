import { Experiment } from "./Experiment.js"

/*
 * Hard-coded active experiments.
 */
export const experiments: Experiment[] = [
    new Experiment({
        /*
         * Experiment: data-page-insight-butons-basic
         *
         * Control arm: no changes
         * Control arm control1: "what you should know about this data" block is moved down the page (also the case in arms treat0 and treat1)
         * Treatment arm treat0: show placebo button ("Data sources and measurement") beneath grapher
         * Treatment arm treat1: show "view insights about this data" button beneath grapher
         */
        id: "data-page-insight-buttons-basic",
        expires: "2025-08-31T00:00:00.000Z",
        arms: [
            // control arm
            { id: "control", fraction: 0.7, replaysSessionSampleRate: 0.1 },
            // control arm, with "what you should know about this data" block moved down
            { id: "control1", fraction: 0.1, replaysSessionSampleRate: 1 },
            // experimental arm: placebo button ("Data sources and measurement")
            { id: "treat0", fraction: 0.1, replaysSessionSampleRate: 1 },
            // experimental arm: "View insights about this data" button
            { id: "treat1", fraction: 0.1, replaysSessionSampleRate: 1 },
        ],
        paths: [
            "/grapher/co-emissions-per-capita",
            "/grapher/life-expectancy",
            "/grapher/democracy-index-eiu",
            "/grapher/child-mortality",
            "/grapher/population",
            "/grapher/carbon-intensity-electricity",
        ],
    }),
]
