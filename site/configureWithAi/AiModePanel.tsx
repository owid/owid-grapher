import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faCalendar,
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
import type {
    HistoryEntry,
    PanelState,
    PanelStore,
} from "./configureWithAiStore.js"

const MODELS = [
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Opus 5.5" },
] as const
type ModelId = (typeof MODELS)[number]["id"]
const DEFAULT_MODEL: ModelId = "claude-haiku-5-5"
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

const iconForTab = (tab: string): IconDefinition =>
    tab === "table" ? faTable : tab === "map" ? faEarthAmericas : faChartLine

export function AiModePanel({
    store,
    state,
}: {
    store: PanelStore
    state: PanelState
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
        draft.forId === state.currentId ? draft.text : (current?.query ?? "")
    const setInput = (text: string): void =>
        setDraft({ forId: state.currentId, text })
    const [model, setModel] = useState<ModelId>(readStoredModel)
    const isThinking = request.status === "thinking"

    const ask = (query: string): void => {
        setInput(query)
        void store.ask(query, model)
    }

    const changeModel = (id: ModelId): void => {
        setModel(id)
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, id)
        } catch {
            // The choice just isn't remembered
        }
    }

    const showIntro =
        !current && history.length === 0 && request.status === "idle"

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
                                ? "e.g. compare Germany with its neighbours"
                                : "Ask for another view"
                        }
                        aria-label="Describe the view you want"
                        value={input}
                        readOnly={isThinking}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        autoFocus
                    />
                    {isThinking ? (
                        <button
                            className="configure-with-ai__submit"
                            type="button"
                            onClick={() => store.stop()}
                        >
                            Stop
                        </button>
                    ) : (
                        <button
                            className="configure-with-ai__submit"
                            type="submit"
                            aria-label="Find views"
                            disabled={!input.trim()}
                        >
                            <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    )}
                </div>
            </form>

            <div className="configure-with-ai__body">
                <RequestStatus store={store} state={state} ask={ask} />

                {showIntro && <Intro slug={store.slug} ask={ask} />}

                {current && !isThinking && (
                    <Answer store={store} entry={current} isBusy={isBusy} />
                )}

                {history.length > 0 && <History store={store} state={state} />}
            </div>

            <div className="configure-with-ai__footer">
                <span>Beta. Your request is sent to Claude, an AI model.</span>
                <label className="configure-with-ai__model">
                    <span className="sr-only">Model</span>
                    <select
                        value={model}
                        onChange={(e) => changeModel(e.target.value as ModelId)}
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
                    {(current.usage.ms / 1000).toFixed(1)} s ·{" "}
                    {(
                        current.usage.inputTokens +
                        current.usage.cacheReadTokens +
                        current.usage.cacheWriteTokens
                    ).toLocaleString()}{" "}
                    in ({current.usage.cacheReadTokens.toLocaleString()} cached)
                    · {current.usage.outputTokens.toLocaleString()} out
                </p>
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
                {request.status === "thinking" &&
                    (elapsed >= SLOW_AFTER_SECONDS
                        ? "Taking longer than usual…"
                        : `Finding views for “${request.query}”…`)}
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
                    <p>
                        {request.interpretation ||
                            "This chart has no view that matches."}{" "}
                        The chart hasn't changed.
                    </p>
                    <a href={searchUrl(request.query)}>
                        Search all charts for “{request.query}”
                    </a>
                </div>
            )}
            {/* Kept for screen readers once the answer is applied */}
            {request.status === "idle" && store.current && (
                <span className="sr-only">
                    Showing {store.current.views[store.current.active].label}
                </span>
            )}
        </>
    )
}

function Intro({ slug, ask }: { slug: string; ask: (q: string) => void }) {
    const suggestions = SUGGESTIONS[slug] ?? []
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
    return (
        <div className="configure-with-ai__answer">
            <ul className="configure-with-ai__views">
                {entry.views.map((view, i) => {
                    const isActive = i === entry.active
                    return (
                        <li key={i}>
                            <button
                                className={cx("configure-with-ai__view", {
                                    "configure-with-ai__view--active": isActive,
                                })}
                                type="button"
                                aria-current={isActive}
                                disabled={isBusy && !isActive}
                                onClick={() => store.selectView(i)}
                            >
                                <span className="configure-with-ai__view-label">
                                    {view.label}
                                </span>
                                {view.closestMatch && (
                                    <span className="configure-with-ai__closest">
                                        Closest match
                                    </span>
                                )}
                                {isActive && (
                                    <span className="configure-with-ai__now">
                                        Now showing
                                    </span>
                                )}
                                {isActive && view.note && (
                                    <span className="configure-with-ai__note">
                                        {view.note}
                                    </span>
                                )}
                            </button>
                        </li>
                    )
                })}
            </ul>
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

function History({ store, state }: { store: PanelStore; state: PanelState }) {
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
                                onClick={() => store.goBackTo(row.id)}
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
