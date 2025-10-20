import { useMediaQuery } from "usehooks-ts"
import * as _ from "lodash-es"

import { OwidGdocType } from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    FlatArticleHit,
    SearchFlatArticleResponse,
    SearchTopicPageResponse,
    TopicPageHit,
    SearchTopicType,
} from "./searchTypes.js"
import { searchQueryKeys, queryArticles, queryTopicPages } from "./queries.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearchOffset } from "./searchHooks.js"
import { SearchFlatArticleHit } from "./SearchFlatArticleHit.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"
import { SearchWritingResultsSkeleton } from "./SearchWritingResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"

function SingleColumnResults({
    articlePages,
    topicPages,
    hasLargeTopic,
}: {
    articlePages: SearchFlatArticleResponse[]
    topicPages: SearchTopicPageResponse[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()

    const allHits = _.zip(articlePages, topicPages).flatMap(
        ([articlePage, topicPage]) => [
            ...(articlePage?.hits || []),
            ...(topicPage?.hits || []),
        ]
    )
    return (
        <div className="search-writing-results__single-column">
            {allHits.map((hit, index) => {
                if (
                    hit.type === OwidGdocType.TopicPage ||
                    hit.type === OwidGdocType.LinearTopicPage
                ) {
                    return (
                        <SearchTopicPageHit
                            key={hit.objectID}
                            hit={hit}
                            variant={hasLargeTopic ? "large" : undefined}
                            onClick={() => {
                                analytics.logSiteSearchResultClick(hit, {
                                    position: index + 1,
                                    source: "search",
                                })
                            }}
                        />
                    )
                } else {
                    return (
                        <SearchFlatArticleHit
                            key={hit.objectID}
                            hit={hit as FlatArticleHit}
                            onClick={() => {
                                analytics.logSiteSearchResultClick(hit, {
                                    position: index + 1,
                                    source: "search",
                                })
                            }}
                        />
                    )
                }
            })}
        </div>
    )
}

function MultiColumnResults({
    articles,
    topics,
    hasLargeTopic,
}: {
    articles: FlatArticleHit[]
    topics: TopicPageHit[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()
    // Calculate interleaved layout: 4 topics for every 5 articles (ratio
    // maintained proportionally).
    const interleavedTopicsCount = Math.round((articles.length * 4) / 5)
    const interleavedTopics = topics.slice(0, interleavedTopicsCount)
    const remainingTopics = topics.slice(interleavedTopicsCount)
    return (
        <div className="search-writing-results__grid">
            {articles.length > 0 && (
                <div className="search-writing-results__articles">
                    {articles.map((hit, index) => (
                        <SearchFlatArticleHit
                            key={hit.objectID}
                            hit={hit}
                            onClick={() => {
                                analytics.logSiteSearchResultClick(hit, {
                                    position: index + 1,
                                    source: "search",
                                })
                            }}
                        />
                    ))}
                </div>
            )}
            {interleavedTopics.length > 0 && (
                <div className="search-writing-results__topics">
                    {hasLargeTopic ? (
                        <SearchTopicPageHit
                            hit={interleavedTopics[0]}
                            variant="large"
                            onClick={() => {
                                analytics.logSiteSearchResultClick(
                                    interleavedTopics[0],
                                    {
                                        position: 1,
                                        source: "search",
                                    }
                                )
                            }}
                        />
                    ) : (
                        interleavedTopics.map((hit, index) => (
                            <SearchTopicPageHit
                                key={hit.objectID}
                                hit={hit}
                                onClick={() => {
                                    analytics.logSiteSearchResultClick(hit, {
                                        position: index + 1,
                                        source: "search",
                                    })
                                }}
                            />
                        ))
                    )}
                </div>
            )}
            {remainingTopics.length > 0 && (
                <div className="search-writing-results__overflow">
                    {hasLargeTopic ? (
                        <SearchTopicPageHit
                            hit={remainingTopics[0]}
                            variant="large"
                            onClick={() => {
                                analytics.logSiteSearchResultClick(
                                    remainingTopics[0],
                                    {
                                        position: interleavedTopics.length + 1,
                                        source: "search",
                                    }
                                )
                            }}
                        />
                    ) : (
                        remainingTopics.map((hit, index) => (
                            <SearchTopicPageHit
                                key={hit.objectID}
                                hit={hit}
                                onClick={() => {
                                    analytics.logSiteSearchResultClick(hit, {
                                        position:
                                            interleavedTopics.length +
                                            index +
                                            1,
                                        source: "search",
                                    })
                                }}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export const SearchWritingResults = ({
    hasTopicPages = true,
    topicType,
}: {
    hasTopicPages?: boolean
    topicType?: SearchTopicType
}) => {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const hasLargeTopic = topicType === SearchTopicType.Topic
    const articlesQuery = useInfiniteSearchOffset<
        SearchFlatArticleResponse,
        FlatArticleHit
    >({
        queryKey: (state) => searchQueryKeys.articles(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryArticles(liteSearchClient, state, offset, length)
        },
        firstPageSize: 2,
        laterPageSize: 6,
    })

    const noArticles = articlesQuery.totalResults === 0

    const topicsQuery = useInfiniteSearchOffset<
        SearchTopicPageResponse,
        TopicPageHit
    >({
        queryKey: (state) => searchQueryKeys.topicPages(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryTopicPages(liteSearchClient, state, offset, length)
        },
        firstPageSize: noArticles ? 6 : 2,
        laterPageSize: noArticles ? 6 : 4,
        enabled: hasTopicPages && !articlesQuery.isInitialLoading,
    })

    const totalCount = articlesQuery.totalResults + topicsQuery.totalResults
    const hasNextPage = articlesQuery.hasNextPage || topicsQuery.hasNextPage
    const isFetchingNextPage =
        articlesQuery.isFetchingNextPage || topicsQuery.isFetchingNextPage
    const isInitialLoading =
        articlesQuery.isInitialLoading || topicsQuery.isInitialLoading

    const fetchNextPage = () =>
        Promise.all([
            articlesQuery.hasNextPage
                ? articlesQuery.fetchNextPage()
                : undefined,
            topicsQuery.hasNextPage ? topicsQuery.fetchNextPage() : undefined,
        ])

    if (!isInitialLoading && totalCount === 0) return null

    return (
        <>
            <section>
                {isInitialLoading ? (
                    <SearchWritingResultsSkeleton />
                ) : (
                    <>
                        <SearchResultHeader count={totalCount}>
                            Research & Writing
                        </SearchResultHeader>
                        {isSmallScreen ? (
                            <SingleColumnResults
                                articlePages={articlesQuery.data?.pages || []}
                                topicPages={topicsQuery.data?.pages || []}
                                hasLargeTopic={hasLargeTopic}
                            />
                        ) : (
                            <MultiColumnResults
                                articles={articlesQuery.hits}
                                topics={topicsQuery.hits}
                                hasLargeTopic={hasLargeTopic}
                            />
                        )}
                    </>
                )}
            </section>
            <SearchHorizontalDivider
                hasButton={!isInitialLoading && hasNextPage}
                isLoading={isFetchingNextPage}
                onClick={fetchNextPage}
            />
        </>
    )
}
