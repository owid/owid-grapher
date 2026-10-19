import { type RefObject, useEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faEyeSlash,
    faFlask,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons"
import { CookieKey } from "@ourworldindata/grapher"
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
    describeViewCompact,
    parseArm,
    parseArmOverride,
    ASK_AI_ARMS,
    ASK_AI_PARAM,
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

/**
 * Whether the visitor has been to the admin. A hint for showing staff tools,
 * not access control. Read after hydration, like the experiment cookie.
 */
const useIsStaff = (): boolean => {
    const [isStaff, setIsStaff] = useState(false)
    useEffect(() => {
        try {
            // oxlint-disable-next-line react/set-state-in-effect -- read client-only cookies after hydration
            setIsStaff(document.cookie.includes(CookieKey.isAdmin))
        } catch {
            // Cookies may be unavailable in a sandboxed iframe.
        }
    }, [])
    return isStaff
}

function StaffArmSwitcher({
    assignedArm,
    activeArm,
    onChoose,
}: {
    assignedArm: AskAiArm | undefined
    activeArm: AskAiArm | undefined
    onChoose: (arm: AskAiArm) => void
}) {
    return (
        <div className="ask-ai-staff">
            <span className="ask-ai-staff__label">
                <FontAwesomeIcon icon={faEyeSlash} aria-hidden="true" />
                Only visible to OWID staff · Ask-AI arm
                {assignedArm ? ` (you're assigned ${assignedArm})` : ""}:
            </span>
            <div className="ask-ai-staff__arms" role="group">
                {ASK_AI_ARMS.map((arm) => (
                    <button
                        key={arm}
                        type="button"
                        className="ask-ai-staff__arm"
                        aria-pressed={arm === activeArm}
                        onClick={() => onChoose(arm)}
                    >
                        {arm}
                    </button>
                ))}
            </div>
        </div>
    )
}

export function AskAI({ slug, title }: AskAIProps) {
    // Empty on the server and during hydration, so a forced arm only
    // renders after it.
    const queryStr = useWindowQueryParams()
    const isStaff = useIsStaff()
    // The switcher's choice wins over ?askai=, because the grapher rewrites
    // the URL from its own state and can restore a stale param.
    const [staffArm, setStaffArm] = useState<AskAiArm | undefined>()
    const forcedArm = staffArm ?? parseArmOverride(queryStr)
    const assignedArm = useAssignedArm()
    const arm = forcedArm ?? assignedArm

    const [question, setQuestion] = useState("")
    const [activePreset, setActivePreset] = useState<string | undefined>()
    // The bar arm opens up on first focus and stays open, so the layout
    // doesn't jump back while the reader reaches for a preset or a button.
    const [barExpanded, setBarExpanded] = useState(false)
    const blockInputRef = useRef<HTMLTextAreaElement>(null)
    const barInputRef = useRef<HTMLTextAreaElement>(null)
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
    const viewSummary = useMemo(() => describeViewCompact(queryStr), [queryStr])

    const chooseArm = (chosen: AskAiArm) => {
        setStaffArm(chosen)
        // Mirror it in the URL so the view can be shared.
        const url = new URL(window.location.href)
        url.searchParams.set(ASK_AI_PARAM, chosen)
        window.history.replaceState(window.history.state, "", url)
    }

    const switcher = isStaff ? (
        <StaffArmSwitcher
            assignedArm={assignedArm}
            activeArm={arm}
            onChoose={chooseArm}
        />
    ) : null

    if (forcedArm === "control") return switcher

    // Without a forced arm, render every arm's markup and let the body class
    // pick (AskAI.scss); with one, render just that arm.
    const showBlock = !forcedArm || forcedArm === "v3" || forcedArm === "v5"
    const showBar = !forcedArm || forcedArm === "bar"
    const showPresets = !forcedArm || forcedArm === "v5"

    const trimmed = question.trim()
    const promptSource: AskAiPromptSource = trimmed
        ? activePreset && PRESETS.some((p) => p.question === trimmed)
            ? "preset"
            : "freeform"
        : "default"

    const handlePreset = (
        presetId: string,
        inputRef: RefObject<HTMLTextAreaElement | null>
    ) => {
        const preset = PRESETS.find((p) => p.id === presetId)
        if (!preset) return
        setQuestion(preset.question)
        setActivePreset(presetId)
        if (arm) analytics.logAskAiPresetClick({ arm, slug, presetId })
        inputRef.current?.focus()
    }

    const handleTyping = (text: string) => {
        setQuestion(text)
        setActivePreset(undefined)
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

    const engineButtons = (className: string) =>
        ENGINES.map((engine) => (
            <button
                key={engine.id}
                type="button"
                className={className}
                onClick={() => handleAsk(engine.id)}
            >
                {engine.label}
            </button>
        ))

    return (
        <>
            {switcher}
            {showBlock && (
                <aside
                    className={cx("ask-ai", { "ask-ai--forced": forcedArm })}
                    data-arm={arm}
                >
                    <div className="ask-ai__header">
                        <h3 className="ask-ai__heading">
                            Ask an AI about this chart
                        </h3>
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
                    </div>
                    <p className="ask-ai__intro">
                        Open this chart's data in an AI assistant. We'll send it
                        a link to this page and its sources — the conversation
                        happens on their site, not ours.
                    </p>

                    {showPresets && (
                        <div className="ask-ai__presets">
                            {PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    className="ask-ai__preset"
                                    aria-pressed={activePreset === preset.id}
                                    onClick={() =>
                                        handlePreset(preset.id, blockInputRef)
                                    }
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <label className="ask-ai__field">
                        <span className="ask-ai__label">Your question</span>
                        <textarea
                            ref={blockInputRef}
                            // Readers may type something personal, so keep it
                            // out of session replays (site/instrument.ts).
                            className="ask-ai__input sentry-mask"
                            rows={2}
                            value={question}
                            placeholder="What would you like to know about this data?"
                            onChange={(e) => handleTyping(e.target.value)}
                        />
                    </label>

                    <div className="ask-ai__actions">
                        {engineButtons("ask-ai__button")}
                    </div>

                    <p className="ask-ai__privacy">
                        Your question is sent to the assistant you pick, and we
                        record it so we can see what people want to ask.
                    </p>
                </aside>
            )}
            {showBar && (
                <aside
                    className={cx("ask-ai-bar", {
                        "ask-ai-bar--forced": forcedArm,
                        "ask-ai-bar--expanded": barExpanded,
                    })}
                    data-arm={arm}
                >
                    <div className="ask-ai-bar__row">
                        <label className="ask-ai-bar__field">
                            <FontAwesomeIcon
                                icon={faWandMagicSparkles}
                                className="ask-ai-bar__icon"
                                aria-hidden="true"
                            />
                            <span className="sr-only">
                                Ask an AI about this chart
                            </span>
                            <textarea
                                ref={barInputRef}
                                // Kept out of session replays, as above.
                                className="ask-ai-bar__input sentry-mask"
                                rows={barExpanded ? 2 : 1}
                                value={question}
                                placeholder="Ask an AI about this chart…"
                                onFocus={() => setBarExpanded(true)}
                                onChange={(e) => {
                                    setBarExpanded(true)
                                    handleTyping(e.target.value)
                                }}
                            />
                        </label>
                        <div className="ask-ai-bar__actions">
                            {engineButtons("ask-ai__button ask-ai-bar__button")}
                        </div>
                    </div>
                    {barExpanded && (
                        <div className="ask-ai-bar__details">
                            <div className="ask-ai-bar__presets">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        className="ask-ai__preset"
                                        aria-pressed={
                                            activePreset === preset.id
                                        }
                                        onClick={() =>
                                            handlePreset(preset.id, barInputRef)
                                        }
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                            <p className="ask-ai-bar__note">
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
                                Opens the assistant you pick, on its own site,
                                with this chart's data
                                {viewSummary ? ` for ${viewSummary}` : ""}. We
                                record your question to learn what people want
                                to ask.
                            </p>
                        </div>
                    )}
                </aside>
            )}
        </>
    )
}
