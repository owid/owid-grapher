import { useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { useSearchParams } from "react-router-dom-v5-compat"
import {
    LATEST_TYPE_VALUES,
    LatestState,
    LatestType,
    PageChronologicalRecord,
    TagGraphRoot,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useTagGraphTopics } from "../search/searchHooks.js"
import {
    useAreFreshProbesSettled,
    useInfiniteLatestPages,
    useIsStickyElementHidden,
    useLatestAnalytics,
    useLatestStickyFiltersArm,
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
    sortTopicAreasByPopularity,
} from "./latestUtils.js"
import { LatestViewToggle } from "./LatestViewToggle.js"
import {
    searchParamsToState,
    stateToSearchParams,
    urlNeedsSanitization,
} from "./latestState.js"
import { LatestHit } from "./LatestHit.js"
import { LATEST_STICKY_FILTERS_ARMS, OwidGdocType } from "@ourworldindata/utils"
import { LatestSearchSkeleton } from "./LatestSearchSkeleton.js"
import { LatestContext } from "./LatestContext.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { SearchHorizontalDivider } from "../search/SearchHorizontalDivider.js"
import { SearchNoResults } from "../search/SearchNoResults.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { PoweredBy } from "react-instantsearch"
import { getPrefersReducedMotion } from "@ourworldindata/components"

/**
 * If a sticky element is currently stuck, scroll so it sits exactly at its
 * stuck position with the content below it starting right underneath — the
 * reader just changed a filter from the pinned bar and expects to see the
 * new results from the top, not wherever they had scrolled to. No-op when
 * the element isn't stuck (e.g. the reader is at the top of the page).
 *
 * The element's own geometry can't tell us where it sits when not stuck:
 * both getBoundingClientRect and offsetTop report the pinned position once
 * it is stuck. So the layout position is read off a zero-height sentinel
 * rendered immediately before it, adjusted for the element's top margin.
 */
function scrollToTopOfStuckElement(
    el: HTMLElement,
    sentinel: HTMLElement
): void {
    const style = getComputedStyle(el)
    const stickyTop = parseFloat(style.top) || 0
    if (el.getBoundingClientRect().top > stickyTop) return
    const naturalTop =
        window.scrollY +
        sentinel.getBoundingClientRect().top +
        (parseFloat(style.marginTop) || 0)
    window.scrollTo({
        top: naturalTop - stickyTop,
        behavior: getPrefersReducedMotion() ? "auto" : "smooth",
    })
}

const analytics = new SiteAnalytics()

export const LatestSearch = ({
    topicTagGraph,
    liteSearchClient,
}: {
    topicTagGraph: TagGraphRoot
    liteSearchClient: LiteClient
}) => {
    const [searchParams, setSearchParams] = useSearchParams()

    const { allAreas: tagGraphAreas } = useTagGraphTopics(topicTagGraph)
    const allAreas = useMemo(
        () => sortTopicAreasByPopularity(tagGraphAreas),
        [tagGraphAreas]
    )

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

    // Sticky filters experiment. The arm's layout is pure CSS keyed off the
    // body class; the reveal-on-scroll-up arm additionally hides the (sticky)
    // facets container while scrolling down.
    const stickyFiltersArm = useLatestStickyFiltersArm()
    const facetsContainerRef = useRef<HTMLDivElement>(null)
    const facetsSentinelRef = useRef<HTMLDivElement>(null)
    const areFacetsHidden = useIsStickyElementHidden(
        stickyFiltersArm === LATEST_STICKY_FILTERS_ARMS.revealOnScrollUp,
        facetsContainerRef
    )

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
        if (facetsContainerRef.current && facetsSentinelRef.current)
            scrollToTopOfStuckElement(
                facetsContainerRef.current,
                facetsSentinelRef.current
            )
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
    // Keep selected topics enabled so they can be deselected. Counts exclude
    // the topic filter, reflecting what each replacement selection would show.
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

    // Insights expand only in their type-filtered feed. Other announcements
    // expand for a deep link; data updates also expand under their type filter.
    const isExpanded = (hit: PageChronologicalRecord): boolean => {
        const isDeepLinked = hit.slug === autoExpandedSlug
        if (hit.type === OwidGdocType.DataInsight)
            return (
                activeView !== undefined &&
                (activeView === "expanded" || isDeepLinked)
            )
        return isDeepLinked || displayedLatestType === "data-update"
    }

    return (
        <LatestContext.Provider value={{ analytics }}>
            <LatestPageHeader />
            <div
                ref={facetsSentinelRef}
                className="latest-search__facets-sentinel"
            />
            <div
                ref={facetsContainerRef}
                className={cx(LATEST_FACETS_CONTAINER_CLASSES, {
                    "latest-search__facets-container--hidden": areFacetsHidden,
                })}
            >
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
                            isExpanded={isExpanded(hit)}
                            isTypeFiltered={displayedLatestType !== null}
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
                            isExpanded={isExpanded(hit)}
                            isTypeFiltered={displayedLatestType !== null}
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
