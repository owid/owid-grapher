import {
    EXPERIMENT_PREFIX,
    LATEST_DATA_INSIGHTS_ARMS,
    LATEST_DATA_INSIGHTS_EXPERIMENT_ID,
    LATEST_STICKY_FILTERS_ARMS,
    LATEST_STICKY_FILTERS_EXPERIMENT_ID,
} from "./constants.js"
import { Experiment } from "./Experiment.js"

/*
 * Hard-coded active experiments.
 */
export const experiments: Experiment[] = [
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
    // Compare normal scrolling, reveal-on-scroll-up, and fully sticky filters.
    // Mobile pins only the topic pills.
    // Layout and testing instructions: site/latest/README.md.
    new Experiment({
        id: LATEST_STICKY_FILTERS_EXPERIMENT_ID,
        expires: "2026-11-30T00:00:00.000Z",
        arms: [
            { id: LATEST_STICKY_FILTERS_ARMS.notSticky, fraction: 1 / 3 },
            {
                id: LATEST_STICKY_FILTERS_ARMS.revealOnScrollUp,
                fraction: 1 / 3,
            },
            { id: LATEST_STICKY_FILTERS_ARMS.fullySticky, fraction: 1 / 3 },
        ],
        paths: ["/latest"],
    }),
    // Compare two layouts of the latest data insights on the homepage and at
    // the bottom of data insight pages: (A) the current carousel and (B) the
    // /search grid of thumbnails and titles. "/" matches every path, so a
    // visitor keeps their arm across both pages.
    new Experiment({
        id: LATEST_DATA_INSIGHTS_EXPERIMENT_ID,
        expires: "2027-01-10T00:00:00.000Z",
        arms: [
            { id: LATEST_DATA_INSIGHTS_ARMS.carousel, fraction: 1 / 2 },
            { id: LATEST_DATA_INSIGHTS_ARMS.grid, fraction: 1 / 2 },
        ],
        paths: ["/"],
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
