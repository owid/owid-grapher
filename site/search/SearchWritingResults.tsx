import { useMediaQuery } from "usehooks-ts"
import * as _ from "lodash-es"

import {
    OwidGdocType,
    FlatArticleHit,
    ProfileHit,
    SearchFlatArticleResponse,
    SearchProfileResponse,
    SearchTopicPageResponse,
    TopicPageHit,
} from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    searchQueryKeys,
    queryArticles,
    queryProfiles,
    queryTopicPages,
} from "./queries.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearchOffset } from "./searchHooks.js"
import { SearchFlatArticleHit } from "./SearchFlatArticleHit.js"
import { SearchProfileHit } from "./SearchProfileHit.js"
import { SearchTopicPageHit } from "./SearchTopicPageHit.js"
import { SearchWritingResultsSkeleton } from "./SearchWritingResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"

type PageHit = TopicPageHit | ProfileHit

function isPageHit(hit: FlatArticleHit | PageHit): hit is PageHit {
    return (
        hit.type === OwidGdocType.TopicPage ||
        hit.type === OwidGdocType.LinearTopicPage ||
        hit.type === OwidGdocType.Profile
    )
}

function renderPageHit(
    hit: PageHit,
    index: number,
    hasLargeTopic: boolean,
    analytics: ReturnType<typeof useSearchContext>["analytics"]
) {
    if (hit.type === OwidGdocType.Profile) {
        return (
            <SearchProfileHit
                key={hit.objectID}
                hit={hit}
                onClick={() => {
                    analytics.logSiteSearchResultClick(hit, {
                        position: index + 1,
                        source: "search",
                    })
                }}
            />
        )
    }
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
}

function SingleColumnResults({
    articlePages,
    topicPages,
    profiles,
    hasLargeTopic,
}: {
    articlePages: SearchFlatArticleResponse[]
    topicPages: SearchTopicPageResponse[]
    profiles: ProfileHit[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()

    const allHits: (FlatArticleHit | PageHit)[] = [
        ...profiles,
        ..._.zip(articlePages, topicPages).flatMap(
            ([articlePage, topicPage]) => [
                ...(articlePage?.hits || []),
                ...(topicPage?.hits || []),
            ]
        ),
    ]
    return (
        <div className="search-writing-results__single-column">
            {allHits.map((hit, index) => {
                if (isPageHit(hit)) {
                    return renderPageHit(hit, index, hasLargeTopic, analytics)
                } else {
                    return (
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
                    )
                }
            })}
        </div>
    )
}

function MultiColumnResults({
    articles,
    topics,
    profiles,
    hasLargeTopic,
}: {
    articles: FlatArticleHit[]
    topics: TopicPageHit[]
    profiles: ProfileHit[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()

    // Profiles appear before topic pages in the tiles
    const allPageHits: PageHit[] = [...profiles, ...topics]

    // Calculate interleaved layout: 4 topics for every 5 articles (ratio
    // maintained proportionally).
    const interleavedCount = Math.round((articles.length * 4) / 5)
    const interleavedPageHits = allPageHits.slice(0, interleavedCount)
    const remainingPageHits = allPageHits.slice(interleavedCount)
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
            {interleavedPageHits.length > 0 && (
                <div className="search-writing-results__topics">
                    {interleavedPageHits.map((hit, index) =>
                        renderPageHit(hit, index, hasLargeTopic, analytics)
                    )}
                </div>
            )}
            {remainingPageHits.length > 0 && (
                <div className="search-writing-results__overflow">
                    {remainingPageHits.map((hit, index) =>
                        renderPageHit(
                            hit,
                            interleavedPageHits.length + index,
                            hasLargeTopic,
                            analytics
                        )
                    )}
                </div>
            )}
        </div>
    )
}

export const SearchWritingResults = ({
    hasTopicPages = true,
    showProfiles = false,
}: {
    hasTopicPages?: boolean
    showProfiles?: boolean
}) => {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const profilesQuery = useInfiniteSearchOffset<
        SearchProfileResponse,
        ProfileHit
    >({
        queryKey: (state) => searchQueryKeys.profiles(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryProfiles(liteSearchClient, state, offset, length)
        },
        firstPageSize: 4,
        laterPageSize: 4,
        enabled: showProfiles,
    })

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
        enabled: hasTopicPages && !articlesQuery.isLoading,
    })

    const hasLargeTopic = topicsQuery.totalResults === 1
    const totalCount =
        articlesQuery.totalResults +
        topicsQuery.totalResults +
        profilesQuery.totalResults
    const hasNextPage =
        articlesQuery.hasNextPage ||
        topicsQuery.hasNextPage ||
        profilesQuery.hasNextPage
    const isFetchingNextPage =
        articlesQuery.isFetchingNextPage ||
        topicsQuery.isFetchingNextPage ||
        profilesQuery.isFetchingNextPage
    const isLoading =
        articlesQuery.isLoading ||
        topicsQuery.isLoading ||
        profilesQuery.isLoading

    const fetchNextPage = () =>
        Promise.all([
            articlesQuery.hasNextPage
                ? articlesQuery.fetchNextPage()
                : undefined,
            topicsQuery.hasNextPage ? topicsQuery.fetchNextPage() : undefined,
            profilesQuery.hasNextPage
                ? profilesQuery.fetchNextPage()
                : undefined,
        ])

    if (!isLoading && totalCount === 0) return null

    return (
        <>
            <section>
                {isLoading ? (
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
                                profiles={profilesQuery.hits}
                                hasLargeTopic={hasLargeTopic}
                            />
                        ) : (
                            <MultiColumnResults
                                articles={articlesQuery.hits}
                                topics={topicsQuery.hits}
                                profiles={profilesQuery.hits}
                                hasLargeTopic={hasLargeTopic}
                            />
                        )}
                    </>
                )}
            </section>
            <SearchHorizontalDivider
                hasButton={!isLoading && hasNextPage}
                isLoading={isFetchingNextPage}
                onClick={fetchNextPage}
            />
        </>
    )
}
