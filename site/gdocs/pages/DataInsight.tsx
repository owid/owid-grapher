import {
    OwidGdocDataInsightInterface,
    formatAuthors,
} from "@ourworldindata/utils"
import { useContext } from "react"
import * as React from "react"
import LatestBreadcrumb from "../components/LatestBreadcrumb.js"
import LatestCarouselSection from "../components/LatestCarouselSection.js"
import CopyLinkButton from "../components/CopyLinkButton.js"
import RelatedTopicsList from "../components/RelatedTopicsList.js"
import StandalonePostBody, {
    STANDALONE_POST_GRID_CLASSES,
} from "../components/StandalonePostBody.js"
import { dataInsightsToCarouselItems } from "../components/latestCarouselItems.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { buildSocialText } from "../socialText.js"
import { CopySocialButton } from "../components/CopySocialButton.js"
import { buildLatestPagePath } from "../../latest/latestUtils.js"

function buildAuthorsNote(authors: string[]): string | undefined {
    if (authors.length === 0) return undefined
    return `(This Data Insight was written by ${formatAuthors(authors)}.)`
}

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
                body={props.content.body}
                publishedAt={props.publishedAt}
                footer={
                    <>
                        <RelatedTopicsList tags={props.tags ?? undefined} />
                        <CopyLinkButton
                            path={`/data-insights/${props.slug}`}
                            trackNote="data_insight_copy_link"
                        />
                        <CopySocialButton
                            className="copy-link-button"
                            text={buildSocialText({
                                title: props.content.title,
                                body: props.content.body,
                                authorsNote: buildAuthorsNote(
                                    props.content.authors
                                ),
                                linkedDocuments: attachments.linkedDocuments,
                            })}
                        />
                    </>
                }
            />
            <LatestCarouselSection
                className="span-cols-12 col-start-2"
                heading="Our latest Data Insights"
                seeAllText="See all Data Insights"
                seeAllHref={buildLatestPagePath("data-insight")}
                items={dataInsightsToCarouselItems(latestDataInsights ?? [])}
            />
        </div>
    )
}
