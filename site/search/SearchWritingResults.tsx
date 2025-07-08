import {
    FlatArticleHit,
    SearchFlatArticleResponse,
    SearchTopicPageResponse,
    TopicPageHit,
} from "./searchTypes.js"
import { searchQueryKeys, queryArticles, queryTopicPages } from "./queries.js"
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
    const totalCount = articlesQuery.totalResults + topicPagesQuery.totalResults
    const hasNextPage = articlesQuery.hasNextPage || topicPagesQuery.hasNextPage
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

    // Calculate interleaved layout: 4 topics for every 5 articles (ratio
    // maintained proportionally).
    const interleavedTopicsCount = Math.round((articles.length * 4) / 5)
    const interleavedTopics = topicPages.slice(0, interleavedTopicsCount)
    const remainingTopics = topicPages.slice(interleavedTopicsCount)

    return (
        <section className="search-writing-results col-start-2 span-cols-12">
            <SearchResultHeader count={totalCount}>
                Research & Writing
            </SearchResultHeader>
            <div className="search-writing-results__grid">
                {articles.length > 0 && (
                    <div className="search-writing-results__articles">
                        {articles.map((hit) => (
                            <SearchFlatArticleHit
                                key={hit.objectID}
                                hit={hit}
                            />
                        ))}
                    </div>
                )}
                {interleavedTopics.length > 0 && (
                    <div className="search-writing-results__topics">
                        {interleavedTopics.map((hit) => (
                            <SearchTopicPageHit key={hit.objectID} hit={hit} />
                        ))}
                    </div>
                )}
                {remainingTopics.length > 0 && (
                    <div className="search-writing-results__overflow">
                        {remainingTopics.map((hit) => (
                            <SearchTopicPageHit key={hit.objectID} hit={hit} />
                        ))}
                    </div>
                )}
            </div>
            {hasNextPage && (
                <SearchShowMore
                    isLoading={isFetchingNextPage}
                    onClick={fetchNextPage}
                />
            )}
        </section>
    )
}
