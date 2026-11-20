import {
    LATEST_DATA_INSIGHTS_ARMS,
    LatestDataInsightsArm,
    OwidGdocDataInsightInterface,
} from "@ourworldindata/utils"
import { useContext } from "react"
import * as React from "react"
import LatestBreadcrumb from "../components/LatestBreadcrumb.js"
import LatestCarouselSection, {
    LatestCarouselSectionSeeAll,
} from "../components/LatestCarouselSection.js"
import LatestDataInsightsExperiment from "../components/LatestDataInsightsExperiment.js"
import {
    LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES,
    getLatestDataInsightsTrackNote,
} from "../components/latestDataInsightsExperimentUtils.js"
import CopyLinkButton from "../components/CopyLinkButton.js"
import RelatedTopicsList from "../components/RelatedTopicsList.js"
import StandalonePostBody, {
    STANDALONE_POST_GRID_CLASSES,
} from "../components/StandalonePostBody.js"
import { dataInsightsToCarouselItems } from "../components/latestCarouselItems.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { buildLatestPagePath } from "../../latest/latestUtils.js"

type DataInsightProps = {
    className?: string
} & Omit<
    OwidGdocDataInsightInterface,
    "contentMd5" | "markdown" | "publicationContext" | "revisionId"
>

export const DataInsightPage = (
    props: DataInsightProps
): React.ReactElement => {
    const attachments = useContext(AttachmentsContext)
    const latestDataInsights = attachments.latestDataInsights?.filter(
        (dataInsight) => dataInsight.content.title !== props.content.title
    )
    const items = dataInsightsToCarouselItems(latestDataInsights ?? [])
    const seeAllHref = buildLatestPagePath("data-insight")
    const seeAllText = "See all Data Insights"
    const trackNotePrefix = "data_insight_latest"
    const arms: LatestDataInsightsArm[] = Object.values(
        LATEST_DATA_INSIGHTS_ARMS
    )

    return (
        <div className="grid grid-cols-12-full-width standalone-post-page">
            <LatestBreadcrumb
                className={STANDALONE_POST_GRID_CLASSES}
                latestType="data-insight"
                title={props.content.title}
            />
            <StandalonePostBody
                title={props.content.title}
                authors={props.content.authors}
                authorRoles={props.content.authorRoles}
                body={props.content.body}
                publishedAt={props.publishedAt}
                footer={
                    <>
                        <RelatedTopicsList tags={props.tags ?? undefined} />
                        <CopyLinkButton
                            path={`/data-insights/${props.slug}`}
                            trackNote="data_insight_copy_link"
                        />
                    </>
                }
            />
            <LatestCarouselSection
                className="span-cols-12 col-start-2"
                heading="Our latest Data Insights"
                seeAllText={seeAllText}
                seeAllHref={seeAllHref}
                items={items}
                // One link per experiment arm, so its clicks are tracked by
                // arm. CSS shows the one matching the visitor's arm.
                seeAll={arms.map((arm) => (
                    <LatestCarouselSectionSeeAll
                        key={arm}
                        className={LATEST_DATA_INSIGHTS_ARM_CLASS_NAMES[arm]}
                        href={seeAllHref}
                        text={seeAllText}
                        trackNote={`${getLatestDataInsightsTrackNote(trackNotePrefix, arm)}_see_all`}
                    />
                ))}
            >
                <LatestDataInsightsExperiment
                    carouselClassName="latest-carousel-section__items"
                    gridClassName="latest-carousel-section__items"
                    items={items}
                    seeAllHref={seeAllHref}
                    seeAllText={seeAllText}
                    trackNotePrefix={trackNotePrefix}
                />
            </LatestCarouselSection>
        </div>
    )
}
