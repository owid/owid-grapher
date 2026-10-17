import { useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlask } from "@fortawesome/free-solid-svg-icons"
import type {
    AskAiArm,
    AskAiEngine,
    AskAiPromptSource,
} from "@ourworldindata/types"
import {
    ASK_AI_EXPERIMENT_ID,
    EXPERIMENT_PREFIX,
    getExperimentState,
} from "@ourworldindata/utils"
import {
    buildEngineUrl,
    buildPageUrl,
    buildPrompt,
    describeChartState,
    parseArm,
    parseArmOverride,
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
 * The visitor's arm from the experiment cookie, or undefined when they
 * aren't enrolled on this page. Cookies only exist on the client, so this
 * is read after hydration and must not decide what gets rendered — the body
 * class does that in CSS (see AskAI.scss).
 */
const useAssignedArm = (): AskAiArm | undefined => {
    const [arm, setArm] = useState<AskAiArm | undefined>()
    useEffect(() => {
        const state =
            getExperimentState()[`${EXPERIMENT_PREFIX}-${ASK_AI_EXPERIMENT_ID}`]
        if (state?.isPageInExperiment) {
            // oxlint-disable-next-line react/set-state-in-effect -- read client-only experiment cookies after hydration
            setArm(parseArm(state.arm))
        }
    }, [])
    return arm
}

export function AskAI({ slug, title }: AskAIProps) {
    // Empty on the server and during hydration, so a forced arm only
    // renders after it.
    const queryStr = useWindowQueryParams()
    const forcedArm = parseArmOverride(queryStr)
    const assignedArm = useAssignedArm()
    const arm = forcedArm ?? assignedArm

    const [question, setQuestion] = useState("")
    const [activePreset, setActivePreset] = useState<string | undefined>()
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const loggedShowFor = useRef<string | undefined>(undefined)

    // Exposure, for control too, so every arm has a denominator. Logged once
    // per arm so that toggling the param while testing doesn't inflate it.
    useEffect(() => {
        if (!arm) return
        const key = `${arm}:${slug}`
        if (loggedShowFor.current === key) return
        loggedShowFor.current = key
        analytics.logAskAiShow({ arm, slug })
    }, [arm, slug])

    const slugUrl = `${OWID_PUBLIC_GRAPHER_URL}/${slug}`
    const stateSummary = useMemo(() => describeChartState(queryStr), [queryStr])

    if (forcedArm === "control") return null

    // Without a forced arm, render every arm's markup and let the body class
    // pick (AskAI.scss); with one, render just that arm.
    const showPresets = !forcedArm || forcedArm === "v5"

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
        if (arm) analytics.logAskAiPresetClick({ arm, slug, presetId })
        inputRef.current?.focus()
    }

    const handleAsk = (engine: AskAiEngine) => {
        const prompt = buildPrompt({
            title,
            pageUrl: buildPageUrl(slugUrl, queryStr),
            slugUrl,
            queryStr,
            stateSummary,
            question: trimmed || DEFAULT_QUESTION,
        })

        if (arm) {
            analytics.logAskAiSubmit({
                arm,
                slug,
                engine,
                promptSource,
                presetId: promptSource === "preset" ? activePreset : undefined,
                question: trimmed || undefined,
            })
            // A beacon is queued by the browser and survives the tab
            // switch, so storing the question never delays the assistant.
            navigator.sendBeacon?.(
                ASK_AI_QUESTION_API_URL,
                JSON.stringify({
                    arm,
                    forced: !!forcedArm,
                    slug,
                    engine,
                    promptSource,
                    question: trimmed || undefined,
                    queryStr,
                })
            )
        }

        window.open(buildEngineUrl(engine, prompt), "_blank", "noopener")
    }

    return (
        <aside
            className={cx("ask-ai", { "ask-ai--forced": forcedArm })}
            data-arm={arm}
        >
            <div className="ask-ai__header">
                <h3 className="ask-ai__heading">Ask an AI about this chart</h3>
                <span
                    className="ask-ai__badge"
                    title="We're trying this out. It might change or go away."
                >
                    <FontAwesomeIcon icon={faFlask} aria-hidden="true" />
                    Experimental
                </span>
            </div>
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

            <label className="ask-ai__field">
                <span className="ask-ai__label">Your question</span>
                <textarea
                    ref={inputRef}
                    // Readers may type something personal, so keep it out
                    // of session replays (site/instrument.ts).
                    className="ask-ai__input sentry-mask"
                    rows={2}
                    value={question}
                    placeholder="What would you like to know about this data?"
                    onChange={(e) => {
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

            <p className="ask-ai__privacy">
                Your question is sent to the assistant you pick, and we record
                it so we can see what people want to ask.
            </p>
        </aside>
    )
}
