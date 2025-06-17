import { useQuery } from "@tanstack/react-query"
import { getCanonicalUrl } from "@ourworldindata/components"
import { ArticleHit, TopicPageHit } from "./searchTypes.js"
import { searchQueryKeys, queryArticles, queryTopicPages } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { AsDraft } from "../AsDraft/AsDraft.js"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { Snippet } from "react-instantsearch"
import { OwidGdocType } from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"

const SearchArticleHit = ({ hit }: { hit: ArticleHit }) => {
    const isArticle = hit.type === OwidGdocType.Article

    const href = getCanonicalUrl("", {
        slug: hit.slug,
        content: {
            type: hit.type,
        },
    })

    return (
        <AsDraft name="Article Hit - 🙈 country">
            <a href={href} className="search-writing-results__hit">
                {hit.thumbnailUrl && (
                    <div className="search-writing-results__hit-image-container">
                        <img
                            src={hit.thumbnailUrl}
                            role="presentation"
                            className="search-writing-results__hit-image"
                            alt=""
                        />
                    </div>
                )}
                <div className="search-writing-results__hit-content">
                    <header className="search-writing-results__hit-header">
                        {isArticle && hit.date && (
                            <DataInsightDateline
                                className="search-writing-results__hit-dateline"
                                publishedAt={new Date(hit.date)}
                                formatOptions={{
                                    year: "numeric",
                                    month: "long",
                                    day: "2-digit",
                                }}
                            />
                        )}
                        <h3 className="search-writing-results__hit-title">
                            {hit.title}
                        </h3>
                        {isArticle && (
                            <span className="search-writing-results__hit-authors">
                                {formatAuthors(hit.authors)}
                            </span>
                        )}
                    </header>
                    <Snippet
                        className="search-writing-results__hit-excerpt"
                        attribute="content"
                        highlightedTagName="strong"
                        hit={hit}
                    />
                </div>
            </a>
        </AsDraft>
    )
}

const SearchTopicPageHit = ({ hit }: { hit: TopicPageHit }) => {
    const href = getCanonicalUrl("", {
        slug: hit.slug,
        content: {
            type: hit.type,
        },
    })

    return (
        <AsDraft name="Topic Page Hit - 🙈 query - 🙈 country">
            <a href={href} className="search-writing-results__hit">
                <div className="search-writing-results__hit-content">
                    <header className="search-writing-results__hit-header">
                        <h3 className="search-writing-results__hit-title">
                            {hit.title}
                        </h3>
                    </header>
                    <div className="search-writing-results__hit-excerpt">
                        {hit.excerpt}
                    </div>
                </div>
            </a>
        </AsDraft>
    )
}

export const SearchWritingResults = () => {
    const { state, searchClient } = useSearchContext()

    const articlesQuery = useQuery({
        queryKey: searchQueryKeys.articles(state),
        queryFn: () => queryArticles(searchClient, state),
    })

    const topicPagesQuery = useQuery({
        queryKey: searchQueryKeys.topicPages(state),
        queryFn: () => queryTopicPages(searchClient, state),
    })

    const isLoading = articlesQuery.isLoading || topicPagesQuery.isLoading

    const articles = articlesQuery.data?.hits || []
    const topicPages = topicPagesQuery.data?.hits || []

    return (
        <AsDraft name="Writing Results" className="col-start-2 span-cols-12">
            {isLoading ? (
                <WritingSearchResultsSkeleton />
            ) : (
                <div className="search-writing-results">
                    <div className="search-writing-results__container">
                        <div className="search-writing-results__section">
                            <div className="search-writing-results__hits-list">
                                {articles.length > 0 ? (
                                    articles.map((hit) => (
                                        <SearchArticleHit
                                            key={hit.objectID}
                                            hit={hit}
                                        />
                                    ))
                                ) : (
                                    <p className="search-writing-results__no-results">
                                        No articles found
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="search-writing-results__section">
                            <div className="search-writing-results__hits-list">
                                {topicPages.length > 0 ? (
                                    topicPages.map((hit) => (
                                        <SearchTopicPageHit
                                            key={hit.objectID}
                                            hit={hit}
                                        />
                                    ))
                                ) : (
                                    <p className="search-writing-results__no-results">
                                        No topic pages found
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AsDraft>
    )
}

const WritingSearchResultsSkeleton = () => {
    return (
        <div className="search-writing-results__skeleton">
            <div className="search-writing-results__section">
                <div className="search-writing-results__section-title skeleton-item"></div>
                <div className="search-writing-results__hits-list">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="search-writing-results__hit skeleton-item"
                        >
                            <div className="search-writing-results__hit-image-container skeleton-item"></div>
                            <div className="search-writing-results__hit-content">
                                <div className="search-writing-results__hit-title skeleton-item"></div>
                                <div className="search-writing-results__hit-excerpt skeleton-item"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="search-writing-results__section">
                <div className="search-writing-results__section-title skeleton-item"></div>
                <div className="search-writing-results__hits-list">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div
                            key={i}
                            className="search-writing-results__hit skeleton-item"
                        >
                            <div className="search-writing-results__hit-image-container skeleton-item"></div>
                            <div className="search-writing-results__hit-content">
                                <div className="search-writing-results__hit-title skeleton-item"></div>
                                <div className="search-writing-results__hit-excerpt skeleton-item"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
