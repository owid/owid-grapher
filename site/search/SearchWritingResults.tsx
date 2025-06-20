import { useQuery } from "@tanstack/react-query"
import { getCanonicalUrl } from "@ourworldindata/components"
import { ArticleHit, TopicPageHit } from "./searchTypes.js"
import { searchQueryKeys, queryArticles, queryTopicPages } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { Snippet } from "react-instantsearch"
import { OwidGdocType } from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { SearchResultHeader } from "./SearchResultHeader.js"

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

    const articles = articlesQuery.data?.hits || []
    const topicPages = topicPagesQuery.data?.hits || []

    const totalCount =
        (articlesQuery.data?.nbHits || 0) + (topicPagesQuery.data?.nbHits || 0)

    if (totalCount === 0) return null

    return (
        <SearchAsDraft
            name="Writing Results"
            className="col-start-2 span-cols-12"
        >
            <div className="search-writing-results">
                <SearchResultHeader
                    title="Research & Writing"
                    count={totalCount}
                />
                <div className="search-writing-results__container">
                    {articles.length > 0 && (
                        <div className="search-writing-results__section">
                            <div className="search-writing-results__hits-list">
                                {articles.map((hit) => (
                                    <SearchArticleHit
                                        key={hit.objectID}
                                        hit={hit}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {topicPages.length > 0 && (
                        <div className="search-writing-results__section">
                            <div className="search-writing-results__hits-list">
                                {topicPages.map((hit) => (
                                    <SearchTopicPageHit
                                        key={hit.objectID}
                                        hit={hit}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SearchAsDraft>
    )
}

const SearchArticleHit = ({ hit }: { hit: ArticleHit }) => {
    const isArticle = hit.type === OwidGdocType.Article

    const href = getCanonicalUrl("", {
        slug: hit.slug,
        content: {
            type: hit.type,
        },
    })

    return (
        <SearchAsDraft name="Article Hit">
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
        </SearchAsDraft>
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
        <SearchAsDraft name={"Topic Page Hit"}>
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
        </SearchAsDraft>
    )
}
