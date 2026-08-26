import cx from "clsx"
import { match, P } from "ts-pattern"
import { useMediaQuery } from "usehooks-ts"
import * as _ from "lodash-es"

import {
    OwidGdocType,
    FlatArticleHit,
    ProfileHit,
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
import { SearchClosestMatchesNotice } from "./SearchClosestMatchesNotice.js"

type WritingHit = FlatArticleHit | TopicPageHit | ProfileHit

function SearchWritingHit({
    hit,
    hasLargeTopic,
    onClick,
}: {
    hit: WritingHit
    hasLargeTopic: boolean
    onClick: () => void
}) {
    return match(hit)
        .with({ type: OwidGdocType.Profile }, (hit) => (
            <SearchProfileHit hit={hit} onClick={onClick} />
        ))
        .with(
            {
                type: P.union(
                    OwidGdocType.TopicPage,
                    OwidGdocType.LinearTopicPage
                ),
            },
            (hit) => (
                <SearchTopicPageHit
                    hit={hit}
                    variant={hasLargeTopic ? "large" : undefined}
                    onClick={onClick}
                />
            )
        )
        .otherwise((hit) => (
            <SearchFlatArticleHit hit={hit} onClick={onClick} />
        ))
}

function SingleColumnResults({
    hits,
    hasLargeTopic,
}: {
    hits: WritingHit[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()

    function handleClick(hit: WritingHit, position: number) {
        analytics.logSearchResultClick(hit, {
            position,
            source: "search",
        })
    }

    return (
        <div className="search-writing-results__single-column">
            {hits.map((hit, index) => (
                <SearchWritingHit
                    key={hit.objectID}
                    hit={hit}
                    hasLargeTopic={hasLargeTopic}
                    onClick={() => handleClick(hit, index + 1)}
                />
            ))}
        </div>
    )
}

function MultiColumnResults({
    articles,
    topics,
    profiles,
    orderedHits,
    hasLargeTopic,
}: {
    articles: FlatArticleHit[]
    topics: TopicPageHit[]
    profiles: ProfileHit[]
    orderedHits: WritingHit[]
    hasLargeTopic: boolean
}) {
    const { analytics } = useSearchContext()
    const hasArticles = articles.length > 0
    const hitPositions = new Map(
        orderedHits.map((hit, index) => [hit.objectID, index + 1])
    )

    function handleClick(hit: WritingHit) {
        analytics.logSearchResultClick(hit, {
            position: hitPositions.get(hit.objectID)!,
            source: "search",
        })
    }

    return (
        <div className="search-writing-results__grid">
            {hasArticles && (
                <div className="search-writing-results__articles">
                    {articles.map((hit) => (
                        <SearchFlatArticleHit
                            key={hit.objectID}
                            hit={hit}
                            onClick={() => handleClick(hit)}
                        />
                    ))}
                </div>
            )}
            {(topics.length > 0 || profiles.length > 0) && (
                <div
                    className={cx("search-writing-results__topics", {
                        "search-writing-results__topics--full-width":
                            !hasArticles,
                    })}
                >
                    {profiles.map((hit) => (
                        <SearchProfileHit
                            key={hit.objectID}
                            hit={hit}
                            onClick={() => handleClick(hit)}
                        />
                    ))}
                    {topics.map((hit) => (
                        <SearchTopicPageHit
                            key={hit.objectID}
                            hit={hit}
                            variant={hasLargeTopic ? "large" : undefined}
                            onClick={() => handleClick(hit)}
                        />
                    ))}
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

    const profilesQuery = useInfiniteSearchOffset({
        queryKey: (state) => searchQueryKeys.profiles(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryProfiles(liteSearchClient, state, offset, length)
        },
        firstPageSize: 2,
        laterPageSize: 4,
        enabled: showProfiles,
    })

    const profileSlots = Math.min(profilesQuery.totalResults, 2)
    const profilesRequestDone = !showProfiles || !profilesQuery.isLoading

    const articlesQuery = useInfiniteSearchOffset({
        queryKey: (state) => searchQueryKeys.articles(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryArticles(liteSearchClient, state, offset, length)
        },
        firstPageSize: 4 - profileSlots,
        laterPageSize: 6,
        enabled: profilesRequestDone,
    })

    const noArticles = articlesQuery.totalResults === 0
    const articleSlots = Math.min(articlesQuery.totalResults, 4 - profileSlots)
    const topicFirstPageSize = 6 - profileSlots - articleSlots

    const dependenciesLoaded = !articlesQuery.isLoading && profilesRequestDone

    const topicsQuery = useInfiniteSearchOffset({
        queryKey: (state) => searchQueryKeys.topicPages(state),
        queryFn: (liteSearchClient, state, offset, length) => {
            return queryTopicPages(liteSearchClient, state, offset, length)
        },
        firstPageSize: topicFirstPageSize,
        laterPageSize: noArticles ? 6 : 4,
        enabled: hasTopicPages && dependenciesLoaded,
    })

    const hasLargeTopic = topicsQuery.totalResults === 1
    // Article-level closest matches are only a genuine rescue if the section
    // as a whole found nothing exact. Topic pages and profiles never go
    // through the closest-matches fallback (see queryTopicPages/queryProfiles
    // in queries.ts), so any of their hits are exact — mixing in "did you
    // mean" articles and the closest-matches notice alongside those would
    // misrepresent an already-successful search as an empty one.
    const sectionHasExactHitsElsewhere =
        topicsQuery.totalResults > 0 || profilesQuery.totalResults > 0
    const suppressArticlesRescue =
        articlesQuery.isClosestMatches && sectionHasExactHitsElsewhere
    const showArticlesClosestMatches =
        articlesQuery.isClosestMatches && !sectionHasExactHitsElsewhere
    const visibleArticlesTotal = suppressArticlesRescue
        ? 0
        : articlesQuery.totalResults
    const totalCount =
        visibleArticlesTotal +
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

    const articlePages = suppressArticlesRescue
        ? []
        : articlesQuery.data?.pages || []
    const topicPages = topicsQuery.data?.pages || []
    const visibleArticleHits = suppressArticlesRescue ? [] : articlesQuery.hits
    const orderedHits: WritingHit[] = [
        ...profilesQuery.hits,
        ..._.zip(articlePages, topicPages).flatMap(
            ([articlePage, topicPage]) => [
                ...(articlePage?.hits || []),
                ...(topicPage?.hits || []),
            ]
        ),
    ]

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
                        {showArticlesClosestMatches && (
                            <SearchClosestMatchesNotice />
                        )}
                        {isSmallScreen ? (
                            <SingleColumnResults
                                hits={orderedHits}
                                hasLargeTopic={hasLargeTopic}
                            />
                        ) : (
                            <MultiColumnResults
                                articles={visibleArticleHits}
                                topics={topicsQuery.hits}
                                profiles={profilesQuery.hits}
                                orderedHits={orderedHits}
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
