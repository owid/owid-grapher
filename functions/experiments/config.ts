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
         * Control arm c1: "what you should know about this data" block is moved down the page (also the case in arms t0 and t1)
         * Treatment arm t0: show placebo button ("Data sources and measurement") beneath grapher
         * Treatment arm t1: show "view insights about this data" button beneath grapher
         */
        id: "data-page-insight-buttons-basic",
        expires: "2025-08-31T00:00:00.000Z",
        arms: [
            // control arm
            { id: "c", fraction: 0.7, replaysSessionSampleRate: 0.1 },
            // control arm, with "what you should know about this data" block moved down
            { id: "c1", fraction: 0.1, replaysSessionSampleRate: 1 },
            // experimental arm: placebo button ("Data sources and measurement")
            { id: "t0", fraction: 0.1, replaysSessionSampleRate: 1 },
            // experimental arm: "View insights about this data" button
            { id: "t1", fraction: 0.1, replaysSessionSampleRate: 1 },
        ],
        paths: [
            "/grapher/life-expectancy",
            "/grapher/co-emissions-per-capita",
            "/grapher/gdp-per-capita-worldbank",
        ],
    }),
    // note: the below experiment "data-page-insight-butons-full" is a more elaborate
    // version of the above "data-page-insight-butons-basic" experiment, but cannot
    // run at the same time (which is why it has an expiry date in the past, so that
    // it will not be active).
    new Experiment({
        /*
         * Experiment: data-page-insight-butons-full
         *
         * Goal of experiment is to better understand user demand for "insights"
         * when viewing a data page. Each arm shows the user one or more buttons
         * beneath the grapher, varying the number of buttons, the type of text in
         * these buttons, and whether or not a thumbnail is shown.
         *
         * Conditions:
         * - (a) "placebo" vs "generic" vs "specific" text
         *     - placebo text is button text that does not refer to insights (e.g. "Data sources and measurement")
         *     - generic text is button text that refers to a generic insights page (e.g. "View insights about this data")
         *     - specific text is button text that describes a concrete insight (e.g. "Women live longer than men, but how much longer varies widely around the world")
         * - (b) 1 vs 3 links shown
         * - (c) no thumbnail vs thumbnail
         *      - for "placebo" text, we exclude the thumbnail condition
         *      - for "generic" text, thumbnail is of the latest data insight on the data page's primary {topic}
         *      - for "specific" text, thumbnail is of the data insight that matches the button text
         *
         * Control arm: no changes
         * Treatment arm t000: placebo - 1 link - no thumbnail
         * Treatment arm t010: placebo - 3 links - no thumbnail
         * Treatment arm t100: generic - 1 link - no thumbnail
         * Treatment arm t110: generic - 3 links - no thumbnail
         * Treatment arm t101: generic - 1 link - thumbnail
         * Treatment arm t200: specific - 1 link - no thumbnail
         * Treatment arm t210: specific - 3 links - no thumbnail
         * Treatment arm t201: specific - 1 link - thumbnail
         * Treatment arm t211: specific - 3 links - thumbnail
         *
         * Note: a few condition combinations are excluded from the experiment
         * b/c they are either nonsensical or not useful for our purposes.
         * e.g. t001: placebo - 1 link - thumbnail.
         */
        id: "data-page-insight-buttons-full",
        expires: "2025-01-01T00:00:00.000Z", // this experiment is disabled
        arms: [
            // control arm
            { id: "c", fraction: 0.55, replaysSessionSampleRate: 0.1 },
            // Treatment arm t000: placebo - 1 link - no thumbnail
            { id: "t000", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t010: placebo - 3 links - no thumbnail
            { id: "t010", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t100: generic - 1 link - no thumbnail
            { id: "t100", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t110: generic - 3 links - no thumbnail
            { id: "t110", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t101: generic - 1 link - thumbnail
            { id: "t101", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t200: specific - 1 link - no thumbnail
            { id: "t200", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t210: specific - 3 links - no thumbnail
            { id: "t210", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t201: specific - 1 link - thumbnail
            { id: "t201", fraction: 0.05, replaysSessionSampleRate: 1 },
            // Treatment arm t211: specific - 3 links - thumbnail
            { id: "t211", fraction: 0.05, replaysSessionSampleRate: 1 },
        ],
        paths: ["/grapher/"],
    }),
]
