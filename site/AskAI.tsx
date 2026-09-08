import { useEffect, useMemo, useRef, useState } from "react"
import type { AskAiEngine, AskAiPromptSource } from "@ourworldindata/types"
import {
    buildEngineUrl,
    buildPrompt,
    describeChartState,
    parseArm,
    DEFAULT_QUESTION,
    ENGINES,
    PRESETS,
} from "./askAiPrompt.js"
import { useWindowQueryParams } from "./hooks.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

export interface AskAIProps {
    slug: string
    title: string
    /** Baked grapher URL, e.g. https://ourworldindata.org/grapher */
    baseUrl: string
}

export function AskAI({ slug, title, baseUrl }: AskAIProps) {
    const queryStr = useWindowQueryParams()
    const arm = parseArm(queryStr)

    const [question, setQuestion] = useState("")
    const [activePreset, setActivePreset] = useState<string | undefined>()
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const loggedShowFor = useRef<string | undefined>(undefined)

    // Exposure. Logged once per arm so that toggling the param while testing
    // doesn't inflate the denominator.
    useEffect(() => {
        if (!arm) return
        const key = `${arm}:${slug}`
        if (loggedShowFor.current === key) return
        loggedShowFor.current = key
        analytics.logAskAiShow({ arm, slug })
    }, [arm, slug])

    const slugUrl = `${baseUrl}/${slug}`
    const stateSummary = useMemo(() => describeChartState(queryStr), [queryStr])

    if (!arm) return null

    const showInput = arm === "v3" || arm === "v5"
    const showPresets = arm === "v5"

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
        analytics.logAskAiPresetClick({ arm, slug, presetId })
        inputRef.current?.focus()
    }

    const handleAsk = (engine: AskAiEngine) => {
        const pageUrl = queryStr ? `${slugUrl}${queryStr}` : slugUrl
        const prompt = buildPrompt({
            title,
            pageUrl,
            slugUrl,
            queryStr,
            stateSummary,
            question: trimmed || DEFAULT_QUESTION,
        })

        analytics.logAskAiSubmit({
            arm,
            slug,
            engine,
            promptSource,
            presetId: promptSource === "preset" ? activePreset : undefined,
            question: trimmed || undefined,
        })

        window.open(buildEngineUrl(engine, prompt), "_blank", "noopener")
    }

    return (
        <aside className="ask-ai" data-arm={arm}>
            <h3 className="ask-ai__heading">Ask an AI about this chart</h3>
            <p className="ask-ai__intro">
                Open this chart's data in an AI assistant. We'll send it a link
                to this page and its sources — the conversation happens on their
                site, not ours.
            </p>

            {showPresets && (
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
            )}

            {showInput && (
                <label className="ask-ai__field">
                    <span className="ask-ai__label">Your question</span>
                    <textarea
                        ref={inputRef}
                        className="ask-ai__input"
                        rows={2}
                        value={question}
                        placeholder="What would you like to know about this data?"
                        onChange={(e) => {
                            setQuestion(e.target.value)
                            setActivePreset(undefined)
                        }}
                    />
                </label>
            )}

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

            {showInput && (
                <p className="ask-ai__privacy">
                    Your question is sent to the assistant you pick, and we
                    record it so we can see what people want to ask.
                </p>
            )}
        </aside>
    )
}
