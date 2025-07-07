import {
    FlatArticleHit,
    SearchFlatArticleResponse,
    SearchTopicPageResponse,
    TopicPageHit,
} from "./searchTypes.js"
import { searchQueryKeys, queryArticles, queryTopicPages } from "./queries.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { SearchFlatArticleHit } from "./SearchFlatArticleHit.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"

export const SearchWritingResults = ({
    hasTopicPages = true,
}: {
    hasTopicPages?: boolean
}) => {
    const articlesQuery = useInfiniteSearch<
        SearchFlatArticleResponse,
        FlatArticleHit
    >({
        queryKey: (state) => searchQueryKeys.articles(state),
        queryFn: queryArticles,
    })

    const topicPagesQuery = useInfiniteSearch<
        SearchTopicPageResponse,
        TopicPageHit
    >({
        queryKey: (state) => searchQueryKeys.topicPages(state),
        queryFn: queryTopicPages,
        enabled: hasTopicPages,
    })

    const articles = articlesQuery.hits
    const topicPages = topicPagesQuery.hits

    const totalCount =
        (articlesQuery.totalResults || 0) + (topicPagesQuery.totalResults || 0)

    // Combined "show more" logic
    const hasNextPage =
        (articlesQuery.hasNextPage ?? false) ||
        (topicPagesQuery.hasNextPage ?? false)

    const isFetchingNextPage =
        articlesQuery.isFetchingNextPage || topicPagesQuery.isFetchingNextPage

    const fetchNextPage = () =>
        Promise.all([
            articlesQuery.hasNextPage
                ? articlesQuery.fetchNextPage()
                : undefined,
            topicPagesQuery.hasNextPage
                ? topicPagesQuery.fetchNextPage()
                : undefined,
        ])

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
                                    <SearchFlatArticleHit
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
                <SearchShowMore
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                />
            </div>
        </SearchAsDraft>
    )
}
