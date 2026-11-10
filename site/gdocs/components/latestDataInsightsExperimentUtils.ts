import {
    LATEST_DATA_INSIGHTS_ARMS,
    LatestDataInsightsArm,
} from "@ourworldindata/utils"

/** Class that shows an element only to visitors in the given arm of the data
 * insights experiment (see LatestDataInsightsExperiment.scss). */
export const LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES: Record<
    LatestDataInsightsArm,
    string
> = {
    [LATEST_DATA_INSIGHTS_ARMS.carousel]:
        "latest-data-insights-experiment__carousel",
    [LATEST_DATA_INSIGHTS_ARMS.titles]: "latest-data-insights-experiment__grid",
}

/** Clicks are logged as `<prefix>_<arm>` (and `<prefix>_<arm>_see_all`), so
 * they can be split by page and experiment arm. */
export function getLatestDataInsightsTrackNote(
    prefix: string,
    arm: LatestDataInsightsArm
): string {
    return `${prefix}_${arm}`
}
