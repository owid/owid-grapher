import React, { useContext } from "react"
import cx from "classnames"

import { AttachmentsContext } from "../OwidGdoc.js"
import { Button } from "@ourworldindata/components"
import { NewsletterSubscriptionContext } from "../../newsletter.js"
import LatestDataInsights from "./LatestDataInsights.js"
import DataInsightsNewsletter from "./DataInsightsNewsletter.js"

export default function LatestDataInsightsBlock({
    className,
}: {
    className?: string
}) {
    const { latestDataInsights } = useContext(AttachmentsContext)
    if (!latestDataInsights?.length) return null

    return (
        <section className={cx(className, "latest-data-insights-block")}>
            <header className="latest-data-insights-block__header span-cols-8 col-start-2 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-bold">Daily Data Insights</h2>
                <p className="body-2-regular">
                    Bite-sized insights on how the world is changing, published
                    every weekday.
                </p>
            </header>
            <Button
                href="/data-insights"
                className="latest-data-insights-block__see-all-data-insights-button body-3-medium span-cols-4 col-start-10 span-sm-cols-12 col-sm-start-2"
                text="See all Daily Data Insights"
                theme="outline-vermillion"
            />
            <LatestDataInsights
                className="span-cols-12 col-start-2"
                latestDataInsights={latestDataInsights}
            />
            <DataInsightsNewsletter
                context={NewsletterSubscriptionContext.HomepageDataInsights}
            />
        </section>
    )
}
