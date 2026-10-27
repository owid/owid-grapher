import { useEffect, useReducer, useRef, useState } from "react"
import {
    AiSearchAngle,
    AiSearchChartCandidate,
    AiSearchErrorCode,
    AiSearchEvent,
    AiSearchGroup,
    AiSearchPageCandidate,
    OwidGdocType,
    SearchChartHit,
    StackedArticleHit,
} from "@ourworldindata/types"
import { useSearchContext } from "./SearchContext.js"
import { streamAiSearch, useAiSearchSettings } from "./aiSearchClient.js"
import { SearchAiBetaBadge, SearchAiIcon } from "./SearchAiTeaser.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchStackedArticleHit } from "./SearchStackedArticleHit.js"

interface AiSearchView {
    status: "running" | "done" | "stopped" | "error"
    statusText: string
    charts: Map<number, AiSearchChartCandidate>
    pages: Map<number, AiSearchPageCandidate>
    groups: AiSearchGroup[]
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

/** An error, unless some groups already arrived: those are kept. */
const failed = (view: AiSearchView, code: AiSearchErrorCode): AiSearchView =>
    view.groups.length
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
                    <SearchAiSection
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
                        (_, i) => <SearchAiSectionSkeleton key={i} />
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

const noop = (): void => undefined

/**
 * The fields the standard chart results need beyond what the endpoint sends:
 * they pick entities from availableEntities only when the user selected
 * countries, which the AI panel doesn't do.
 */
const toSearchChartHit = (chart: AiSearchChartCandidate): SearchChartHit =>
    ({
        ...chart,
        objectID: `ai-search-${chart.id}`,
        availableEntities: [],
        __position: 0,
    }) as SearchChartHit

/**
 * One theme, laid out with the standard search results: its first chart as a
 * rich result (large in the first theme), the rest as compact rows, then the
 * articles and data insights the model filed under the same theme.
 */
const SearchAiSection = ({
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
    const groupCharts = group.charts.flatMap(({ id }) => {
        const chart = charts.get(id)
        return chart ? [toSearchChartHit(chart)] : []
    })
    const reads = [...group.articles, ...group.insights].flatMap((id) => {
        const page = pages.get(id)
        return page ? [page] : []
    })

    return (
        <article className="search-ai-section">
            {ANGLE_LABELS[group.angle] && (
                <div className="search-ai-section__angle">
                    {ANGLE_LABELS[group.angle]}
                </div>
            )}
            <h3 className="search-ai-section__title">{group.title}</h3>
            <p className="search-ai-section__blurb">{group.blurb}</p>
            {groupCharts.length > 0 && (
                <ul className="search-ai-section__charts">
                    {groupCharts.map((hit, i) => (
                        <li
                            key={hit.objectID}
                            className="search-ai-section__chart"
                        >
                            <SearchChartHitComponent
                                hit={hit}
                                variant={
                                    i > 0
                                        ? "small"
                                        : isLead
                                          ? "large"
                                          : "medium"
                                }
                                onClick={noop}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {reads.length > 0 && (
                <div className="search-ai-section__reads">
                    {reads.map((page) => (
                        <SearchAiRead key={page.id} page={page} />
                    ))}
                </div>
            )}
        </article>
    )
}

const SearchAiRead = ({ page }: { page: AiSearchPageCandidate }) => {
    if (page.type === OwidGdocType.DataInsight)
        return (
            <SearchDataInsightHit
                hit={{
                    title: page.title,
                    slug: page.slug,
                    type: OwidGdocType.DataInsight,
                    thumbnailUrl: page.thumbnailUrl ?? "",
                    date: page.date ?? "",
                    objectID: `ai-search-${page.id}`,
                }}
                onClick={noop}
            />
        )
    return (
        <SearchStackedArticleHit
            hit={{
                title: page.title,
                slug: page.slug,
                // Topic pages link the same way, by slug and type
                type: page.type as StackedArticleHit["type"],
                thumbnailUrl: page.thumbnailUrl ?? "",
                excerpt: page.excerpt ?? "",
                objectID: `ai-search-${page.id}`,
            }}
            onClick={noop}
        />
    )
}

const SearchAiSectionSkeleton = () => (
    <div
        className="search-ai-section search-ai-section--skeleton"
        aria-hidden="true"
    >
        <div className="search-ai-skeleton animate-pulse search-ai-skeleton--line-short" />
        <div className="search-ai-skeleton animate-pulse search-ai-skeleton--title" />
        <div className="search-ai-skeleton animate-pulse search-ai-skeleton--line" />
        <div className="search-ai-skeleton animate-pulse search-ai-skeleton--chart" />
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
