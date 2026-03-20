import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import { TagGraphRoot } from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useTagGraphTopics } from "../search/searchHooks.js"
import { deserializeSet } from "../search/searchUtils.js"
import { useInfiniteLatestPages } from "./latestHooks.js"
import { LatestTopicFacets } from "./LatestTopicFacets.js"
import {
    ALL_FILTER_OPTIONS,
    LatestFilter,
    filtersAreEqual,
    decodeFilter,
    encodeFilter,
} from "./latestFilters.js"
import { LatestResultCard } from "./LatestResultCard.js"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"

export const LatestSearch = ({
    topicTagGraph,
    liteSearchClient,
}: {
    topicTagGraph: TagGraphRoot
    liteSearchClient: LiteClient
}) => {
    const [searchParams, setSearchParams] = useSearchParams()

    const { allAreas } = useTagGraphTopics(topicTagGraph)

    const topicsParam = searchParams.get("topics")
    const topics = useMemo(
        () =>
            [...deserializeSet(topicsParam)].filter((t) =>
                allAreas.includes(t)
            ),
        [topicsParam, allAreas]
    )

    const filter: LatestFilter | null = decodeFilter(searchParams.get("type"))

    const onTopicsChange = useCallback(
        (newTopics: string[]) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    if (newTopics.length > 0) {
                        next.set("topics", newTopics.join("~"))
                    } else {
                        next.delete("topics")
                    }
                    return next
                },
                { replace: true }
            )
        },
        [setSearchParams]
    )

    const onFilterChange = useCallback(
        (newFilter: LatestFilter | null) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    if (newFilter) {
                        next.set("type", encodeFilter(newFilter))
                    } else {
                        next.delete("type")
                    }
                    return next
                },
                { replace: true }
            )
        },
        [setSearchParams]
    )

    const clearAllFilters = useCallback(() => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev)
                next.delete("topics")
                next.delete("type")
                return next
            },
            { replace: true }
        )
    }, [setSearchParams])

    // Derive contentType and kicker from the active filter
    const contentType = filter?.kind === "type" ? filter.value : null
    const kicker = filter?.kind === "kicker" ? filter.value : null

    const {
        hits,
        totalResults,
        tagFacetCounts,
        typeFacetCounts,
        kickerFacetCounts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteLatestPages({
        topics,
        contentType,
        kicker,
        liteSearchClient,
    })

    // Disable pills that would yield 0 results given the current topic
    // selection. Never disable the currently active filter.
    const disabledFilters = useMemo(() => {
        const disabled = new Set<string>()
        for (const option of ALL_FILTER_OPTIONS) {
            if (filtersAreEqual(filter, option.filter)) continue
            const count =
                option.filter.kind === "type"
                    ? (typeFacetCounts[option.filter.value] ?? 0)
                    : (kickerFacetCounts[option.filter.value] ?? 0)
            if (count === 0) disabled.add(encodeFilter(option.filter))
        }
        return disabled
    }, [filter, typeFacetCounts, kickerFacetCounts])

    // Disable topics that would yield 0 results given the current filters.
    // Never disable a topic that is already selected (so the user can deselect
    // it). When topics are selected the facet counts are narrowed by Algolia's
    // conjunctive filtering, so the counts reflect co-occurrence with the
    // current selection — topics with 0 count genuinely add no results.
    const disabledTopics = useMemo(() => {
        const disabled = new Set<string>()
        for (const area of allAreas) {
            if (topics.includes(area)) continue
            if ((tagFacetCounts[area] ?? 0) === 0) disabled.add(area)
        }
        return disabled
    }, [allAreas, tagFacetCounts, topics])

    const allTopicsDisabled = useMemo(
        () =>
            topics.length === 0 &&
            allAreas.every((area) => (tagFacetCounts[area] ?? 0) === 0),
        [allAreas, tagFacetCounts, topics]
    )

    return (
        <>
            <header className="latest-page-header span-cols-14 grid grid-cols-12-full-width">
                <h1 className="display-2-semibold span-cols-8 col-start-2 col-md-start-2 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    Latest
                </h1>
                <p className="latest-page__header-subtitle body-1-regular span-cols-8 col-start-2 col-md-start-2 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    Our latest articles, data updates, and announcements
                </p>
            </header>
            <div className="latest-search__facets-container span-cols-8 col-start-2 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1">
                <LatestTopicFacets
                    topics={allAreas}
                    selectedTopics={topics}
                    onTopicsChange={onTopicsChange}
                    selectedFilter={filter}
                    onFilterChange={onFilterChange}
                    disabledFilters={disabledFilters}
                    disabledTopics={disabledTopics}
                    allTopicsDisabled={allTopicsDisabled}
                    tagFacetCounts={tagFacetCounts}
                />
            </div>
            {isLoading ? (
                <p className="latest-search__loading span-cols-8 col-start-2 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1">
                    Loading…
                </p>
            ) : hits.length === 0 ? (
                <div className="latest-search__no-results span-cols-8 col-start-2 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1">
                    <p>No results found.</p>
                    <button
                        className="latest-search__clear-filters-button"
                        onClick={clearAllFilters}
                    >
                        Clear all filters
                    </button>
                </div>
            ) : (
                <>
                    {hits.slice(0, 2).map((hit) => (
                        <LatestResultCard key={hit.objectID} hit={hit} />
                    ))}
                    <NewsletterSignupBlock
                        className="latest-page__newsletter-signup col-start-10 span-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-14"
                        context={NewsletterSubscriptionContext.Latest}
                    />
                    {hits.slice(2).map((hit) => (
                        <LatestResultCard key={hit.objectID} hit={hit} />
                    ))}
                    {hasNextPage && (
                        <div className="latest-search__load-more span-cols-8 col-start-2 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1">
                            <button
                                className="latest-search__load-more-button"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                            >
                                {isFetchingNextPage
                                    ? "Loading…"
                                    : `Load more (${totalResults - hits.length} remaining)`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </>
    )
}
