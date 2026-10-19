import { useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faCalendar,
    faChartColumn,
    faEyeSlash,
    faMagnifyingGlass,
    faChartLine,
    faEarthAmericas,
    faRotateLeft,
    faTable,
    faThumbsDown,
    faThumbsUp,
    faWandMagicSparkles,
    type IconDefinition,
} from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"
import { CookieKey } from "@ourworldindata/grapher"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../../settings/clientSettings.mjs"
import {
    viewThumbnailUrl,
    type ConfigureWithAiView,
} from "./configureWithAiView.js"
import type {
    HistoryEntry,
    PanelState,
    PanelStore,
    Suggestions,
    Usage,
} from "./configureWithAiStore.js"

const MODELS = [
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Opus 5.5" },
] as const
type ModelId = (typeof MODELS)[number]["id"]
const DEFAULT_MODEL: ModelId = "claude-sonnet-5-5"
const MODEL_STORAGE_KEY = "configure-with-ai:model"
const MAX_QUERY_LENGTH = 100
const SLOW_AFTER_SECONDS = 10

// Joe's "Try…" suggestions for the four charts he tested
const SUGGESTIONS: Record<string, string[]> = {
    "share-of-population-in-extreme-poverty": [
        "Where has extreme poverty fallen?",
        "Compare extreme poverty rates in African countries",
        "Where is extreme poverty rising?",
    ],
    "life-expectancy": [
        "How does life expectancy differ across continents?",
        "Which countries have the lowest life expectancy?",
        "Show the impact of COVID-19",
    ],
    "co-emissions-per-capita": [
        "Top 10 emitters per person",
        "Compare the UK, the US, China and India",
        "Where have emissions per person fallen most since 1990?",
    ],
    "incomes-across-distribution-wb": [
        "How unequal is South Africa compared to Brazil?",
        "Which countries have the highest median income?",
        "How have the poorest 10% fared in China?",
    ],
}

// Search 404s on staging servers, so link to the live site
const searchUrl = (query: string): string =>
    `https://ourworldindata.org/search?q=${encodeURIComponent(query)}`

function readStoredModel(): ModelId {
    try {
        const stored = localStorage.getItem(MODEL_STORAGE_KEY)
        return MODELS.find((m) => m.id === stored)?.id ?? DEFAULT_MODEL
    } catch {
        return DEFAULT_MODEL
    }
}

const BAR_TABS = [
    "discrete-bar",
    "stacked-discrete-bar",
    "stacked-bar",
    "marimekko",
]
const COUNTER_FROM = 80

const iconForTab = (tab: string): IconDefinition =>
    tab === "table"
        ? faTable
        : tab === "map"
          ? faEarthAmericas
          : BAR_TABS.includes(tab)
            ? faChartColumn
            : faChartLine

function isStaffBrowser(): boolean {
    const host = window.location.host
    return (
        host.includes("staging") ||
        host.includes("localhost") ||
        document.cookie.includes(CookieKey.isAdmin)
    )
}

const modelLabel = (model: string): string =>
    MODELS.find((m) => model.startsWith(m.id))?.label ?? model

const formatCost = (usd: number): string =>
    usd >= 1
        ? `$${usd.toFixed(2)}`
        : usd >= 0.01
          ? `$${usd.toFixed(3)}`
          : `$${usd.toFixed(4)}`

/**
 * This answer's cost, and what it would cost as the first question on its
 * chart (cache written, not read), which is how most readers would arrive.
 * Budget with the first-question figure; Sonnet also tends to write more.
 */
function costLines(usage: Usage): string[] {
    const model =
        MODELS.find((m) => usage.model.startsWith(m.id))?.id ?? DEFAULT_MODEL
    const lines: string[] = []
    for (const id of ["claude-sonnet-5-5", "claude-haiku-5-5"] as const) {
        const costs = usage.costUsdByModel?.[id]
        if (!costs || costs.asRun === null || costs.firstQuestion === null)
            continue
        const prefix =
            id === model ? modelLabel(id) : `Same tokens on ${modelLabel(id)}`
        lines.push(
            `${prefix}: ${formatCost(costs.asRun)} · as a first question ${formatCost(costs.firstQuestion)} (${formatCost(costs.firstQuestion * 1000)} per 1,000)`
        )
    }
    return lines
}

export function AiModePanel({
    store,
    state,
    autoFocus,
}: {
    store: PanelStore
    state: PanelState
    /** Focus the input on open; not when the tab was chosen with arrow keys */
    autoFocus: boolean
}) {
    const { request, history, isBusy } = state
    const current = history.find((e) => e.id === state.currentId)
    // What the reader typed while this entry was showing; going back in
    // History shows that entry's question instead
    const [draft, setDraft] = useState<{ forId: number | null; text: string }>({
        forId: null,
        text: "",
    })
    const input =
        draft.forId === state.currentId
            ? draft.text
            : request.status !== "idle"
              ? request.query
              : (current?.query ?? "")
    const setInput = (text: string): void =>
        setDraft({ forId: state.currentId, text })
    // Staff get the model picker and the usage line; everyone else gets
    // the default model. Staging servers are only reachable by staff, and
    // there the cookie can't be set (it's Secure and they're served over
    // http); elsewhere the cookie is a hint set by visiting the admin, not
    // access control.
    const [isStaff] = useState(isStaffBrowser)
    const [storedModel, setModel] = useState<ModelId>(readStoredModel)
    const model = isStaff ? storedModel : DEFAULT_MODEL
    const isThinking = request.status === "thinking"
    const isIdle = request.status === "idle" || request.status === "stopped"
    const inputRef = useRef<HTMLInputElement>(null)
    const bodyRef = useRef<HTMLDivElement>(null)

    const focusInput = (): void => inputRef.current?.focus()

    const ask = (query: string): void => {
        // The answer's entry shows the question from here on
        setDraft({ forId: -1, text: "" })
        void store.ask(query, model)
        focusInput()
    }

    // Show the start of a long question rather than its end
    useEffect(() => {
        const el = inputRef.current
        if (input && el && document.activeElement !== el) el.scrollLeft = 0
    }, [input])

    const afterGoingBack = (): void => {
        // Start reading from the top again; the row clicked becomes
        // disabled, which would otherwise drop focus
        if (bodyRef.current) bodyRef.current.scrollTop = 0
        focusInput()
    }

    const changeModel = (id: ModelId): void => {
        setModel(id)
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, id)
        } catch {
            // The choice just isn't remembered
        }
    }

    // Also shown after going back to the chart as it was opened; History
    // stays below it
    const showIntro = !current && isIdle

    return (
        <div className="configure-with-ai__ai">
            <form
                className="configure-with-ai__form"
                autoComplete="off"
                onSubmit={(e) => {
                    e.preventDefault()
                    ask(input)
                }}
            >
                {showIntro && (
                    <label
                        className="configure-with-ai__intro-title"
                        htmlFor="configure-with-ai-input"
                    >
                        Describe the view you want
                    </label>
                )}
                <div className="configure-with-ai__field">
                    <FontAwesomeIcon
                        className="configure-with-ai__field-icon"
                        icon={faWandMagicSparkles}
                    />
                    <input
                        id="configure-with-ai-input"
                        className="configure-with-ai__input"
                        type="text"
                        enterKeyHint="go"
                        maxLength={MAX_QUERY_LENGTH}
                        placeholder={
                            showIntro
                                ? "e.g. Germany's neighbours"
                                : "Ask for another view"
                        }
                        aria-label="Describe the view you want"
                        ref={inputRef}
                        value={input}
                        readOnly={isThinking || isBusy}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        autoFocus={autoFocus}
                    />
                    {input.length >= COUNTER_FROM && !isThinking && (
                        <span
                            className="configure-with-ai__counter"
                            aria-live="polite"
                        >
                            {input.length}/{MAX_QUERY_LENGTH}
                        </span>
                    )}
                    {isThinking ? (
                        <button
                            // A key of its own, so React doesn't turn this
                            // button into the submit one while it's pressed
                            key="stop"
                            className="configure-with-ai__submit"
                            type="button"
                            onClick={(e) => {
                                e.preventDefault()
                                store.stop()
                                // The button goes away, which would drop focus
                                focusInput()
                            }}
                        >
                            Stop
                        </button>
                    ) : (
                        <button
                            key="submit"
                            className="configure-with-ai__submit"
                            type="submit"
                            aria-label="Find views"
                            disabled={!input.trim() || isBusy}
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    )}
                </div>
            </form>

            <div className="configure-with-ai__body" ref={bodyRef}>
                <RequestStatus store={store} state={state} ask={ask} />

                {showIntro && (
                    <Intro
                        store={store}
                        state={state}
                        isStaff={isStaff}
                        ask={ask}
                    />
                )}

                {/* A failed or empty answer replaces the previous one, which
                    is summed up as what the chart still shows */}
                {(request.status === "empty" || request.status === "error") && (
                    <StillShows slug={store.slug} entry={current} />
                )}

                {current && isIdle && (
                    <Answer store={store} entry={current} isBusy={isBusy} />
                )}

                {history.length > 0 && (
                    <History
                        store={store}
                        state={state}
                        afterGoingBack={afterGoingBack}
                    />
                )}
            </div>

            <p className="configure-with-ai__disclosure">
                Beta. Your request is sent to Claude, an AI model.
            </p>
            {isStaff && (
                <div className="configure-with-ai__staff">
                    <div className="configure-with-ai__staff-row">
                        <span className="configure-with-ai__staff-label">
                            <FontAwesomeIcon icon={faEyeSlash} />
                            Only visible to OWID staff
                        </span>
                        <label className="configure-with-ai__model">
                            <span className="sr-only">Model</span>
                            <select
                                value={model}
                                onChange={(e) =>
                                    changeModel(e.target.value as ModelId)
                                }
                            >
                                {MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {current && (
                        <p className="configure-with-ai__usage">
                            {modelLabel(current.usage.model)} ·{" "}
                            {(current.usage.ms / 1000).toFixed(1)} s ·{" "}
                            {(
                                current.usage.inputTokens +
                                current.usage.cacheReadTokens +
                                current.usage.cacheWriteTokens
                            ).toLocaleString()}{" "}
                            in ({current.usage.cacheReadTokens.toLocaleString()}{" "}
                            cached) ·{" "}
                            {current.usage.outputTokens.toLocaleString()} out
                        </p>
                    )}
                    {current &&
                        costLines(current.usage).map((line) => (
                            <p className="configure-with-ai__usage" key={line}>
                                {line}
                            </p>
                        ))}
                </div>
            )}
        </div>
    )
}

function RequestStatus({
    store,
    state,
    ask,
}: {
    store: PanelStore
    state: PanelState
    ask: (query: string) => void
}) {
    const { request } = state
    const [now, setNow] = useState(Date.now)
    const started = request.status === "thinking" ? request.started : 0
    const elapsed = started ? Math.max(0, (now - started) / 1000) : 0

    useEffect(() => {
        if (!started) return
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [started])

    return (
        <>
            <p className="configure-with-ai__status" role="status">
                {request.status === "thinking"
                    ? elapsed >= SLOW_AFTER_SECONDS
                        ? "Taking longer than usual…"
                        : `Finding views for “${request.query}”…`
                    : state.isBusy
                      ? "Loading this view…"
                      : store.current && (
                            <span className="sr-only">
                                Showing{" "}
                                {
                                    store.current.views[store.current.active]
                                        .label
                                }
                            </span>
                        )}
            </p>
            {request.status === "thinking" && (
                <div className="configure-with-ai__placeholders" aria-hidden>
                    <span />
                    <span />
                    <span />
                </div>
            )}
            {request.status === "error" && (
                <div className="configure-with-ai__message configure-with-ai__message--error">
                    <p>{request.message} The chart hasn't changed.</p>
                    <button
                        className="configure-with-ai__link-button"
                        type="button"
                        onClick={() => ask(request.query)}
                    >
                        Try again
                    </button>
                </div>
            )}
            {request.status === "empty" && (
                <div className="configure-with-ai__message">
                    <strong>No view of this chart matches</strong>
                    {request.interpretation && <p>{request.interpretation}</p>}
                    <a
                        className="configure-with-ai__search-link"
                        href={searchUrl(request.searchQuery ?? request.query)}
                    >
                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                        Search for “{request.searchQuery ?? request.query}”
                    </a>
                </div>
            )}
        </>
    )
}

function Intro({
    store,
    state,
    isStaff,
    ask,
}: {
    store: PanelStore
    state: PanelState
    isStaff: boolean
    ask: (q: string) => void
}) {
    const suggestions = SUGGESTIONS[store.slug] ?? []
    const shouldGenerate = isStaff && suggestions.length === 0

    useEffect(() => {
        if (shouldGenerate) void store.loadSuggestions()
    }, [shouldGenerate, store])
    return (
        <div className="configure-with-ai__intro">
            <p className="configure-with-ai__section-title">It can change</p>
            <ul className="configure-with-ai__can">
                <li>
                    <FontAwesomeIcon icon={faEarthAmericas} />
                    <span>
                        <strong>Which countries</strong>
                        <span>
                            “Germany and its neighbours”, “the 10 lowest”
                        </span>
                    </span>
                </li>
                <li>
                    <FontAwesomeIcon icon={faCalendar} />
                    <span>
                        <strong>Which years</strong>
                        <span>“since 2000”, “before and after COVID-19”</span>
                    </span>
                </li>
                <li>
                    <FontAwesomeIcon icon={faChartLine} />
                    <span>
                        <strong>How it's shown</strong>
                        <span>“a map of Africa”, “a ranked table”</span>
                    </span>
                </li>
            </ul>
            <p className="configure-with-ai__muted">
                It shows this chart's data only. For other data,{" "}
                <a href="https://ourworldindata.org/search">
                    search all charts
                </a>
                .
            </p>
            {suggestions.length > 0 && (
                <>
                    <p className="configure-with-ai__section-title">Try</p>
                    <ul className="configure-with-ai__suggestions">
                        {suggestions.map((s) => (
                            <li key={s}>
                                <button type="button" onClick={() => ask(s)}>
                                    {s}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {shouldGenerate && (
                <GeneratedSuggestions
                    suggestions={state.suggestions}
                    ask={ask}
                />
            )}
        </div>
    )
}

/** Staff only: suggestions the model wrote for a chart that has none */
function GeneratedSuggestions({
    suggestions,
    ask,
}: {
    suggestions: Suggestions
    ask: (q: string) => void
}) {
    return (
        <div className="configure-with-ai__staff configure-with-ai__staff--box">
            <p className="configure-with-ai__staff-label">
                <FontAwesomeIcon icon={faEyeSlash} />
                Written by AI for now; these will be precomputed later
            </p>
            {suggestions.status === "done" && suggestions.items.length > 0 ? (
                <ul className="configure-with-ai__suggestions">
                    {suggestions.items.map((s) => (
                        <li key={s}>
                            <button type="button" onClick={() => ask(s)}>
                                {s}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="configure-with-ai__muted">
                    {suggestions.status === "loading" ||
                    suggestions.status === "idle"
                        ? "Writing suggestions for this chart…"
                        : "No suggestions this time."}
                </p>
            )}
        </div>
    )
}

function Answer({
    store,
    entry,
    isBusy,
}: {
    store: PanelStore
    entry: HistoryEntry
    isBusy: boolean
}) {
    const view = entry.views[entry.active]
    const others = entry.views
        .map((v, i) => ({ view: v, index: i }))
        .filter(({ index }) => index !== entry.active)
    return (
        <div className="configure-with-ai__answer">
            <div className="configure-with-ai__applied">
                <span className="configure-with-ai__now">
                    {isBusy ? "Loading…" : "Now showing"}
                </span>
                <span className="configure-with-ai__view-label">
                    {view.label}
                </span>
                {view.closestMatch && (
                    <span className="configure-with-ai__closest">
                        Closest match
                    </span>
                )}
                {view.facts && (
                    <span className="configure-with-ai__facts">
                        {view.facts}
                    </span>
                )}
                {view.note && (
                    <span className="configure-with-ai__note">{view.note}</span>
                )}
            </div>
            {others.length > 0 && (
                <div className="configure-with-ai__others">
                    <p className="configure-with-ai__section-title">
                        Other views
                    </p>
                    <ul className="configure-with-ai__strip">
                        {others.map(({ view: other, index }) => (
                            <li key={index}>
                                <OtherView
                                    slug={store.slug}
                                    view={other}
                                    disabled={isBusy}
                                    onClick={() => store.selectView(index)}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="configure-with-ai__feedback">
                <span>
                    {entry.feedback
                        ? "Thanks for the feedback"
                        : "Was this useful?"}
                </span>
                <button
                    className="configure-with-ai__thumb"
                    type="button"
                    aria-pressed={entry.feedback === "up"}
                    aria-label="Useful"
                    onClick={() => store.sendFeedback("up")}
                >
                    <FontAwesomeIcon icon={faThumbsUp} />
                </button>
                <button
                    className="configure-with-ai__thumb"
                    type="button"
                    aria-pressed={entry.feedback === "down"}
                    aria-label="Not useful"
                    onClick={() => store.sendFeedback("down")}
                >
                    <FontAwesomeIcon icon={faThumbsDown} />
                </button>
            </div>
        </div>
    )
}

/** What's on the chart after an answer that changed nothing */
function StillShows({
    slug,
    entry,
}: {
    slug: string
    entry: HistoryEntry | undefined
}) {
    const view = entry?.views[entry.active]
    const src = view
        ? viewThumbnailUrl(GRAPHER_DYNAMIC_THUMBNAIL_URL, slug, view)
        : null
    return (
        <div className="configure-with-ai__still">
            {src ? (
                <img
                    className="configure-with-ai__still-image"
                    src={src}
                    alt=""
                    loading="lazy"
                />
            ) : (
                <span className="configure-with-ai__other-icon" aria-hidden>
                    <FontAwesomeIcon
                        icon={view ? iconForTab(view.tab) : faRotateLeft}
                    />
                </span>
            )}
            <span className="configure-with-ai__still-text">
                <span>The chart still shows</span>
                <span>{view?.label ?? "The chart as you opened it"}</span>
            </span>
        </div>
    )
}

function OtherView({
    slug,
    view,
    disabled,
    onClick,
}: {
    slug: string
    view: ConfigureWithAiView
    disabled: boolean
    onClick: () => void
}) {
    const src = viewThumbnailUrl(GRAPHER_DYNAMIC_THUMBNAIL_URL, slug, view)
    const [hasFailed, setHasFailed] = useState(false)
    return (
        <button
            className="configure-with-ai__other"
            type="button"
            disabled={disabled}
            onClick={onClick}
        >
            {src && !hasFailed ? (
                <img
                    className="configure-with-ai__other-image"
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={() => setHasFailed(true)}
                />
            ) : (
                <span className="configure-with-ai__other-icon" aria-hidden>
                    <FontAwesomeIcon icon={iconForTab(view.tab)} />
                </span>
            )}
            <span className="configure-with-ai__other-label">
                {view.label}
                {view.closestMatch && (
                    <span className="configure-with-ai__closest">
                        Closest match
                    </span>
                )}
            </span>
        </button>
    )
}

function History({
    store,
    state,
    afterGoingBack,
}: {
    store: PanelStore
    state: PanelState
    afterGoingBack: () => void
}) {
    const rows: {
        id: number | null
        icon: IconDefinition
        label: string
        detail: string
    }[] = [
        ...state.history.map((entry) => {
            const view = entry.views[entry.active]
            return {
                id: entry.id,
                icon: iconForTab(view.tab),
                label: view.label,
                detail: `“${entry.query}”`,
            }
        }),
        {
            id: null,
            icon: faRotateLeft,
            label: "The chart as you opened it",
            detail: "Before AI mode",
        },
    ]
    return (
        <div className="configure-with-ai__history">
            <p className="configure-with-ai__section-title">History</p>
            <ol>
                {rows.map((row) => {
                    const isCurrent = row.id === state.currentId
                    return (
                        <li key={row.id ?? "start"}>
                            <button
                                className={cx(
                                    "configure-with-ai__history-row",
                                    {
                                        "configure-with-ai__history-row--current":
                                            isCurrent,
                                    }
                                )}
                                type="button"
                                aria-current={isCurrent}
                                disabled={isCurrent || state.isBusy}
                                onClick={() => {
                                    store.goBackTo(row.id)
                                    afterGoingBack()
                                }}
                            >
                                <span
                                    className="configure-with-ai__history-icon"
                                    aria-hidden
                                >
                                    <FontAwesomeIcon icon={row.icon} />
                                </span>
                                <span className="configure-with-ai__history-text">
                                    <span>{row.label}</span>
                                    <span>
                                        {isCurrent ? "Now showing" : row.detail}
                                    </span>
                                </span>
                                {!isCurrent && (
                                    <span className="configure-with-ai__history-go">
                                        Go back
                                    </span>
                                )}
                            </button>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
