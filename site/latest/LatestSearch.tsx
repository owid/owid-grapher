import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import {
    LATEST_TYPE_VALUES,
    LatestState,
    LatestType,
    TagGraphRoot,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useTagGraphTopics } from "../search/searchHooks.js"
import {
    useAreFreshProbesSettled,
    useInfiniteLatestPages,
    useLatestAnalytics,
} from "./latestHooks.js"
import { LatestTopicFacets } from "./LatestTopicFacets.js"
import { LatestPageHeader } from "./LatestPageHeader.js"
import {
    DEFAULT_LATEST_FEED_VIEW,
    LATEST_FACETS_CONTAINER_CLASSES,
    LATEST_FILTERS_DIVIDER_CLASSES,
    LATEST_NEWSLETTER_SIGNUP_CLASSES,
    LatestFeedView,
    hasViewToggle,
} from "./latestUtils.js"
import { LatestViewToggle } from "./LatestViewToggle.js"
import {
    searchParamsToState,
    stateToSearchParams,
    urlNeedsSanitization,
} from "./latestState.js"
import { LatestHit } from "./LatestHit.js"
import { LatestSearchSkeleton } from "./LatestSearchSkeleton.js"
import { LatestContext } from "./LatestContext.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { PoweredBy } from "react-instantsearch"

const analytics = new SiteAnalytics()

export const LatestSearch = ({
    topicTagGraph,
    liteSearchClient,
}: {
    topicTagGraph: TagGraphRoot
    liteSearchClient: LiteClient
}) => {
    const [searchParams, setSearchParams] = useSearchParams()

    const { allAreas } = useTagGraphTopics(topicTagGraph)

    const [autoExpandedSlug, setAutoExpandedSlug] = useState<null | string>(
        null
    )

    const state = useMemo(
        () => searchParamsToState(searchParams, allAreas),
        [searchParams, allAreas]
    )
    const { topics, latestType } = state

    // Expanded/Compact for type filters that offer the toggle. Local, not in
    // the URL, and shared by all such filters. Deliberately never reset:
    // only the reader's own click changes it, so it can't change under the
    // cards that stay on screen while the next results load
    // (keepPreviousData) the way a reset-on-filter-change would.
    const [view, setView] = useState<LatestFeedView>(DEFAULT_LATEST_FEED_VIEW)
    const showViewToggle = hasViewToggle(latestType)

    useLatestAnalytics(state, analytics)

    // Sanitize URL: drop unknown params (e.g. legacy `?topic=Health` from old
    // /data-insights links), invalid topic names, and invalid `type` values.
    // Mirrors /search behavior in site/search/searchState.ts.
    useEffect(() => {
        if (urlNeedsSanitization(searchParams, state)) {
            setSearchParams(stateToSearchParams(state), { replace: true })
        }
    }, [searchParams, state, setSearchParams])

    const updateParams = (updater: (current: LatestState) => LatestState) => {
        setSearchParams(stateToSearchParams(updater(state)))
    }

    const onTopicsChange = (newTopics: string[]) => {
        updateParams((s) => ({ ...s, topics: newTopics }))
    }

    const onLatestTypeChange = (newType: LatestType | null) => {
        updateParams((s) => ({ ...s, latestType: newType }))
    }

    const clearAllFilters = () => {
        updateParams(() => ({ topics: [], latestType: null }))
    }

    const {
        hits,
        tagFacetCounts,
        latestTypeFacetCounts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: arePagesLoading,
        data,
    } = useInfiniteLatestPages({
        topics,
        latestType,
        liteSearchClient,
    })

    // The feed also counts as loading until the first page's bake probes have
    // settled, so it renders in one commit with its composition final — see
    // "Bake probes" in latestHooks.ts.
    const areProbesSettled = useAreFreshProbesSettled(
        data?.pages[0]?.response.hits ?? []
    )
    const isLoading = arePagesLoading || !areProbesSettled

    // Disable type options that would yield 0 results given the current
    // topic selection. Never disable the currently active type.
    const disabledTypes = useMemo(() => {
        const disabled = new Set<LatestType>()
        for (const value of LATEST_TYPE_VALUES) {
            if (value === latestType) continue
            if ((latestTypeFacetCounts[value] ?? 0) === 0) disabled.add(value)
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
            setAutoExpandedSlug(hash)
            didScrollToHash.current = true
        }
        // Depend on `hits.length` rather than `hits` — `hits` is a fresh
        // array every render (from `flatMap`) and would re-fire the effect
        // needlessly.
    }, [isLoading, hits.length])

    // Cards are judged by the type filter recorded on the *displayed*
    // results, not the URL's: during a filter change the previous results
    // stay on screen while the next page loads (keepPreviousData), and the
    // incoming type would flash them expanded/collapsed. Only the type
    // filter affects how a card renders; topics only change which hits
    // come back.
    const displayedLatestType = data?.pages[0]?.latestType ?? null
    const activeView = hasViewToggle(displayedLatestType) ? view : undefined

    // A card renders expanded when we know the reader is after this content
    // in particular: they followed a link straight to it, the View toggle is
    // on Expanded, or — for data updates, which don't have the toggle yet —
    // they filtered for that type. It's a hard override, not a default: the
    // card renders without a Read more affordance and can't be collapsed.
    const isExpanded = (slug: string) =>
        slug === autoExpandedSlug ||
        activeView === "expanded" ||
        displayedLatestType === "data-update"

    return (
        <LatestContext.Provider value={{ analytics }}>
            <LatestPageHeader />
            <div className={LATEST_FACETS_CONTAINER_CLASSES}>
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
            <hr className={LATEST_FILTERS_DIVIDER_CLASSES} />
            {/* Tied to the type filter alone, so it can't mount or unmount
                while a feed loads: gating on the hits as well would flash it
                in and out on a feed that turns out to be empty. */}
            {showViewToggle && (
                <LatestViewToggle view={view} onViewChange={setView} />
            )}
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
                    {hits.slice(0, 2).map((hit, i) => (
                        <LatestHit
                            key={hit.objectID}
                            hit={hit}
                            selectedTopic={topics[0]}
                            position={i + 1}
                            isExpanded={isExpanded(hit.slug)}
                            view={activeView}
                        />
                    ))}
                    {/* Always render the signup block — with 0 or 1 hits it
                        falls below whatever cards exist, which is the
                        intended layout. */}
                    <NewsletterSignupBlock
                        className={LATEST_NEWSLETTER_SIGNUP_CLASSES}
                        context={NewsletterSubscriptionContext.Latest}
                    />
                    {hits.slice(2).map((hit, i) => (
                        <LatestHit
                            key={hit.objectID}
                            hit={hit}
                            selectedTopic={topics[0]}
                            position={i + 3}
                            isExpanded={isExpanded(hit.slug)}
                            view={activeView}
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
        </LatestContext.Provider>
    )
}
