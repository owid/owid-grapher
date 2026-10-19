import { useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlask, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import type { AskAiEngine, AskAiPromptSource } from "@ourworldindata/types"
import {
    buildEngineUrl,
    buildPrompt,
    describeChartState,
    describeViewCompact,
    DEFAULT_QUESTION,
    ENGINES,
    PRESETS,
    OWID_PUBLIC_GRAPHER_URL,
} from "./askAiPrompt.js"
import { useWindowQueryParams } from "./hooks.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

/** Pages Function that stores each submit in R2 (functions/api/ask-ai-question). */
const ASK_AI_QUESTION_API_URL = "/api/ask-ai-question"

export interface AskAIProps {
    slug: string
    title: string
}

/**
 * A one-line "ask an AI" bar under the chart. It opens up with presets and a
 * note on what gets sent once the reader focuses it, and hands the question,
 * with links to this chart's data, to Claude or ChatGPT on their own sites.
 */
export function AskAI({ slug, title }: AskAIProps) {
    // Empty on the server and during hydration, so the markup matches.
    const queryStr = useWindowQueryParams()

    const [question, setQuestion] = useState("")
    const [activePreset, setActivePreset] = useState<string | undefined>()
    // Opens on first focus and stays open, so the layout doesn't jump back
    // while the reader reaches for a preset or a button.
    const [expanded, setExpanded] = useState(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        analytics.logAskAiShow({ slug })
    }, [slug])

    const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/${slug}`
    const stateSummary = useMemo(() => describeChartState(queryStr), [queryStr])
    const viewSummary = useMemo(() => describeViewCompact(queryStr), [queryStr])

    const trimmed = question.trim()
    const promptSource: AskAiPromptSource = trimmed
        ? activePreset && PRESETS.some((p) => p.question === trimmed)
            ? "preset"
            : "freeform"
        : "default"

    const handlePreset = (presetId: string) => {
        const preset = PRESETS.find((p) => p.id === presetId)
        if (!preset) return
        setQuestion(preset.question)
        setActivePreset(presetId)
        analytics.logAskAiPresetClick({ slug, presetId })
        inputRef.current?.focus()
    }

    const handleAsk = (engine: AskAiEngine) => {
        const prompt = buildPrompt({
            title,
            pageUrl: `${slugUrl}${queryStr}`,
            slugUrl,
            queryStr,
            stateSummary,
            question: trimmed || DEFAULT_QUESTION,
        })

        analytics.logAskAiSubmit({
            slug,
            engine,
            promptSource,
            presetId: promptSource === "preset" ? activePreset : undefined,
            question: trimmed || undefined,
        })
        // A beacon is queued by the browser and survives the tab switch, so
        // storing the question never delays the assistant.
        navigator.sendBeacon?.(
            ASK_AI_QUESTION_API_URL,
            JSON.stringify({
                slug,
                engine,
                promptSource,
                question: trimmed || undefined,
                queryStr,
            })
        )

        window.open(buildEngineUrl(engine, prompt), "_blank", "noopener")
    }

    return (
        <aside className={cx("ask-ai", { "ask-ai--expanded": expanded })}>
            <div className="ask-ai__row">
                <label className="ask-ai__field">
                    <FontAwesomeIcon
                        icon={faWandMagicSparkles}
                        className="ask-ai__icon"
                        aria-hidden="true"
                    />
                    <span className="sr-only">Ask an AI about this chart</span>
                    <textarea
                        ref={inputRef}
                        // Readers may type something personal, so keep it out
                        // of session replays (site/instrument.ts).
                        className="ask-ai__input sentry-mask"
                        rows={expanded ? 2 : 1}
                        value={question}
                        placeholder="Ask an AI about this chart…"
                        onFocus={() => setExpanded(true)}
                        onChange={(e) => {
                            setExpanded(true)
                            setQuestion(e.target.value)
                            setActivePreset(undefined)
                        }}
                    />
                </label>
                <div className="ask-ai__actions">
                    {ENGINES.map((engine) => (
                        <button
                            key={engine.id}
                            type="button"
                            className="ask-ai__button"
                            onClick={() => handleAsk(engine.id)}
                        >
                            {engine.label}
                        </button>
                    ))}
                </div>
            </div>
            {expanded && (
                <div className="ask-ai__details">
                    <div className="ask-ai__presets">
                        {PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                className="ask-ai__preset"
                                aria-pressed={activePreset === preset.id}
                                onClick={() => handlePreset(preset.id)}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <p className="ask-ai__note">
                        <span
                            className="ask-ai__badge"
                            title="We're trying this out. It might change or go away."
                        >
                            <FontAwesomeIcon
                                icon={faFlask}
                                aria-hidden="true"
                            />
                            Experimental
                        </span>
                        Opens the assistant you pick, on its own site, with this
                        chart's data
                        {viewSummary ? ` for ${viewSummary}` : ""}. We record
                        your question to learn what people want to ask.
                    </p>
                </div>
            )}
        </aside>
    )
}
