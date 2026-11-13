import cx from "clsx"

import {
    LATEST_DATA_INSIGHTS_ARMS,
    LatestDataInsightsArm,
} from "@ourworldindata/utils"
import {
    LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES,
    getLatestDataInsightsTrackNote,
} from "./latestDataInsightsExperimentUtils.js"
import LatestCarousel, { LatestCarouselItem } from "./LatestCarousel.js"
import LatestDataInsightsGrid from "./LatestDataInsightsGrid.js"
import LatestDataInsightsArmSwitcher from "./LatestDataInsightsArmSwitcher.js"

/**
 * The latest data insights in both layouts of the data insights experiment
 * (exp-latest-data-insights-v1): (A) the carousel and (B) the grid. Both
 * are baked into the page and CSS shows the one matching the visitor's arm,
 * falling back to the carousel outside the experiment. Used on the homepage
 * (LatestDataInsightsBlock) and at the bottom of data insight pages.
 */
export default function LatestDataInsightsExperiment({
    carouselClassName,
    gridClassName,
    items,
    seeAllHref,
    seeAllText,
    trackNotePrefix,
}: {
    carouselClassName?: string
    gridClassName?: string
    items: LatestCarouselItem[]
    seeAllHref: string
    seeAllText: string
    /** See getLatestDataInsightsTrackNote. */
    trackNotePrefix: string
}) {
    const getTrackNote = (arm: LatestDataInsightsArm): string =>
        getLatestDataInsightsTrackNote(trackNotePrefix, arm)

    return (
        <>
            <LatestDataInsightsArmSwitcher />
            <LatestCarousel
                className={cx(
                    LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES.carousel,
                    carouselClassName
                )}
                items={items}
                seeAllHref={seeAllHref}
                seeAllText={seeAllText}
                cardTrackNote={getTrackNote(LATEST_DATA_INSIGHTS_ARMS.carousel)}
            />
            <LatestDataInsightsGrid
                className={cx(
                    LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES.titles,
                    gridClassName
                )}
                items={items}
                seeAllHref={seeAllHref}
                seeAllText={seeAllText}
                trackNote={getTrackNote(LATEST_DATA_INSIGHTS_ARMS.titles)}
            />
        </>
    )
}
