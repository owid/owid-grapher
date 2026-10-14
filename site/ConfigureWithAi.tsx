import { useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faMagnifyingGlass,
    faThumbsDown,
    faThumbsUp,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"
import type { ConfigureWithAiView } from "./configureWithAiView.js"

// "Configure with AI" prototype (staging only): a reader asks for a view of
// this chart, /api/configure-with-ai returns 2–4 views, and clicking one
// applies it. Ported from Joe's Claude artifact; see
// functions/api/configure-with-ai/ for the prompt and the validation.

interface Usage {
    model: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    contextMs: number
    ms: number
}

type AiState =
    | { status: "idle" }
    | { status: "thinking"; query: string; started: number }
    | { status: "error"; query: string; message: string }
    | {
          status: "results"
          query: string
          interpretation: string
          views: ConfigureWithAiView[]
          active: number
          runId: string
          usage: Usage
          feedback?: "up" | "down"
      }

const MODELS = [
    { id: "claude-haiku-5-5", label: "Haiku 5.5" },
    { id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
    { id: "claude-opus-5-5", label: "Opus 5.5" },
] as const
type ModelId = (typeof MODELS)[number]["id"]
const DEFAULT_MODEL: ModelId = "claude-sonnet-5-5"
const MODEL_STORAGE_KEY = "configure-with-ai:model"
const MAX_QUERY_LENGTH = 100

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

function readStoredModel(): ModelId {
    try {
        const stored = localStorage.getItem(MODEL_STORAGE_KEY)
        return MODELS.find((m) => m.id === stored)?.id ?? DEFAULT_MODEL
    } catch {
        return DEFAULT_MODEL
    }
}

export function ConfigureWithAi({
    slug,
    getQueryStr,
    applyView,
}: {
    slug: string
    /** The current view as a query string: Grapher's params plus MDim choices */
    getQueryStr: () => string
    applyView: (view: ConfigureWithAiView) => void
}) {
    const [ai, setAi] = useState<AiState>({ status: "idle" })
    const [input, setInput] = useState("")
    // Once a query has been acted on, focusing the box starts a fresh one
    const [isInputIngested, setIsInputIngested] = useState(false)
    // The box only renders on the client, so localStorage is available here
    const [model, setModel] = useState<ModelId>(readStoredModel)
    const [elapsed, setElapsed] = useState(0)
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
        if (ai.status !== "thinking") return
        const timer = setInterval(
            () => setElapsed(Math.round((Date.now() - ai.started) / 1000)),
            500
        )
        return () => clearInterval(timer)
    }, [ai])

    const runQuery = async (rawQuery: string): Promise<void> => {
        const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH)
        if (!query || ai.status === "thinking") return
        setInput(query)
        setIsInputIngested(true)
        setElapsed(0)
        setAi({ status: "thinking", query, started: Date.now() })
        const controller = new AbortController()
        abortRef.current = controller
        try {
            const response = await fetch("/api/configure-with-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug,
                    query,
                    queryStr: getQueryStr(),
                    model,
                }),
                signal: controller.signal,
            })
            const body = await response.json()
            if (!response.ok) {
                setAi({
                    status: "error",
                    query,
                    message:
                        body.error === "invalid_json"
                            ? "The answer couldn't be read as a set of views. Try again, or rephrase the request."
                            : body.error === "refused"
                              ? "The model declined this request. Try asking for a view of the data."
                              : "Something went wrong. Try again.",
                })
                return
            }
            setAi({
                status: "results",
                query,
                interpretation: body.interpretation,
                views: body.views,
                active: 0,
                runId: body.runId,
                usage: body.usage,
            })
            if (body.views.length) applyView(body.views[0])
        } catch (error) {
            if (controller.signal.aborted) {
                setAi({ status: "idle" })
                setIsInputIngested(false)
            } else {
                console.error(error)
                setAi({
                    status: "error",
                    query,
                    message: "Something went wrong. Try again.",
                })
            }
        } finally {
            abortRef.current = null
        }
    }

    const selectView = (index: number): void => {
        if (ai.status !== "results" || ai.active === index) return
        setAi({ ...ai, active: index })
        applyView(ai.views[index])
    }

    const sendFeedback = (feedback: "up" | "down"): void => {
        if (ai.status !== "results") return
        setAi({ ...ai, feedback })
        void fetch("/api/configure-with-ai/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: ai.runId, feedback }),
        }).catch((error) => console.warn("Feedback not saved", error))
    }

    const changeModel = (id: ModelId): void => {
        setModel(id)
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, id)
        } catch {
            // The choice just isn't remembered
        }
    }

    const suggestions = SUGGESTIONS[slug] ?? []

    return (
        <section
            className="configure-with-ai"
            aria-labelledby="configure-with-ai-heading"
        >
            <h2
                className="configure-with-ai__heading"
                id="configure-with-ai-heading"
            >
                <FontAwesomeIcon icon={faWandMagicSparkles} />
                Configure with AI <em>(beta)</em>
            </h2>
            <form
                className="configure-with-ai__form"
                autoComplete="off"
                onSubmit={(e) => {
                    e.preventDefault()
                    void runQuery(input)
                }}
            >
                <FontAwesomeIcon
                    className="configure-with-ai__search-icon"
                    icon={faMagnifyingGlass}
                />
                <input
                    className={cx("configure-with-ai__input", {
                        "configure-with-ai__input--ingested": isInputIngested,
                    })}
                    type="search"
                    maxLength={MAX_QUERY_LENGTH}
                    placeholder="Find a view of this data…"
                    aria-label="Describe the view you want"
                    value={input}
                    disabled={ai.status === "thinking"}
                    onChange={(e) => {
                        setInput(e.target.value)
                        setIsInputIngested(false)
                    }}
                    onFocus={() => {
                        if (ai.status === "results" && isInputIngested) {
                            setInput("")
                            setIsInputIngested(false)
                        }
                    }}
                />
                {input.length >= 70 && (
                    <span className="configure-with-ai__char-count">
                        {input.length}/{MAX_QUERY_LENGTH}
                    </span>
                )}
            </form>

            <div className="configure-with-ai__body" aria-live="polite">
                {ai.status === "idle" && (
                    <>
                        {suggestions.length > 0 && (
                            <div className="configure-with-ai__try">
                                <p>Try…</p>
                                <ul>
                                    {suggestions.map((s) => (
                                        <li key={s}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    void runQuery(s)
                                                }}
                                            >
                                                {s}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <p className="configure-with-ai__explainer">
                            The AI assistant will find the most relevant views
                            of this data
                        </p>
                    </>
                )}
                {ai.status === "thinking" && (
                    <>
                        <div className="configure-with-ai__thinking">
                            <span>Finding views</span>
                            <span
                                className="configure-with-ai__thinking-bar"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="configure-with-ai__thinking-meta">
                            <span>{elapsed} s</span>
                            <button
                                className="configure-with-ai__link-button"
                                type="button"
                                onClick={() => abortRef.current?.abort()}
                            >
                                Stop
                            </button>
                        </div>
                    </>
                )}
                {ai.status === "error" && (
                    <p className="configure-with-ai__message configure-with-ai__message--error">
                        {ai.message}
                    </p>
                )}
                {ai.status === "results" && ai.views.length === 0 && (
                    <p className="configure-with-ai__message">
                        {ai.interpretation || "No matching views of this data."}
                    </p>
                )}
                {ai.status === "results" && ai.views.length > 0 && (
                    <ul className="configure-with-ai__views">
                        {ai.views.map((view, i) => {
                            const isOpen = i === ai.active
                            return (
                                <li
                                    key={i}
                                    className={cx("configure-with-ai__item", {
                                        "configure-with-ai__item--open": isOpen,
                                    })}
                                >
                                    <button
                                        className="configure-with-ai__view"
                                        type="button"
                                        aria-current={isOpen}
                                        title={view.label}
                                        onClick={() => selectView(i)}
                                    >
                                        <span aria-hidden="true">→</span>
                                        <span className="configure-with-ai__view-label">
                                            {view.label}
                                        </span>
                                    </button>
                                    {view.note && (
                                        <div
                                            className="configure-with-ai__note"
                                            aria-hidden={!isOpen}
                                        >
                                            <p>{view.note}</p>
                                        </div>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            <div className="configure-with-ai__footer">
                <span className="configure-with-ai__footer-left">
                    {ai.status === "results" && (
                        <>
                            <button
                                className="configure-with-ai__thumb"
                                type="button"
                                aria-pressed={ai.feedback === "up"}
                                aria-label="Useful"
                                onClick={() => sendFeedback("up")}
                            >
                                <FontAwesomeIcon icon={faThumbsUp} />
                            </button>
                            <button
                                className="configure-with-ai__thumb"
                                type="button"
                                aria-pressed={ai.feedback === "down"}
                                aria-label="Not useful"
                                onClick={() => sendFeedback("down")}
                            >
                                <FontAwesomeIcon icon={faThumbsDown} />
                            </button>
                            <span>
                                {ai.feedback
                                    ? "Thanks for the feedback"
                                    : "Is this tool useful for you?"}
                            </span>
                        </>
                    )}
                </span>
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
            {ai.status === "results" && (
                <p className="configure-with-ai__usage">
                    {(ai.usage.ms / 1000).toFixed(1)} s ·{" "}
                    {(
                        ai.usage.inputTokens +
                        ai.usage.cacheReadTokens +
                        ai.usage.cacheWriteTokens
                    ).toLocaleString()}{" "}
                    in ({ai.usage.cacheReadTokens.toLocaleString()} cached) ·{" "}
                    {ai.usage.outputTokens.toLocaleString()} out
                </p>
            )}
        </section>
    )
}
