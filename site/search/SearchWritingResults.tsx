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
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchFlatArticleHit } from "./SearchFlatArticleHit.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"
import { SearchWritingResultsSkeleton } from "./SearchWritingResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"

function SingleColumnResults({
    articlePages,
    topicPages,
    hasLargeTopic,
}: {
    articlePages: SearchFlatArticleResponse[]
    topicPages: SearchTopicPageResponse[]
    hasLargeTopic: boolean
}) {
    const allHits = _.zip(articlePages, topicPages).flatMap(
        ([articlePage, topicPage]) => [
            ...(articlePage?.hits || []),
            ...(topicPage?.hits || []),
        ]
    )
    return (
        <div className="search-writing-results__single-column">
            {allHits.map((hit) => {
                if (
                    hit.type === OwidGdocType.TopicPage ||
                    hit.type === OwidGdocType.LinearTopicPage
                ) {
                    return (
                        <SearchTopicPageHit
                            key={hit.objectID}
                            hit={hit}
                            variant={hasLargeTopic ? "large" : undefined}
                        />
                    )
                } else {
                    return (
                        <SearchFlatArticleHit
                            key={hit.objectID}
                            hit={hit as FlatArticleHit}
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
    // Calculate interleaved layout: 4 topics for every 5 articles (ratio
    // maintained proportionally).
    const interleavedTopicsCount = Math.round((articles.length * 4) / 5)
    const interleavedTopics = topics.slice(0, interleavedTopicsCount)
    const remainingTopics = topics.slice(interleavedTopicsCount)
    return (
        <div className="search-writing-results__grid">
            {articles.length > 0 && (
                <div className="search-writing-results__articles">
                    {articles.map((hit) => (
                        <SearchFlatArticleHit key={hit.objectID} hit={hit} />
                    ))}
                </div>
            )}
            {interleavedTopics.length > 0 && (
                <div className="search-writing-results__topics">
                    {hasLargeTopic ? (
                        <SearchTopicPageHit
                            hit={interleavedTopics[0]}
                            variant="large"
                        />
                    ) : (
                        interleavedTopics.map((hit) => (
                            <SearchTopicPageHit key={hit.objectID} hit={hit} />
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
                        />
                    ) : (
                        remainingTopics.map((hit) => (
                            <SearchTopicPageHit key={hit.objectID} hit={hit} />
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
    const articlesQuery = useInfiniteSearch<
        SearchFlatArticleResponse,
        FlatArticleHit
    >({
        queryKey: (state) => searchQueryKeys.articles(state),
        queryFn: (searchClient, state, page) => {
            const hitsPerPage = page === 0 ? 3 : 6
            return queryArticles(searchClient, state, page, hitsPerPage)
        },
    })

    const topicsQuery = useInfiniteSearch<
        SearchTopicPageResponse,
        TopicPageHit
    >({
        queryKey: (state) => searchQueryKeys.topicPages(state),
        queryFn: (searchClient, state, page) => {
            let hitsPerPage = page === 0 ? 2 : 4
            if (articlesQuery.totalResults === 0) {
                hitsPerPage = 6
            }
            return queryTopicPages(searchClient, state, page, hitsPerPage)
        },
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
