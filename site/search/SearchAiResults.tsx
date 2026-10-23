import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import cx from "clsx"
import {
    AiSearchAngle,
    AiSearchChartCandidate,
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchGroup,
    AiSearchPageCandidate,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    OwidGdocType,
    SearchChartHit,
} from "@ourworldindata/types"
import { getCanonicalPath } from "@ourworldindata/components"
import { listedRegionsNames } from "@ourworldindata/utils"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
} from "@ourworldindata/grapher"
import { useSearchContext } from "./SearchContext.js"
import { streamAiSearch, useAiSearchSettings } from "./aiSearchClient.js"
import {
    constructChartUrl,
    constructPreviewUrl,
    toGrapherQueryParams,
} from "./searchUtils.js"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"
import { SearchAiBetaBadge, SearchAiIcon } from "./SearchAiTeaser.js"

interface AiSearchView {
    status: "running" | "done" | "stopped" | "error"
    statusText: string
    charts: Map<number, AiSearchChartCandidate>
    pages: Map<number, AiSearchPageCandidate>
    groups: AiSearchGroup[]
    related: string[]
    expansions: string[]
    debug: { title: string; text: string }[]
    error?: { code: AiSearchErrorCode; message: string }
    model?: string
    timings?: Record<string, number>
}

type AiSearchAction =
    | AiSearchEvent
    | { type: "reset" }
    | { type: "stopped" }
    // The stream ended, with or without a "done" event
    | { type: "finished" }

const initialView = (): AiSearchView => ({
    status: "running",
    statusText: "Searching our charts and articles…",
    charts: new Map(),
    pages: new Map(),
    groups: [],
    related: [],
    expansions: [],
    debug: [],
})

function reduceAiSearch(
    view: AiSearchView,
    action: AiSearchAction
): AiSearchView {
    switch (action.type) {
        case "reset":
            return initialView()
        case "status":
            return { ...view, statusText: action.text }
        case "expansion":
            return { ...view, expansions: action.queries }
        case "candidates":
            return {
                ...view,
                charts: new Map(action.charts.map((c) => [c.id, c])),
                pages: new Map(action.pages.map((p) => [p.id, p])),
            }
        case "group": {
            const { type: _type, ...group } = action
            return {
                ...view,
                groups: [...view.groups, group],
                statusText: "Grouping the results…",
            }
        }
        case "related":
            return { ...view, related: action.queries }
        case "debug":
            return { ...view, debug: [...view.debug, action] }
        case "done":
            return {
                ...view,
                status: "done",
                model: action.model,
                timings: action.timings,
            }
        case "error":
            // Keep the groups that already arrived
            return view.groups.length
                ? { ...view, status: "done" }
                : {
                      ...view,
                      status: "error",
                      error: { code: action.code, message: action.message },
                  }
        case "stopped":
            return view.status === "running"
                ? { ...view, status: "stopped" }
                : view
        case "finished":
            if (view.status !== "running") return view
            return view.groups.length
                ? { ...view, status: "done" }
                : {
                      ...view,
                      status: "error",
                      error: {
                          code: "failed",
                          message:
                              "Something went wrong while grouping the results. Try again.",
                      },
                  }
    }
}

// Errors that can't be fixed by asking again
const FINAL_ERRORS: AiSearchErrorCode[] = ["unavailable", "no_candidates"]

/**
 * The AI-assisted search prototype: the site's keyword search results,
 * grouped by theme by Claude (see functions/api/ai-search). Shown above the
 * standard results, which stay below for the same query.
 */
export const SearchAiResults = ({ query }: { query: string }) => {
    const { aiSearch } = useSearchContext()
    const [settings] = useAiSearchSettings()
    const [view, dispatch] = useReducer(reduceAiSearch, undefined, initialView)
    const [attempt, setAttempt] = useState(0)
    const controllerRef = useRef<AbortController | null>(null)
    const sectionRef = useRef<HTMLElement>(null)

    // Asks again whenever a setting changes
    const { model, effort, expand, pool, debug, cache } = settings
    useEffect(() => {
        const controller = new AbortController()
        controllerRef.current = controller
        dispatch({ type: "reset" })
        streamAiSearch({
            query,
            settings: { model, effort, expand, pool, debug },
            // A retry asks again rather than replaying a cached answer
            useCache: cache && attempt === 0,
            signal: controller.signal,
            onEvent: dispatch,
        })
            .then(() => dispatch({ type: "finished" }))
            .catch(() => {
                if (!controller.signal.aborted) dispatch({ type: "finished" })
            })
        return () => controller.abort()
    }, [query, model, effort, expand, pool, debug, cache, attempt])

    useEffect(() => {
        sectionRef.current?.scrollIntoView({
            block: "start",
            behavior: "smooth",
        })
    }, []) // the component is keyed by query

    const stop = (): void => {
        controllerRef.current?.abort()
        dispatch({ type: "stopped" })
    }
    const retry = (): void => setAttempt((n) => n + 1)
    const isRunning = view.status === "running"

    return (
        <section
            ref={sectionRef}
            className="search-ai-results col-start-2 span-cols-12"
            aria-live="polite"
            aria-busy={isRunning}
        >
            <header className="search-ai-results__header">
                <span className="search-ai-results__mark">
                    <SearchAiIcon />
                    AI-assisted search
                </span>
                <SearchAiBetaBadge />
                <span className="search-ai-results__query">for “{query}”</span>
                <button
                    type="button"
                    className="search-ai-results__close"
                    onClick={aiSearch.close}
                >
                    Back to standard results
                </button>
            </header>

            {isRunning && (
                <div className="search-ai-results__status">
                    <span className="search-ai-spinner" aria-hidden="true" />
                    <span>{view.statusText}</span>
                    <button
                        type="button"
                        className="search-ai-results__stop"
                        onClick={stop}
                    >
                        Stop
                    </button>
                </div>
            )}

            <div className="search-ai-results__groups">
                {view.groups.map((group, i) => (
                    <SearchAiGroup
                        key={i}
                        group={group}
                        isLead={i === 0}
                        charts={view.charts}
                        pages={view.pages}
                    />
                ))}
                {isRunning &&
                    Array.from(
                        { length: view.groups.length ? 1 : 3 },
                        (_, i) => <SearchAiGroupSkeleton key={i} />
                    )}
                {view.status === "stopped" && !view.groups.length && (
                    <div className="search-ai-results__message">
                        Stopped.
                        <button type="button" onClick={retry}>
                            Run AI search again
                        </button>
                    </div>
                )}
                {view.status === "error" && view.error && (
                    <div className="search-ai-results__message search-ai-results__message--error">
                        {view.error.message}
                        {!FINAL_ERRORS.includes(view.error.code) && (
                            <button type="button" onClick={retry}>
                                Try again
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!isRunning && view.status !== "error" && (
                <footer className="search-ai-results__footer">
                    {view.related.length > 0 && <span>Related:</span>}
                    {view.related.map((related) => (
                        <button
                            key={related}
                            type="button"
                            className="search-ai-results__related"
                            onClick={() => aiSearch.start(related)}
                        >
                            <SearchAiIcon />
                            {related}
                        </button>
                    ))}
                    <a
                        className="search-ai-results__all"
                        href="#search-template-results"
                    >
                        All results for “{query}” ↓
                    </a>
                </footer>
            )}

            {settings.debug && <SearchAiDebug view={view} />}
        </section>
    )
}

const ANGLE_LABELS: Record<AiSearchAngle, string> = {
    today: "Around the world today",
    history: "Long-run change",
    breakdown: "Breakdown",
    correlates: "Correlates",
    other: "",
}

// Groups whose charts read well with one country highlighted
const COUNTRY_ANGLES: AiSearchAngle[] = ["today", "history", "breakdown"]

const SearchAiGroup = ({
    group,
    isLead,
    charts,
    pages,
}: {
    group: AiSearchGroup
    isLead: boolean
    charts: Map<number, AiSearchChartCandidate>
    pages: Map<number, AiSearchPageCandidate>
}) => {
    const [country, setCountry] = useState<string | undefined>()
    const groupCharts = group.charts.flatMap(({ id, tab }) => {
        const hit = charts.get(id)
        return hit ? [{ hit, tab }] : []
    })
    const reads = [...group.articles, ...group.insights].flatMap((id) => {
        const page = pages.get(id)
        return page ? [page] : []
    })
    const canAddCountry =
        groupCharts.length > 0 && COUNTRY_ANGLES.includes(group.angle)

    return (
        <article className="search-ai-group">
            <div className="search-ai-group__text">
                {ANGLE_LABELS[group.angle] && (
                    <div className="search-ai-group__angle">
                        {ANGLE_LABELS[group.angle]}
                    </div>
                )}
                <h3 className="search-ai-group__title">{group.title}</h3>
                <p className="search-ai-group__blurb">{group.blurb}</p>
                {reads.length > 0 && (
                    <div className="search-ai-group__reads">
                        {reads.map((page) => (
                            <SearchAiReadLink key={page.id} page={page} />
                        ))}
                    </div>
                )}
                {canAddCountry && (
                    <SearchAiCountryPicker
                        country={country}
                        setCountry={setCountry}
                    />
                )}
            </div>
            <div
                className={cx("search-ai-group__charts", {
                    "search-ai-group__charts--lead":
                        isLead && groupCharts.length >= 3,
                })}
            >
                {groupCharts.map(({ hit, tab }) => (
                    <SearchAiChartCard
                        key={hit.id}
                        hit={hit}
                        tab={tab}
                        country={country}
                    />
                ))}
            </div>
        </article>
    )
}

const SearchAiChartCard = ({
    hit,
    tab,
    country,
}: {
    hit: AiSearchChartCandidate
    tab?: GrapherTabName
    country?: string
}) => {
    // The URL helpers only read the slug, type and query params
    const chartHit = hit as unknown as SearchChartHit
    const grapherParams = toGrapherQueryParams({
        entities: country ? [country] : [],
        tab,
    })
    return (
        <a
            className="search-ai-chart-card"
            href={constructChartUrl({ hit: chartHit, grapherParams })}
        >
            <span className="search-ai-chart-card__thumbnail">
                <img
                    alt=""
                    loading="lazy"
                    width={GRAPHER_THUMBNAIL_WIDTH}
                    height={GRAPHER_THUMBNAIL_HEIGHT}
                    src={constructPreviewUrl({
                        hit: chartHit,
                        grapherParams,
                        variant: PreviewVariant.Thumbnail,
                    })}
                />
                {tab === GRAPHER_TAB_NAMES.WorldMap && (
                    <span className="search-ai-chart-card__view">Map</span>
                )}
            </span>
            <span className="search-ai-chart-card__title">
                {hit.title}
                {hit.variantName && (
                    <span className="search-ai-chart-card__variant">
                        {" "}
                        {hit.variantName}
                    </span>
                )}
                {country && (
                    <span className="search-ai-chart-card__variant">
                        {" "}
                        · with {country}
                    </span>
                )}
            </span>
        </a>
    )
}

const PAGE_KIND_LABELS: Partial<Record<OwidGdocType, string>> = {
    [OwidGdocType.Article]: "Article",
    [OwidGdocType.TopicPage]: "Topic page",
    [OwidGdocType.LinearTopicPage]: "Topic page",
    [OwidGdocType.DataInsight]: "Data insight",
}

const SearchAiReadLink = ({ page }: { page: AiSearchPageCandidate }) => {
    const isTopicPage =
        page.type === OwidGdocType.TopicPage ||
        page.type === OwidGdocType.LinearTopicPage
    const author = !isTopicPage ? page.authors?.[0] : undefined
    return (
        <a
            className="search-ai-read"
            href={getCanonicalPath(page.slug, page.type)}
        >
            {page.thumbnailUrl ? (
                <img
                    className="search-ai-read__image"
                    src={page.thumbnailUrl}
                    alt=""
                    loading="lazy"
                />
            ) : (
                <span className="search-ai-read__image" />
            )}
            <span>
                <span className="search-ai-read__kind">
                    {PAGE_KIND_LABELS[page.type] ?? "Article"}
                    {author && ` · ${author}`}
                </span>
                <span className="search-ai-read__title">{page.title}</span>
            </span>
        </a>
    )
}

const SearchAiCountryPicker = ({
    country,
    setCountry,
}: {
    country?: string
    setCountry: (country: string | undefined) => void
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const regions = useMemo(() => listedRegionsNames(), [])

    if (country)
        return (
            <div className="search-ai-group__country">
                <span className="search-ai-country-pill">
                    {country}
                    <button
                        type="button"
                        aria-label={`Remove ${country}`}
                        onClick={() => setCountry(undefined)}
                    >
                        ×
                    </button>
                </span>
            </div>
        )

    if (!isEditing)
        return (
            <div className="search-ai-group__country">
                <button
                    type="button"
                    className="search-ai-country-button"
                    onClick={() => setIsEditing(true)}
                >
                    + Add a country
                </button>
            </div>
        )

    const commit = (value: string): void => {
        const match = regions.find(
            (region) => region.toLowerCase() === value.trim().toLowerCase()
        )
        if (match) {
            setCountry(match)
            setIsEditing(false)
        }
    }

    return (
        <div className="search-ai-group__country">
            <input
                className="search-ai-country-input"
                list="search-ai-country-list"
                placeholder="Type a country…"
                aria-label="Country"
                autoFocus
                onChange={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commit(e.currentTarget.value)
                    if (e.key === "Escape") setIsEditing(false)
                }}
                onBlur={() => setIsEditing(false)}
            />
            <datalist id="search-ai-country-list">
                {regions.map((region) => (
                    <option key={region} value={region} />
                ))}
            </datalist>
        </div>
    )
}

const SearchAiGroupSkeleton = () => (
    <div
        className="search-ai-group search-ai-group--skeleton"
        aria-hidden="true"
    >
        <div className="search-ai-group__text">
            <div className="search-ai-skeleton search-ai-skeleton--line-short" />
            <div className="search-ai-skeleton search-ai-skeleton--title" />
            <div className="search-ai-skeleton search-ai-skeleton--line" />
        </div>
        <div className="search-ai-group__charts">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="search-ai-skeleton search-ai-skeleton--thumbnail"
                />
            ))}
        </div>
    </div>
)

const SearchAiDebug = ({ view }: { view: AiSearchView }) => {
    const timings = Object.entries(view.timings ?? {})
        .map(([label, ms]) => `${label} ${(ms / 1000).toFixed(1)}s`)
        .join(" · ")
    return (
        <details className="search-ai-debug">
            <summary>Prototype: timings and raw model output</summary>
            {view.model && (
                <p>
                    <strong>Answered by:</strong> {view.model}
                    {timings && ` · ${timings}`}
                </p>
            )}
            {view.expansions.length > 0 && (
                <>
                    <strong>Expansion searches</strong>
                    <pre>{view.expansions.join("\n")}</pre>
                </>
            )}
            {view.debug.map((entry, i) => (
                <div key={i}>
                    <strong>{entry.title}</strong>
                    <pre>{entry.text}</pre>
                </div>
            ))}
        </details>
    )
}
