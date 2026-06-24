import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import type { StackedArticleHit, TopicPageHit } from "@ourworldindata/types"
import type { SearchResponse } from "instantsearch.js"
import { useSearchContext } from "./SearchContext.js"
import { Button, getCanonicalPath } from "@ourworldindata/components"
import { SearchStackedArticleHit } from "./SearchStackedArticleHit.js"

export const SearchWritingTopic = ({
    result,
}: {
    result: {
        title: string
        articles: SearchResponse<StackedArticleHit>
        topicPages: SearchResponse<TopicPageHit>
        totalCount: number
    }
}) => {
    const {
        actions: { setTopic },
        analytics,
    } = useSearchContext()

    if (result.totalCount === 0) return null

    function handleAddTopicClick() {
        setTopic(result.title)
        window.scrollTo({ top: 0 })
    }

    function handleHitClick(
        hit: StackedArticleHit | TopicPageHit,
        position: number
    ) {
        analytics.logSearchResultClick(hit, {
            position,
            source: "ribbon",
            ribbonTag: result.title,
        })
    }

    return (
        <section className="search-writing-topic-container">
            <div className="search-writing-topic">
                <button
                    className="search-writing-topic__header"
                    type="button"
                    aria-label={`Filter by topic ${result.title}`}
                    onClick={handleAddTopicClick}
                >
                    <h2 className="search-writing-topic__title">
                        {result.title}
                    </h2>
                    <div className="search-writing-topic__count">
                        {commafyNumber(result.totalCount)} articles and topic
                        pages
                        <div className="search-writing-topic__arrow">
                            <FontAwesomeIcon icon={faArrowRight} />
                        </div>
                    </div>
                </button>

                <div className="search-writing-topic__content">
                    <div className="search-writing-topic__featured-articles">
                        <h3 className="search-writing-topic__sub-title">
                            Featured articles
                        </h3>
                        <div className="search-writing-featured-articles__list">
                            {result.articles.hits.map((hit, index) => (
                                <SearchStackedArticleHit
                                    key={hit.objectID}
                                    hit={hit}
                                    onClick={() =>
                                        handleHitClick(hit, index + 1)
                                    }
                                />
                            ))}
                        </div>
                    </div>

                    <hr className="search-writing-topic__divider" />

                    <div className="search-writing-topic__featured-topic-pages">
                        <h3 className="search-writing-topic__sub-title">
                            Featured topic pages
                        </h3>
                        <ul className="search-writing-featured-topics__list">
                            {result.topicPages.hits.map((hit, index) => (
                                <li
                                    key={hit.objectID}
                                    className="search-writing-featured-topics__list-item"
                                >
                                    <a
                                        className="search-writing-topic-link"
                                        href={getCanonicalPath(
                                            hit.slug,
                                            hit.type
                                        )}
                                        onClick={() =>
                                            handleHitClick(hit, index + 1)
                                        }
                                    >
                                        {hit.title}
                                        <FontAwesomeIcon
                                            className="search-writing-topic-link__icon"
                                            icon={faArrowRight}
                                        />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <Button
                className="search-writing-topic__see-all"
                theme="solid-light-blue"
                text={`See all ${commafyNumber(result.totalCount)} articles and topic pages`}
                onClick={handleAddTopicClick}
            />
        </section>
    )
}
