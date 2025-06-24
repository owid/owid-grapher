import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { SearchWritingTopicsResponse } from "./searchTypes.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { getCanonicalPath } from "@ourworldindata/components"
import { SearchArticleHit } from "./SearchArticleHit.js"

export const SearchWritingTopic = ({
    result,
}: {
    result: SearchWritingTopicsResponse
}) => {
    const {
        actions: { setTopic },
    } = useSearchContext()

    if (result.totalCount === 0) return null

    const handleAddTopicClick = (e: React.MouseEvent) => {
        e.preventDefault()
        setTopic(result.title)
        window.scrollTo({
            top: 0,
        })
    }

    return (
        <SearchAsDraft
            name="Writing Topic"
            className="span-cols-12 col-start-2"
        >
            <div className="search-writing-topic-section">
                <div className="search-writing-topic-section__header">
                    <h2 className="search-writing-topic-section__title">
                        {result.title}
                    </h2>
                    <button
                        className="search-writing-topic-section__count-button"
                        aria-label={`Filter by topic ${result.title}`}
                        onClick={handleAddTopicClick}
                    >
                        <span className="search-writing-topic-section__count">
                            {commafyNumber(result.totalCount)} articles and
                            topic pages
                        </span>
                        <div className="search-writing-topic-section__arrow">
                            <FontAwesomeIcon icon={faArrowRight} />
                        </div>
                    </button>
                </div>

                <div className="search-writing-topic-section__content">
                    <div className="search-writing-topic-section__left">
                        <h3 className="search-writing-featured-topics__title">
                            Featured topic pages
                        </h3>
                        <ul className="search-writing-featured-topics__list">
                            {result.topicPages.hits.map((hit) => (
                                <li
                                    key={hit.objectID}
                                    className="search-writing-topic-link"
                                >
                                    <a
                                        href={getCanonicalPath(
                                            hit.slug,
                                            hit.type
                                        )}
                                        className="search-writing-topic-link__anchor"
                                    >
                                        <span className="search-writing-topic-link__text">
                                            {hit.title}
                                        </span>
                                        <FontAwesomeIcon
                                            icon={faArrowRight}
                                            className="search-writing-topic-link__icon"
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="search-writing-topic-section__right">
                        <h3 className="search-writing-featured-articles__title">
                            Featured articles
                        </h3>
                        <div className="search-writing-featured-articles__grid">
                            {result.articles.hits.map((hit) => (
                                <SearchArticleHit
                                    key={hit.objectID}
                                    hit={hit}
                                    variant="stacked"
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </SearchAsDraft>
    )
}
