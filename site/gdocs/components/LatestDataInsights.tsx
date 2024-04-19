import React, { useContext } from "react"
import cx from "classnames"
import { AttachmentsContext } from "../OwidGdoc.js"
import { dataInsightIndexToIdMap } from "../pages/DataInsight.js"
import { formatDate } from "@ourworldindata/utils"
import { Button } from "@ourworldindata/components"

export const LatestDataInsightsBlock = ({
    className,
}: {
    className?: string
}) => {
    const attachments = useContext(AttachmentsContext)
    const latestDataInsights = attachments.latestDataInsights
    if (!latestDataInsights?.length) return null
    return (
        <section className={cx(className, "latest-data-insights-block")}>
            <header className="latest-data-insights-block__header span-cols-8 col-start-2 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-bold">Latest Data Insights</h2>
                <p className="body-2-regular">
                    Bite-sized insights on how the world is changing.
                </p>
            </header>
            <Button
                href="/data-insights"
                className="latest-data-insights-block__see-all-data-insights-button body-3-medium span-cols-4 col-start-10 span-sm-cols-12 col-sm-start-2"
                text="See all Data Insights"
                theme="outline-vermillion"
            />
            <div className="latest-data-insights-block__card-container span-cols-12 col-start-2">
                {latestDataInsights.map((dataInsight, index) => (
                    <a
                        className="latest-data-insights-block__card"
                        href={`/data-insights#${dataInsightIndexToIdMap[index]}`}
                        key={dataInsight.title}
                    >
                        <p className="latest-data-insights-block__card-date h6-black-caps">
                            {formatDate(new Date(dataInsight.publishedAt))}
                        </p>
                        <p className="latest-data-insights-block__card-title h3-bold">
                            {dataInsight.title}
                        </p>
                    </a>
                ))}
            </div>
        </section>
    )
}
