import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons"
import {
    AiSearchAngle,
    AiSearchChartCandidate,
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchGroup,
    AiSearchCurated,
    AiSearchInput,
    AiSearchLayout,
    AiSearchMode,
    AiSearchPageCandidate,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
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
import {
    SearchAiCurated,
    SearchAiLead,
    SearchAiModeBar,
    SearchAiReadLink,
    SearchAiTopicPages,
} from "./SearchAiLayouts.js"
import { PreviewVariant } from "./SearchChartHitRichDataTypes.js"
import { SearchAiBetaBadge, SearchAiIcon } from "./SearchAiTeaser.js"

interface AiSearchView {
    status: "running" | "done" | "stopped" | "error"
    statusText: string
    charts: Map<number, AiSearchChartCandidate>
    pages: Map<number, AiSearchPageCandidate>
    groups: AiSearchGroup[]
    layout?: AiSearchLayout
    curated?: AiSearchCurated
    related: string[]
    expansions: string[]
    debug: { title: string; text: string }[]
    error?: AiSearchErrorCode
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
        case "layout": {
            const { type: _type, ...layout } = action
            return { ...view, layout }
        }
        case "curated": {
            const { type: _type, ...curated } = action
            return { ...view, curated }
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
            return failed(view, action.code)
        case "stopped":
            return view.status === "running"
                ? { ...view, status: "stopped" }
                : view
        case "finished":
            return view.status === "running" ? failed(view, "failed") : view
    }
}

/** An error, unless some results already arrived: those are kept. */
const failed = (view: AiSearchView, code: AiSearchErrorCode): AiSearchView =>
    view.groups.length || view.layout?.lead || view.curated
        ? { ...view, status: "done" }
        : { ...view, status: "error", error: code }

const errorMessage = (code: AiSearchErrorCode, query: string): string =>
    ({
        unavailable: "AI search isn't available on this server.",
        no_candidates: `We couldn't find any charts or articles matching “${query}”. Try different words.`,
        rate_limited:
            "Too many AI searches in a short time. Wait a minute, then try again.",
        refused: "Claude declined this search. Try wording it differently.",
        no_groups:
            "The model didn't return any groups. Try again or change the settings.",
        failed: "Something went wrong while grouping the results. Try again.",
    })[code]

// Errors that can't be fixed by asking again
const FINAL_ERRORS: AiSearchErrorCode[] = ["unavailable", "no_candidates"]

/**
 * The AI-assisted search prototype: the site's keyword search results,
 * grouped by theme by Claude (see functions/api/ai-search). Shown above the
 * standard results, which stay below for the same query.
 */
export const SearchAiResults = ({ input }: { input: AiSearchInput }) => {
    const query = [input.query, ...input.countries, ...input.topics]
        .filter(Boolean)
        .join(" · ")
    const { aiSearch } = useSearchContext()
    const [settings] = useAiSearchSettings()
    const [view, dispatch] = useReducer(reduceAiSearch, undefined, initialView)
    const [attempt, setAttempt] = useState(0)
    // The results shape the reader switched to, if any
    const [pickedMode, setPickedMode] = useState<AiSearchMode | undefined>()
    const controllerRef = useRef<AbortController | null>(null)
    const inputRef = useRef(input)
    const sectionRef = useRef<HTMLElement>(null)

    // Asks again whenever a setting changes
    const { model, effort, expand, pool, debug, cache } = settings
    useEffect(() => {
        const controller = new AbortController()
        controllerRef.current = controller
        dispatch({ type: "reset" })
        streamAiSearch({
            // The component is keyed by the input, so it never changes
            input: inputRef.current,
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
    }, [model, effort, expand, pool, debug, cache, attempt])

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

    // Hold the groups back until the layout is known, so the lead chart
    // doesn't push them down once they're on screen
    const layout = view.layout
    const isLayoutPending = !layout && isRunning
    const hasLead = !!layout?.lead && !!view.charts.get(layout.lead.id)
    const curated = view.curated
    const available: Record<AiSearchMode, boolean> = {
        targeted: hasLead,
        explore: isRunning || view.groups.length > 0,
        curated: !!curated && curated.topics.length + curated.pages.length > 0,
    }
    const bestMode = layout?.mode
    const mode: AiSearchMode =
        pickedMode && available[pickedMode]
            ? pickedMode
            : bestMode && available[bestMode]
              ? bestMode
              : hasLead
                ? "targeted"
                : "explore"
    const isTopicMap = mode === "explore"
    const showsGroups = mode !== "curated"
    // Charts and pages already shown above the groups
    const shownIds = new Set<number>(
        mode === "targeted" && layout?.lead
            ? [layout.lead.id, ...layout.versions]
            : (layout?.topicPages ?? [])
    )
    const groupCountry =
        layout?.intent === "place" || layout?.intent === "country_topic"
            ? layout.country
            : undefined
    const topicPages = (layout?.topicPages ?? []).flatMap((id) => {
        const page = view.pages.get(id)
        return page ? [page] : []
    })

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
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span className="search-ai-results__close-label">
                        Back to standard results
                    </span>
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

            {layout && (
                <SearchAiModeBar
                    mode={mode}
                    bestMode={bestMode}
                    available={available}
                    onPick={setPickedMode}
                />
            )}
            {mode === "targeted" && layout && (
                <SearchAiLead layout={layout} charts={view.charts} />
            )}
            {mode === "curated" && curated && (
                <SearchAiCurated curated={curated} country={layout?.country} />
            )}
            {mode === "explore" && !isLayoutPending && (
                <SearchAiTopicPages pages={topicPages} />
            )}
            {mode === "targeted" && view.groups.length > 0 && (
                <h3 className="search-ai-results__more">More on “{query}”</h3>
            )}

            <div
                className={cx("search-ai-results__groups", {
                    "search-ai-results__groups--map": isTopicMap,
                })}
            >
                {!isLayoutPending &&
                    showsGroups &&
                    view.groups.map((group, i) => (
                        <SearchAiGroup
                            key={i}
                            group={group}
                            isLead={i === 0 && !hasLead && !isTopicMap}
                            isCompact={isTopicMap}
                            charts={view.charts}
                            pages={view.pages}
                            hiddenIds={shownIds}
                            initialCountry={groupCountry}
                        />
                    ))}
                {isRunning &&
                    showsGroups &&
                    Array.from(
                        {
                            length:
                                view.groups.length && !isLayoutPending ? 1 : 3,
                        },
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
                        {errorMessage(view.error, query)}
                        {!FINAL_ERRORS.includes(view.error) && (
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
    isCompact,
    charts,
    pages,
    hiddenIds,
    initialCountry,
}: {
    group: AiSearchGroup
    isLead: boolean
    // In the topic map, groups sit side by side with fewer charts each
    isCompact: boolean
    charts: Map<number, AiSearchChartCandidate>
    pages: Map<number, AiSearchPageCandidate>
    // Shown above already, by the lead or topic layout
    hiddenIds: Set<number>
    initialCountry?: string
}) => {
    const canAddCountry = COUNTRY_ANGLES.includes(group.angle)
    const [country, setCountry] = useState<string | undefined>(
        canAddCountry ? initialCountry : undefined
    )
    const groupCharts = group.charts
        .filter(({ id }) => !hiddenIds.has(id))
        .flatMap(({ id, tab }) => {
            const hit = charts.get(id)
            return hit ? [{ hit, tab }] : []
        })
        .slice(0, isCompact ? 3 : undefined)
    const reads = [...group.articles, ...group.insights]
        .filter((id) => !hiddenIds.has(id))
        .flatMap((id) => {
            const page = pages.get(id)
            return page ? [page] : []
        })
        .slice(0, isCompact ? 1 : undefined)
    if (!groupCharts.length && !reads.length) return null

    return (
        <article
            className={cx("search-ai-group", {
                "search-ai-group--compact": isCompact,
            })}
        >
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
                {canAddCountry && groupCharts.length > 0 && !isCompact && (
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
    const grapherParams = toGrapherQueryParams({
        entities: country ? [country] : [],
        tab,
    })
    return (
        <a
            className="search-ai-chart-card"
            href={constructChartUrl({ hit, grapherParams })}
        >
            <span className="search-ai-chart-card__thumbnail">
                <img
                    alt=""
                    loading="lazy"
                    width={GRAPHER_THUMBNAIL_WIDTH}
                    height={GRAPHER_THUMBNAIL_HEIGHT}
                    src={constructPreviewUrl({
                        hit,
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
            <div className="search-ai-skeleton animate-pulse search-ai-skeleton--line-short" />
            <div className="search-ai-skeleton animate-pulse search-ai-skeleton--title" />
            <div className="search-ai-skeleton animate-pulse search-ai-skeleton--line" />
        </div>
        <div className="search-ai-group__charts">
            {[0, 1, 2].map((i) => (
                <div
                    key={i}
                    className="search-ai-skeleton animate-pulse search-ai-skeleton--thumbnail"
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
