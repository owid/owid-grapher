import { useEffect, useMemo, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faChevronDown,
    faChevronLeft,
    faChevronRight,
    faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import {
    EnrichedRelatedItem,
    formatDate,
    PrimaryTopic,
    queryParamsToStr,
    RelatedContentType,
    RelatedItem,
} from "@ourworldindata/utils"
import { EntityName, SearchResultType } from "@ourworldindata/types"
import {
    generateSelectedEntityNamesParam,
    getSelectedEntityNamesParam,
} from "@ourworldindata/grapher"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.js"
import { createTopicFilter, SEARCH_BASE_PATH } from "./search/searchUtils.js"
import { stateToSearchParams } from "./search/searchState.js"
import relatedContentBySlug from "./dataPageRelatedContent.json"
import suggestedSearchesBySlug from "./dataPageSuggestedSearches.json"

const MAX_SUGGESTED_SEARCHES = 7
const COLLAPSED_ITEM_COUNT = 5

const buildTopicSearchHref = (topicName: string): string => {
    const params = stateToSearchParams({
        query: "",
        filters: [createTopicFilter(topicName)],
        requireAllCountries: false,
        resultType: SearchResultType.ALL,
    })
    return `${SEARCH_BASE_PATH}?${params.toString()}`
}

// Reads ?related=sidebar (or anything truthy) once on mount. Stable per
// page load — toggling the layout requires a navigation.
const useRelatedLayoutVariant = (): "default" | "sidebar" => {
    const [variant, setVariant] = useState<"default" | "sidebar">("default")
    useEffect(() => {
        if (typeof window === "undefined") return
        const params = new URLSearchParams(window.location.search)
        if (params.get("related") === "sidebar") setVariant("sidebar")
    }, [])
    return variant
}

const SUGGESTED_SEARCHES: Record<string, string[]> =
    suggestedSearchesBySlug as Record<string, string[]>

const KIND_LABEL: Record<RelatedContentType, string> = {
    "topic-page": "Topic page",
    article: "Article",
    "data-insight": "Data insight",
    grapher: "Data",
}

const CTA_ARIA_LABEL: Record<RelatedContentType, string> = {
    "topic-page": "Open topic",
    article: "Read article",
    "data-insight": "Read insight",
    grapher: "Open chart",
}

const FALLBACK_CONTENT: Record<string, RelatedItem[]> =
    relatedContentBySlug as Record<string, RelatedItem[]>

const slugFromUrl = (url: string): string => {
    try {
        const path = new URL(url).pathname
        const parts = path.split("/").filter(Boolean)
        return parts[parts.length - 1] ?? ""
    } catch {
        return ""
    }
}

// The baker enriches items at build time. When that hasn't run (e.g. the
// admin preview path, or when the related-content pipeline didn't return any
// items for this slug) we fall back to bare {url, title, type} from the JSON.
// For graphers and data insights we can still derive a chart thumbnail URL
// at runtime so the cards aren't visually empty.
const itemsFor = (
    slug: string | undefined,
    enriched: EnrichedRelatedItem[] | undefined
): EnrichedRelatedItem[] => {
    if (enriched && enriched.length > 0) return enriched
    if (!slug) return []
    const fallback = FALLBACK_CONTENT[slug]
    if (!fallback) return []
    return fallback.map((item) => {
        const itemSlug = slugFromUrl(item.url)
        if (item.type === "grapher" && itemSlug) {
            return {
                ...item,
                slug: itemSlug,
                thumbnailUrl: `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${itemSlug}.png?imType=thumbnail&imMinimal=1`,
            }
        }
        return { ...item, slug: itemSlug }
    })
}

export default function DataPageRelatedContent({
    slug,
    enrichedRelatedContent,
    primaryTopic,
}: {
    slug: string | undefined
    enrichedRelatedContent?: EnrichedRelatedItem[]
    primaryTopic?: PrimaryTopic
}) {
    const items = useMemo(
        () => itemsFor(slug, enrichedRelatedContent),
        [slug, enrichedRelatedContent]
    )
    const { pinnedItems, unpinnedItems } = useMemo(
        () => ({
            pinnedItems: items.filter((item) => item.isPinned),
            unpinnedItems: items.filter((item) => !item.isPinned),
        }),
        [items]
    )
    const selectedEntities = useSelectedEntitiesFromUrl()
    const layoutVariant = useRelatedLayoutVariant()
    const [expanded, setExpanded] = useState(false)
    // The sidebar prototype defaults to *open* so the user immediately sees
    // the experiment when they tack `?related=sidebar` onto a URL.
    const [sidebarOpen, setSidebarOpen] = useState(true)

    // When the sidebar is open we add a class to <body> so the global
    // layout shifts left to make room for it (rather than the sidebar
    // overlaying the page chrome). The class is media-query-guarded in
    // SCSS so mobile is unaffected — on mobile the section renders in the
    // bottom-of-page slot, not as a sidebar.
    useEffect(() => {
        if (typeof document === "undefined") return
        const cls = "has-related-sidebar-open"
        if (layoutVariant === "sidebar" && sidebarOpen) {
            document.body.classList.add(cls)
        } else {
            document.body.classList.remove(cls)
        }
        return () => document.body.classList.remove(cls)
    }, [layoutVariant, sidebarOpen])

    if (items.length === 0) return null

    const isSidebar = layoutVariant === "sidebar"
    const visibleUnpinned = expanded
        ? unpinnedItems
        : unpinnedItems.slice(0, COLLAPSED_ITEM_COUNT)
    const hasMore = unpinnedItems.length > visibleUnpinned.length
    const topicTag = primaryTopic?.topicTag
    const viewAllHref = topicTag ? buildTopicSearchHref(topicTag) : undefined

    const renderItem = (item: EnrichedRelatedItem): React.ReactNode =>
        item.type === "grapher" ? (
            <IndicatorRow
                item={item}
                selectedRegionNames={selectedEntities}
                compact={isSidebar}
            />
        ) : (
            <ContentRow item={item} compact={isSidebar} />
        )

    const body = (
        <>
            <header className="data-page-related-content__heading">
                <h2 className="data-page-related-content__title">Up next</h2>
            </header>
            {pinnedItems.length > 0 && (
                <section className="data-page-related-content__our-picks">
                    <h3 className="data-page-related-content__our-picks-title">
                        Our picks
                    </h3>
                    <ol className="data-page-related-content__items">
                        {pinnedItems.map((item, i) => (
                            <li key={`pinned-${i}`}>{renderItem(item)}</li>
                        ))}
                    </ol>
                </section>
            )}
            <ol className="data-page-related-content__items">
                {visibleUnpinned.map((item, i) => (
                    <li key={i}>{renderItem(item)}</li>
                ))}
            </ol>
            {hasMore && (
                <div className="data-page-related-content__expand-wrapper">
                    <button
                        type="button"
                        className="data-page-related-content__expand"
                        onClick={() => setExpanded(true)}
                        aria-expanded={expanded}
                        aria-label="Show more related content"
                    >
                        Show more
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            aria-hidden="true"
                        />
                    </button>
                </div>
            )}
            {expanded && (
                <div className="data-page-related-content__view-all-wrapper">
                    <Button
                        theme="solid-vermillion"
                        text={
                            topicTag
                                ? `View all our work on ${topicTag}`
                                : "View all our work"
                        }
                        href={viewAllHref ?? SEARCH_BASE_PATH}
                        dataTrackNote="data-page-related-content-view-all"
                        icon={faMagnifyingGlass}
                        iconPosition="left"
                    />
                </div>
            )}
        </>
    )

    if (isSidebar) {
        // On mobile (md-down) the sidebar prototype degrades to a
        // regular bottom-of-page block; CSS hides the open/close
        // affordances and unforces the fixed positioning. The aside is
        // always rendered so mobile always sees the body.
        const sidebarClass =
            "data-page-related-content data-page-related-content--sidebar" +
            (sidebarOpen ? "" : " data-page-related-content--sidebar-closed")
        return (
            <>
                {!sidebarOpen && (
                    <button
                        type="button"
                        className="data-page-related-sidebar__open-tab"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Show related content"
                    >
                        <FontAwesomeIcon icon={faChevronLeft} />
                    </button>
                )}
                <aside className={sidebarClass} aria-label="Related content">
                    <button
                        type="button"
                        className="data-page-related-content__sidebar-hide"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <FontAwesomeIcon icon={faChevronRight} />
                        Hide
                    </button>
                    <div className="data-page-related-content__sidebar-body">
                        {body}
                    </div>
                </aside>
            </>
        )
    }

    return <section className="data-page-related-content">{body}</section>
}

export function SuggestedSearches({ slug }: { slug: string | undefined }) {
    if (!slug) return null
    const terms = SUGGESTED_SEARCHES[slug]
    if (!terms || terms.length === 0) return null
    const visible = terms.slice(0, MAX_SUGGESTED_SEARCHES)
    return (
        <div className="data-page-related-content__suggested-searches">
            <ul
                className="data-page-related-content__suggested-searches-list"
                aria-label="Suggested searches"
            >
                {visible.map((term) => {
                    const href = `${SEARCH_BASE_PATH}${queryParamsToStr({
                        q: term,
                        resultType: SearchResultType.ALL,
                    })}`
                    return (
                        <li
                            key={term}
                            className="data-page-related-content__suggested-search"
                        >
                            <a
                                href={href}
                                className="data-page-related-content__suggested-search-pill"
                            >
                                {term}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

// Article / data-insight / topic-page — same visual shape, varying only in
// kind-label color and meta line. `compact` switches to a vertical-card
// layout (thumbnail on top, text below) used in the sidebar prototype.
function ContentRow({
    item,
    compact = false,
}: {
    item: EnrichedRelatedItem
    compact?: boolean
}) {
    const panelClass =
        `data-page-related-content__panel data-page-related-content__panel--${item.type}` +
        (compact ? " data-page-related-content__panel--compact" : "")
    const meta = formatMeta(item)

    return (
        <a
            className={panelClass}
            href={item.url}
            aria-label={`${CTA_ARIA_LABEL[item.type]}: ${item.title}`}
        >
            {item.thumbnailUrl && (
                <div className="data-page-related-content__panel-thumbnail">
                    <img
                        src={item.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                    />
                </div>
            )}
            <div className="data-page-related-content__panel-body">
                <span
                    className={`data-page-related-content__kind-label data-page-related-content__kind-label--${item.type}`}
                >
                    {KIND_LABEL[item.type]}
                </span>
                <h3 className="data-page-related-content__panel-title">
                    {item.title}
                </h3>
                {item.excerpt && (
                    <p className="data-page-related-content__panel-excerpt">
                        {truncate(item.excerpt, 500)}
                    </p>
                )}
                {meta && (
                    <p className="data-page-related-content__panel-meta">
                        {meta}
                    </p>
                )}
            </div>
            <span className="data-page-related-content__cta" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
            </span>
        </a>
    )
}

// Grapher updates the data-page URL with `history.replaceState` when the
// user toggles entities, which doesn't fire `popstate`. We monkey-patch
// pushState/replaceState once per session so any listener can subscribe to
// "the URL changed" via a regular DOM event.
const HISTORY_PATCH_EVENT = "owid-history-change"
let historyPatched = false
const patchHistoryOnce = (): void => {
    if (historyPatched || typeof window === "undefined") return
    historyPatched = true
    const dispatch = (): void => {
        window.dispatchEvent(new Event(HISTORY_PATCH_EVENT))
    }
    const origPush = window.history.pushState.bind(window.history)
    const origReplace = window.history.replaceState.bind(window.history)
    window.history.pushState = (...args: Parameters<History["pushState"]>) => {
        origPush(...args)
        dispatch()
    }
    window.history.replaceState = (
        ...args: Parameters<History["replaceState"]>
    ) => {
        origReplace(...args)
        dispatch()
    }
    window.addEventListener("popstate", dispatch)
}

const readEntitiesFromUrl = (): EntityName[] => {
    if (typeof window === "undefined") return []
    const country = new URLSearchParams(window.location.search).get("country")
    if (!country) return []
    return getSelectedEntityNamesParam(country) ?? []
}

const sameEntities = (a: EntityName[], b: EntityName[]): boolean => {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

// Read the host data page's selected entities from the URL's `country=`
// param and react to changes (debounced) so the indicator-row thumbnails
// stay in sync with the user's selection on the main chart.
function useSelectedEntitiesFromUrl(debounceMs = 400): EntityName[] {
    const [entities, setEntities] = useState<EntityName[]>([])

    useEffect(() => {
        patchHistoryOnce()
        // Initial read happens here (not in useState) so SSR and the first
        // client render produce identical HTML — avoids hydration mismatch.
        setEntities(readEntitiesFromUrl())

        let timer: ReturnType<typeof setTimeout> | undefined
        const onChange = (): void => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                const next = readEntitiesFromUrl()
                setEntities((prev) => (sameEntities(prev, next) ? prev : next))
            }, debounceMs)
        }
        window.addEventListener(HISTORY_PATCH_EVENT, onChange)
        return () => {
            window.removeEventListener(HISTORY_PATCH_EVENT, onChange)
            if (timer) clearTimeout(timer)
        }
    }, [debounceMs])

    return entities
}

// Shared helper: assemble the `tab=` and `country=` query params from the
// indicator-row state. Used to build both the thumbnail preview URL and
// the click-through chart URL so they stay in sync — clicking lands the
// user on the same entities + tab they see in the thumbnail.
const buildIndicatorQueryParams = (
    entities: EntityName[],
    tab?: string
): URLSearchParams => {
    const params = new URLSearchParams()
    if (tab) params.set("tab", tab)
    if (entities.length > 0) {
        params.set("country", generateSelectedEntityNamesParam(entities))
    }
    return params
}

// Dynamic-thumbnail URL for an indicator, baking in the user's currently-
// selected entities and the carousel's current tab.
const buildIndicatorThumbnailUrl = (
    slug: string,
    entities: EntityName[],
    tab?: string
): string => {
    const params = buildIndicatorQueryParams(entities, tab)
    params.set("imType", "thumbnail")
    params.set("imMinimal", "1")
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png?${params.toString()}`
}

// Click-through chart URL — same entities and tab as the thumbnail, so
// the user lands on the view they were previewing.
const buildIndicatorChartUrl = (
    baseUrl: string,
    entities: EntityName[],
    tab?: string
): string => {
    const qs = buildIndicatorQueryParams(entities, tab).toString()
    return qs ? `${baseUrl}?${qs}` : baseUrl
}

// Grapher / data — visually mirrors ContentRow so titles and thumbnails
// align across every kind of related item, making the list easy to skim.
// A single thumbnail (the chart's default tab) replaces the earlier
// FeaturedMetrics-style multi-tab card; the thumbnail reflects the
// currently-selected entities on the host data page.
function IndicatorRow({
    item,
    selectedRegionNames,
    compact = false,
}: {
    item: EnrichedRelatedItem
    selectedRegionNames: EntityName[]
    compact?: boolean
}) {
    const tabs = item.availableTabs ?? []
    const [tabIndex, setTabIndex] = useState(0)
    // Modulo on each render handles the edge case where `availableTabs`
    // could shrink between renders (or be empty), without resetting the
    // state.
    const currentTab =
        tabs.length > 0 ? tabs[tabIndex % tabs.length] : undefined
    const hasCarousel = tabs.length > 1

    const thumbnailUrl = item.slug
        ? buildIndicatorThumbnailUrl(item.slug, selectedRegionNames, currentTab)
        : item.thumbnailUrl

    // Carry the carousel's current tab and the host page's selected
    // entities into the click-through URL, so the user lands on the view
    // they were previewing in the thumbnail.
    const chartHref = buildIndicatorChartUrl(
        item.url,
        selectedRegionNames,
        currentTab
    )

    const panelClass =
        "data-page-related-content__panel data-page-related-content__panel--grapher" +
        (compact ? " data-page-related-content__panel--compact" : "")

    const cyclePrev = (e: React.MouseEvent): void => {
        e.preventDefault()
        e.stopPropagation()
        setTabIndex((i) => (i - 1 + tabs.length) % tabs.length)
    }
    const cycleNext = (e: React.MouseEvent): void => {
        e.preventDefault()
        e.stopPropagation()
        setTabIndex((i) => (i + 1) % tabs.length)
    }

    // Stretched-link pattern: the panel is a <div> so the carousel
    // buttons can be real <button>s (HTML disallows interactive
    // descendants of <a>). The overlay link is z-index 0; buttons sit
    // above it and stop propagation on click.
    return (
        <div className={panelClass}>
            <a
                href={chartHref}
                className="data-page-related-content__panel-stretched-link"
                aria-label={`${CTA_ARIA_LABEL.grapher}: ${item.title}`}
            >
                <span>{item.title}</span>
            </a>
            {thumbnailUrl && (
                <div className="data-page-related-content__indicator-thumbnail-wrapper">
                    <IndicatorSingleThumbnail src={thumbnailUrl} />
                    {hasCarousel && (
                        <>
                            <button
                                type="button"
                                className="data-page-related-content__indicator-carousel-btn data-page-related-content__indicator-carousel-btn--prev"
                                onClick={cyclePrev}
                                aria-label={`Previous tab for ${item.title}`}
                            >
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </button>
                            <button
                                type="button"
                                className="data-page-related-content__indicator-carousel-btn data-page-related-content__indicator-carousel-btn--next"
                                onClick={cycleNext}
                                aria-label={`Next tab for ${item.title}`}
                            >
                                <FontAwesomeIcon icon={faChevronRight} />
                            </button>
                        </>
                    )}
                </div>
            )}
            <div className="data-page-related-content__panel-body">
                <span className="data-page-related-content__kind-label data-page-related-content__kind-label--grapher">
                    {KIND_LABEL.grapher}
                </span>
                <h3 className="data-page-related-content__panel-title">
                    {item.title}
                </h3>
                {(item.variantName || item.source) && (
                    <p className="data-page-related-content__panel-meta">
                        {[item.variantName, item.source]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                )}
                {item.subtitle && (
                    <p className="data-page-related-content__panel-excerpt">
                        {truncate(item.subtitle, 500)}
                    </p>
                )}
            </div>
            <span className="data-page-related-content__cta" aria-hidden="true">
                <FontAwesomeIcon icon={faArrowRight} />
            </span>
        </div>
    )
}

function IndicatorSingleThumbnail({ src }: { src: string }) {
    const [imgError, setImgError] = useState(false)
    return (
        <div
            className={
                "data-page-related-content__indicator-thumbnail" +
                (imgError
                    ? " data-page-related-content__indicator-thumbnail--error"
                    : "")
            }
        >
            {!imgError && (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={300}
                    height={160}
                    onError={() => setImgError(true)}
                />
            )}
        </div>
    )
}

function formatMeta(item: EnrichedRelatedItem): string | undefined {
    const parts: string[] = []
    if (item.authors && item.authors.length > 0) {
        parts.push(formatAuthors(item.authors))
    }
    if (item.publishedAt) {
        try {
            parts.push(formatDate(new Date(item.publishedAt)))
        } catch {
            // ignore unparseable dates
        }
    }
    return parts.length > 0 ? parts.join(" · ") : undefined
}

function formatAuthors(authors: string[]): string {
    if (authors.length <= 2) return authors.join(" and ")
    return `${authors.slice(0, -1).join(", ")} and ${authors[authors.length - 1]}`
}

function truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    const sliced = text.slice(0, maxChars)
    const lastSpace = sliced.lastIndexOf(" ")
    return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trimEnd() + "…"
}
