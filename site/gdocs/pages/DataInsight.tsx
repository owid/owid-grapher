import {
    faArrowRight,
    faChain,
    faCheck,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    OwidGdocDataInsightInterface,
    formatAuthors,
    formatDate,
    copyToClipboard,
    MinimalTag,
} from "@ourworldindata/utils"
import React, { useContext } from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import LatestDataInsights from "../components/LatestDataInsights.js"
import { AttachmentsContext } from "../OwidGdoc.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

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
    latestDataInsights?: OwidGdocDataInsightInterface[]
    className?: string
}) => {
    const { latestDataInsights, className } = props
    if (!latestDataInsights?.length) return null

    return (
        <div className={cx(className, "data-insight-cards-container")}>
            <h2 className="h2-bold ">Our latest Daily Data Insights</h2>
            <div className="see-all-button-container">
                <a href="/data-insights" className="body-3-medium">
                    See all Daily Data Insights{" "}
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </div>
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
            <p className="h5-black-caps">Related topics: </p>
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

const DataInsightMeta = (props: {
    publishedAt: Date | string | null
    authors: string[]
    slug: string
}) => {
    const [hasCopied, setHasCopied] = React.useState(false)
    const innerText = hasCopied ? "Copied!" : "Copy link"
    const icon = hasCopied ? faCheck : faChain
    const publishedAt = props.publishedAt
        ? formatDate(new Date(props.publishedAt))
        : "Unpublished"

    return (
        <div className="span-cols-2 col-start-2 span-md-cols-10 col-md-start-3 span-sm-cols-14 col-sm-start-1 data-insight-meta">
            <div>
                <span className="data-insight-meta__published-at h6-black-caps">
                    {publishedAt}
                </span>
                <span className="data-insight-meta__authors body-3-medium">
                    {formatAuthors({ authors: props.authors })}
                </span>
            </div>
            <div>
                <label className="h6-black-caps" htmlFor="copy-link-button">
                    Share this insight
                </label>
                <button
                    aria-label="Copy link to clipboard"
                    id="copy-link-button"
                    className="data-insight-meta__copy-link-button body-3-medium"
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
                    <FontAwesomeIcon icon={icon} />
                    {innerText}
                </button>
            </div>
        </div>
    )
}

export const DataInsightBody = (
    props: OwidGdocDataInsightInterface & {
        anchor?: string
        publishedAt: Date | string | null
    }
) => {
    return (
        <div className="grid grid-cols-12-full-width span-cols-14">
            <DataInsightMeta
                publishedAt={props.publishedAt}
                authors={props.content.authors}
                slug={props.slug}
            />
            <div
                id={props.anchor}
                className={cx(
                    "span-cols-8 col-start-4 span-md-cols-10 col-md-start-3 span-sm-cols-14 col-sm-start-1 data-insight-body",
                    {
                        "data-insight-body--has-tags": !!props.tags?.length,
                    }
                )}
            >
                <h1 className="display-3-semibold">{props.content.title}</h1>
                <div className="data-insight-blocks">
                    <ArticleBlocks blocks={props.content.body} />
                </div>
                <RelatedTopicsList tags={props.tags ?? undefined} />
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
    const latestDataInsights = attachments.latestDataInsights?.filter(
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
        </div>
    )
}
