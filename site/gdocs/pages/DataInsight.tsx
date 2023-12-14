import {
    faArrowRight,
    faChain,
    faCheck,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    OwidGdocDataInsightInterface,
    formatAuthors,
    MinimalDataInsightInterface,
    formatDate,
    Tag,
    copyToClipboard,
} from "@ourworldindata/utils"
import React, { useContext } from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { AttachmentsContext } from "../OwidGdoc.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

export const MOST_RECENT_DATA_INSIGHT = "most-recent-data-insight"
export const SECOND_MOST_RECENT_INSIGHT = "second-most-recent-data-insight"
export const THIRD_MOST_RECENT_INSIGHT = "third-most-recent-data-insight"
export const FOURTH_MOST_RECENT_INSIGHT = "fourth-most-recent-data-insight"
export const FIFTH_MOST_RECENT_INSIGHT = "fifth-most-recent-data-insight"

export const indexToIdMap: Record<number, string> = {
    0: MOST_RECENT_DATA_INSIGHT,
    1: SECOND_MOST_RECENT_INSIGHT,
    2: THIRD_MOST_RECENT_INSIGHT,
    3: FOURTH_MOST_RECENT_INSIGHT,
    4: FIFTH_MOST_RECENT_INSIGHT,
}

const DataInsightCard = (props: MinimalDataInsightInterface): JSX.Element => {
    const publishedAt = props.publishedAt
        ? formatDate(new Date(props.publishedAt))
        : null
    return (
        <a
            href={`/data-insights#${indexToIdMap[props.index]}`}
            className="data-insight-card span-cols-3"
        >
            <p className="data-insight-card__published-at h6-black-caps">
                {publishedAt}
            </p>
            <p className="data-insight-card__title subtitle-2">{props.title}</p>
        </a>
    )
}

export const LatestDataInsightCards = (props: {
    latestDataInsights?: MinimalDataInsightInterface[]
    className?: string
}) => {
    const { latestDataInsights, className } = props
    if (!latestDataInsights?.length) return null

    return (
        <div className={cx(className, "grid", "data-insight-cards-container")}>
            <div className="span-cols-12 grid insight-cards-header">
                <h2 className="h2-bold span-cols-8 col-start-1">
                    Our latest data insights
                </h2>
                <div className="span-cols-3 col-start-10 see-all-button-container">
                    <a href="/data-insights" className="body-3-medium">
                        See all data insights{" "}
                        <FontAwesomeIcon icon={faArrowRight} />
                    </a>
                </div>
            </div>
            {latestDataInsights.map((dataInsight) => (
                <DataInsightCard key={dataInsight.title} {...dataInsight} />
            ))}
        </div>
    )
}

const RelatedTopicsList = ({
    tags,
    className,
}: {
    tags?: Tag[]
    className?: string
}) => {
    if (!tags?.length) return null
    return (
        <div className={cx(className, "data-insights-related-topics")}>
            <p>Related topics: </p>
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
        <div className="span-cols-2 col-start-2 data-insight-meta">
            <span className="data-insight-meta__published-at h6-black-caps">
                {publishedAt}
            </span>
            <span className="data-insight-meta__authors">
                {formatAuthors({ authors: props.authors })}
            </span>
            <div>
                <button
                    className="data-insight-meta__copy-link-button"
                    onClick={() => {
                        copyToClipboard(
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
        <>
            <DataInsightMeta
                publishedAt={props.publishedAt}
                authors={props.content.authors}
                slug={props.slug}
            />
            <div
                id={props.anchor}
                className={cx("span-cols-8 col-start-4 data-insight-body", {
                    "data-insight-body--has-tags": !!props.tags?.length,
                })}
            >
                <h1 className="display-3-semibold">{props.content.title}</h1>
                <div className="data-insight-blocks">
                    <ArticleBlocks blocks={props.content.body} />
                </div>
                <RelatedTopicsList tags={props.tags} />
            </div>
        </>
    )
}

type DataInsightProps = {
    className?: string
} & OwidGdocDataInsightInterface

export const DataInsightPage = (props: DataInsightProps): JSX.Element => {
    const attachments = useContext(AttachmentsContext)
    const latestDataInsights = attachments.latestDataInsights
        ?.filter((dataInsight) => dataInsight.title !== props.content.title)
        .slice(0, 4)

    return (
        <div className="grid grid-cols-12-full-width data-insight-page">
            <div className="span-cols-8 col-start-4 data-insight-breadcrumbs">
                <a href="/data-insights">Data Insights</a>
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
