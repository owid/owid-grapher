import cx from "classnames"
import {
    LatestDataInsight,
    OwidGdocDataInsightInterface,
    copyToClipboard,
    MinimalTag,
} from "@ourworldindata/utils"
import React, { useContext, useState } from "react"
import {
    faArrowRight,
    faChevronRight,
    faCheck,
    faChain,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import LinkedAuthor from "../components/LinkedAuthor.js"
import DataInsightDateline from "../components/DataInsightDateline.js"
import LatestDataInsights from "../components/LatestDataInsights.js"
import { AttachmentsContext } from "../OwidGdoc.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import DataInsightsNewsletterBanner from "../../DataInsightsNewsletterBanner.js"

export const MOST_RECENT_DATA_INSIGHT = "most-recent-data-insight"
export const SECOND_MOST_RECENT_INSIGHT = "second-most-recent-data-insight"
export const THIRD_MOST_RECENT_INSIGHT = "third-most-recent-data-insight"
export const FOURTH_MOST_RECENT_INSIGHT = "fourth-most-recent-data-insight"
export const FIFTH_MOST_RECENT_INSIGHT = "fifth-most-recent-data-insight"
export const SIXTH_MOST_RECENT_INSIGHT = "sixth-most-recent-data-insight"
export const SEVENTH_MOST_RECENT_INSIGHT = "seventh-most-recent-data-insight"

export const dataInsightIndexToIdMap: Record<number, string> = {
    0: MOST_RECENT_DATA_INSIGHT,
    1: SECOND_MOST_RECENT_INSIGHT,
    2: THIRD_MOST_RECENT_INSIGHT,
    3: FOURTH_MOST_RECENT_INSIGHT,
    4: FIFTH_MOST_RECENT_INSIGHT,
    5: SIXTH_MOST_RECENT_INSIGHT,
    6: SEVENTH_MOST_RECENT_INSIGHT,
}

export const LatestDataInsightCards = (props: {
    latestDataInsights?: LatestDataInsight[]
    className?: string
}) => {
    const { latestDataInsights, className } = props
    if (!latestDataInsights?.length) return null

    return (
        <div className={cx(className, "data-insight-cards-container")}>
            <h2 className="h2-bold ">Our latest Daily Data Insights</h2>
            <a href="/data-insights" className="see-all-button">
                See all Daily Data Insights{" "}
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
            <LatestDataInsights
                className="data-insights-carousel"
                latestDataInsights={latestDataInsights}
            />
        </div>
    )
}

const RelatedTopicsList = ({
    tags,
    className,
}: {
    tags?: MinimalTag[]
    className?: string
}) => {
    if (!tags?.length) return null
    return (
        <div className={cx(className, "data-insights-related-topics")}>
            <p className="body-2-semibold">Related topic pages:</p>
            <ul>
                {tags.map((tag) => (
                    <li key={tag.name}>
                        <a href={`/${tag.slug}`}>{tag.name}</a>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function CopyLinkButton(props: { slug: string }) {
    const [hasCopied, setHasCopied] = useState(false)
    return (
        <button
            aria-label="Copy link to clipboard"
            id="copy-link-button"
            className="data-insight-copy-link-button body-3-medium"
            onClick={() => {
                void copyToClipboard(
                    `${BAKED_BASE_URL}/data-insights/${props.slug}`
                )
                setHasCopied(true)
                setTimeout(() => {
                    setHasCopied(false)
                }, 1000)
            }}
        >
            {hasCopied ? (
                <>
                    <FontAwesomeIcon icon={faCheck} /> Copied!
                </>
            ) : (
                <>
                    <FontAwesomeIcon icon={faChain} /> Copy link
                </>
            )}
        </button>
    )
}

export const DataInsightBody = (
    props: OwidGdocDataInsightInterface & {
        anchor?: string
        publishedAt: Date | string | null
    }
) => {
    const publishedAt = props.publishedAt ? new Date(props.publishedAt) : null
    return (
        <div className="grid grid-cols-12-full-width span-cols-14">
            <div
                id={props.anchor}
                className={cx(
                    "span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-14 col-sm-start-1 data-insight-body",
                    {
                        "data-insight-body--has-tags": !!props.tags?.length,
                    }
                )}
            >
                <DataInsightDateline
                    className="data-insight__dateline"
                    publishedAt={publishedAt}
                    formatOptions={{
                        year: "numeric",
                        month: "long",
                        day: "2-digit",
                    }}
                />
                <h1 className="display-3-semibold">{props.content.title}</h1>
                <div className="data-insight-authors body-3-medium">
                    {props.content.authors.map((author, index) => (
                        <LinkedAuthor
                            className="data-insight-author"
                            key={index}
                            name={author}
                            includeImage={true}
                        />
                    ))}
                </div>
                <div className="data-insight-blocks">
                    <ArticleBlocks blocks={props.content.body} />
                </div>
                <div className="data-insight-footer">
                    <RelatedTopicsList tags={props.tags ?? undefined} />
                    <CopyLinkButton slug={props.slug} />
                </div>
            </div>
        </div>
    )
}

type DataInsightProps = {
    className?: string
} & OwidGdocDataInsightInterface

export const DataInsightPage = (
    props: DataInsightProps
): React.ReactElement => {
    const attachments = useContext(AttachmentsContext)
    const latestDataInsights = attachments.latestDataInsights
        ?.map((dataInsight, index) => ({ ...dataInsight, index }))
        .filter(
            (dataInsight) => dataInsight.content.title !== props.content.title
        )

    return (
        <div className="grid grid-cols-12-full-width data-insight-page">
            <div className="span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 col-sm-start-2 span-sm-cols-12 data-insight-breadcrumbs">
                <a href="/data-insights">Daily Data Insights</a>
                <FontAwesomeIcon icon={faChevronRight} />
                <span>{props.content.title}</span>
            </div>
            <DataInsightBody {...props} />
            <LatestDataInsightCards
                className="span-cols-12 col-start-2"
                latestDataInsights={latestDataInsights}
            />
            <DataInsightsNewsletterBanner />
        </div>
    )
}
