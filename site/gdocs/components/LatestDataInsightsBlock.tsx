import { useContext } from "react"
import cx from "clsx"

import { AttachmentsContext } from "../AttachmentsContext.js"
import { Button } from "@ourworldindata/components"
import {
    LATEST_DATA_INSIGHTS_ARMS,
    LatestDataInsightsArm,
} from "@ourworldindata/utils"
import LatestDataInsightsExperiment from "./LatestDataInsightsExperiment.js"
import {
    LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES,
    getLatestDataInsightsTrackNote,
} from "./latestDataInsightsExperimentUtils.js"
import { dataInsightsToCarouselItems } from "./latestCarouselItems.js"
import { buildLatestPagePath } from "../../latest/latestUtils.js"

export default function LatestDataInsightsBlock({
    className,
}: {
    className?: string
}) {
    const { latestDataInsights } = useContext(AttachmentsContext)
    if (!latestDataInsights?.length) return null

    const seeAllHref = buildLatestPagePath("data-insight")
    const trackNotePrefix = "homepage_data_insights"
    const arms: LatestDataInsightsArm[] = Object.values(
        LATEST_DATA_INSIGHTS_ARMS
    )

    return (
        <section className={cx(className, "latest-data-insights-block")}>
            <header className="latest-data-insights-block__header span-cols-8 col-start-2 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-bold">Data Insights</h2>
                <p className="body-2-regular">
                    Bite-sized insights on how the world is changing, published
                    every few days.
                </p>
            </header>
            {/* One button per experiment arm, so its clicks are tracked by
                arm. CSS shows the one matching the visitor's arm. */}
            {arms.map((arm) => (
                <Button
                    key={arm}
                    href={seeAllHref}
                    className={cx(
                        "latest-data-insights-block__see-all-data-insights-button body-3-medium span-cols-4 col-start-10 span-sm-cols-12 col-sm-start-2",
                        LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES[arm]
                    )}
                    text="See all Data Insights"
                    theme="outline-vermillion"
                    dataTrackNote={`${getLatestDataInsightsTrackNote(trackNotePrefix, arm)}_see_all`}
                />
            ))}
            <LatestDataInsightsExperiment
                carouselClassName="span-cols-12 col-start-2"
                gridClassName="span-cols-12 col-start-2 span-sm-cols-13 col-sm-start-2"
                items={dataInsightsToCarouselItems(latestDataInsights)}
                seeAllHref={seeAllHref}
                seeAllText="See all our Data Insights"
                trackNotePrefix={trackNotePrefix}
            />
        </section>
    )
}
