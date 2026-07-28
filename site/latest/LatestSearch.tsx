import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import {
    LATEST_PAGE_TYPE_VALUES,
    LatestNewsletter,
    LatestState,
    LatestType,
    TagGraphRoot,
} from "@ourworldindata/types"
import { LiteClient } from "algoliasearch/lite"
import { useTagGraphTopics } from "../search/searchHooks.js"
import { useInfiniteLatestPages, useLatestAnalytics } from "./latestHooks.js"
import { LatestTopicFacets } from "./LatestTopicFacets.js"
import {
    searchParamsToState,
    stateToSearchParams,
    urlNeedsSanitization,
} from "./latestState.js"
import { LatestHit } from "./LatestHit.js"
import { LatestNewsletterHit } from "./LatestNewsletterHit.js"
import { LatestFeedItem, weaveNewslettersIntoFeed } from "./latestUtils.js"
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
    newsletters,
    liteSearchClient,
}: {
    topicTagGraph: TagGraphRoot
    /** Injected at bake time (window._OWID_NEWSLETTERS), sorted by date
     * descending. Newsletters live outside the Algolia index and are woven
     * into the feed client-side. */
    newsletters: LatestNewsletter[]
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
        for (const value of LATEST_PAGE_TYPE_VALUES) {
            if (value === latestType) continue
            if (value === "newsletter") {
                // Newsletters live outside Algolia and carry no topic tags,
                // so they're only available when no topic is selected.
                if (topics.length > 0 || newsletters.length === 0)
                    disabled.add(value)
                continue
            }
            if ((latestTypeFacetCounts[value] ?? 0) === 0) disabled.add(value)
        }
        return disabled
    }, [latestType, latestTypeFacetCounts, topics.length, newsletters.length])

    // Weave bake-time newsletters into the Algolia-backed record stream.
    const feedItems: LatestFeedItem[] = useMemo(() => {
        // Newsletters have no topic tags, so any topic selection excludes
        // them; likewise any non-newsletter type filter.
        const includeNewsletters = topics.length === 0
        if (latestType === "newsletter")
            return includeNewsletters
                ? newsletters.map((newsletter) => ({
                      kind: "newsletter" as const,
                      newsletter,
                  }))
                : []
        const recordItems = hits.map((record) => ({
            kind: "record" as const,
            record,
        }))
        if (!includeNewsletters || latestType) return recordItems
        return weaveNewslettersIntoFeed(hits, newsletters, hasNextPage ?? false)
    }, [hits, newsletters, topics.length, latestType, hasNextPage])

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

    const renderFeedItem = (item: LatestFeedItem, position: number) =>
        item.kind === "newsletter" ? (
            <LatestNewsletterHit
                key={`newsletter-${item.newsletter.mailchimpId}`}
                hit={item.newsletter}
                position={position}
            />
        ) : (
            <LatestHit
                key={item.record.objectID}
                hit={item.record}
                selectedTopic={topics[0]}
                position={position}
                shouldAutoExpand={item.record.slug === autoExpandedSlug}
            />
        )

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

    return (
        <LatestContext.Provider value={{ analytics }}>
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
            ) : feedItems.length === 0 ? (
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
                    {feedItems
                        .slice(0, 2)
                        .map((item, i) => renderFeedItem(item, i + 1))}
                    {/* Always render the signup block — with 0 or 1 hits it
                        falls below whatever cards exist, which is the
                        intended layout. */}
                    <NewsletterSignupBlock
                        className="latest-page__newsletter-signup col-start-11 span-cols-3 col-lg-start-10 span-lg-cols-4 span-md-cols-14 col-md-start-1"
                        context={NewsletterSubscriptionContext.Latest}
                    />
                    {feedItems
                        .slice(2)
                        .map((item, i) => renderFeedItem(item, i + 3))}
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
