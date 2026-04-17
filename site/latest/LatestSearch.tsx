import { useCallback, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import { LatestType, TagGraphRoot } from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useTagGraphTopics } from "../search/searchHooks.js"
import { deserializeSet } from "../search/searchUtils.js"
import { useInfiniteLatestPages } from "./latestHooks.js"
import { LatestTopicFacets } from "./LatestTopicFacets.js"
import { LATEST_TYPE_OPTIONS, decodeLatestType } from "./latestFilters.js"
import { LatestHit } from "./LatestHit.js"
import { LatestSearchSkeleton } from "./LatestSearchSkeleton.js"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { PoweredBy } from "react-instantsearch"

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

    const latestType: LatestType | null = decodeLatestType(
        searchParams.get("type")
    )

    const onTopicsChange = useCallback(
        (newTopics: string[]) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (newTopics.length > 0) {
                    next.set("topics", newTopics.join("~"))
                } else {
                    next.delete("topics")
                }
                return next
            })
        },
        [setSearchParams]
    )

    const onLatestTypeChange = useCallback(
        (newType: LatestType | null) => {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev)
                if (newType) {
                    next.set("type", newType)
                } else {
                    next.delete("type")
                }
                return next
            })
        },
        [setSearchParams]
    )

    const clearAllFilters = useCallback(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete("topics")
            next.delete("type")
            return next
        })
    }, [setSearchParams])

    const {
        hits,
        tagFacetCounts,
        latestTypeFacetCounts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteLatestPages({
        topics,
        latestType,
        liteSearchClient,
    })

    // Disable type options that would yield 0 results given the current
    // topic selection. Never disable the currently active type.
    const disabledTypes = useMemo(() => {
        const disabled = new Set<LatestType>()
        for (const option of LATEST_TYPE_OPTIONS) {
            if (option.value === latestType) continue
            if ((latestTypeFacetCounts[option.value] ?? 0) === 0)
                disabled.add(option.value)
        }
        return disabled
    }, [latestType, latestTypeFacetCounts])

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

    // After the first data load, scroll to the URL hash anchor (e.g.
    // /latest#some-slug) so that links from the homepage land on the
    // right card. In the old SSR page the browser handled this natively;
    // in the SPA the elements don't exist until data loads.
    const didScrollToHash = useRef(false)
    useEffect(() => {
        if (didScrollToHash.current || isLoading || hits.length === 0) return
        const hash = window.location.hash.slice(1)
        if (!hash) return
        const el = document.getElementById(hash)
        if (el) {
            el.scrollIntoView()
            didScrollToHash.current = true
        }
        // Depend on `hits.length` rather than `hits` — `hits` is a fresh
        // array every render (from `flatMap`) and would re-fire the effect
        // needlessly.
    }, [isLoading, hits.length])

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
            <div className="latest-search__facets-container span-cols-12 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1">
                <LatestTopicFacets
                    topics={allAreas}
                    selectedTopics={topics}
                    onTopicsChange={onTopicsChange}
                    selectedType={latestType}
                    onLatestTypeChange={onLatestTypeChange}
                    disabledTypes={disabledTypes}
                    disabledTopics={disabledTopics}
                />
            </div>
            <hr className="latest-search__filters-divider span-cols-12 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1" />
            {isLoading ? (
                <LatestSearchSkeleton />
            ) : hits.length === 0 ? (
                <SearchNoResults
                    subtitle={
                        <p className="body-3-medium">
                            Try removing some filters or{" "}
                            <button
                                className="latest-search__reset-button"
                                onClick={clearAllFilters}
                            >
                                reset filters
                            </button>
                            .
                        </p>
                    }
                />
            ) : (
                <>
                    {hits.slice(0, 2).map((hit) => (
                        <LatestHit
                            key={hit.objectID}
                            hit={hit}
                            selectedTopic={topics[0]}
                        />
                    ))}
                    {/* Always render the signup block — with 0 or 1 hits it
                        falls below whatever cards exist, which is the
                        intended layout. */}
                    <NewsletterSignupBlock
                        className="latest-page__newsletter-signup col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4 span-md-cols-14 col-md-start-1"
                        context={NewsletterSubscriptionContext.Latest}
                    />
                    {hits.slice(2).map((hit) => (
                        <LatestHit
                            key={hit.objectID}
                            hit={hit}
                            selectedTopic={topics[0]}
                        />
                    ))}
                    {hasNextPage && (
                        <SearchHorizontalDivider
                            className="span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"
                            hasButton
                            isLoading={isFetchingNextPage}
                            onClick={() => fetchNextPage()}
                        />
                    )}
                </>
            )}
            <PoweredBy
                className="col-start-2 span-cols-12"
                style={{ width: "200px", marginTop: "32px" }}
            />
        </>
    )
}
