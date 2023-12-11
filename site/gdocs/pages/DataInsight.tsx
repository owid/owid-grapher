import { faChain, faChevronRight } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    OwidGdocDataInsightInterface,
    formatAuthors,
    MinimalDataInsightInterface,
    formatDate,
    Tag,
} from "@ourworldindata/utils"
import React, { useContext } from "react"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { AttachmentsContext } from "../OwidGdoc.js"

const DataInsightCard = (props: MinimalDataInsightInterface): JSX.Element => {
    return (
        <a href={props.slug} className="data-insight-card">
            <p className="data-insight-card__published-at">
                {props.publishedAt}
            </p>
            <p className="data-insight-card__title">{props.title}</p>
        </a>
    )
}

export const LatestDataInsightCards = (props: { className?: string }) => {
    const { latestDataInsights } = useContext(AttachmentsContext)
    if (!latestDataInsights?.length) return null

    return (
        <div
            className={cx(
                props.className,
                "grid",
                "data-insight-cards-container"
            )}
        >
            <div className="span-cols-12 data-insight-divider" />
            <h2 className="span-cols-8 col-start-2">
                Our latest data insights
            </h2>
            <a href="/data-insights" className="span-cols-2 col-start-10">
                See all data insights
            </a>
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
    publishedAt: Date | null
    authors: string[]
}) => {
    return (
        <div className="span-cols-2 col-start-2 data-insight-meta">
            <span className="data-insight-meta__published-at h5-black-caps">
                {props.publishedAt
                    ? formatDate(props.publishedAt)
                    : "Unpublished"}
            </span>
            <span className="data-insight-meta__authors">
                {formatAuthors({ authors: props.authors })}
            </span>
            <div>
                <button className="data-insight-meta__copy-link-button">
                    <FontAwesomeIcon icon={faChain} />
                    Copy link
                </button>
            </div>
        </div>
    )
}

const DataInsightBody = (props: DataInsightProps) => {
    return (
        <>
            <DataInsightMeta
                publishedAt={props.publishedAt}
                authors={props.content.authors}
            />
            <div className="span-cols-8 col-start-4 data-insight-body">
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
    return (
        <div className="grid grid-cols-12-full-width data-insight-page">
            <div className="span-cols-8 col-start-4 data-insight-breadcrumbs">
                <a href="/data-insights">Data Insights</a>
                <FontAwesomeIcon icon={faChevronRight} />
                <span>{props.content.title}</span>
            </div>
            <DataInsightBody {...props} />
            <LatestDataInsightCards className="span-cols-12 col-start-1" />
        </div>
    )
}
