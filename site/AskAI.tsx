import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, Modal, ModalOverlay } from "react-aria-components"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlask, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import { CloseButton } from "@ourworldindata/components"
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

export interface AskAIModalProps {
    slug: string
    title: string
    isOpen: boolean
    onOpenChange: (isOpen: boolean) => void
}

/**
 * The modal behind the chart's "Ask AI" button. It hands the reader's
 * question, with links to this chart's data, to Claude or ChatGPT on their
 * own sites.
 */
export function AskAIModal({
    slug,
    title,
    isOpen,
    onOpenChange,
}: AskAIModalProps) {
    return (
        <ModalOverlay
            className="ask-ai-overlay"
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            isDismissable
        >
            <Modal className="ask-ai-modal">
                <Dialog
                    aria-label="Ask an AI about this chart"
                    className="ask-ai"
                >
                    {({ close }) => (
                        <AskAIForm slug={slug} title={title} close={close} />
                    )}
                </Dialog>
            </Modal>
        </ModalOverlay>
    )
}

function AskAIForm({
    slug,
    title,
    close,
}: {
    slug: string
    title: string
    close: () => void
}) {
    const queryStr = useWindowQueryParams()

    const [question, setQuestion] = useState("")
    const [activePreset, setActivePreset] = useState<string | undefined>()
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Mounts each time the modal opens, so this counts openings.
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
        <>
            <div className="ask-ai__header">
                <h2 className="ask-ai__heading">Ask an AI about this chart</h2>
                <span
                    className="ask-ai__badge"
                    title="We're trying this out. It might change or go away."
                >
                    <FontAwesomeIcon icon={faFlask} aria-hidden="true" />
                    Experimental
                </span>
                <CloseButton
                    className="ask-ai__close"
                    onClick={() => close()}
                />
            </div>

            {viewSummary && (
                <p className="ask-ai__view">
                    <FontAwesomeIcon
                        icon={faWandMagicSparkles}
                        aria-hidden="true"
                    />
                    Your view: {viewSummary}
                </p>
            )}

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

            <label className="ask-ai__field">
                <span className="sr-only">Your question</span>
                <textarea
                    ref={inputRef}
                    // Readers may type something personal, so keep it out of
                    // session replays (site/instrument.ts).
                    className="ask-ai__input sentry-mask"
                    rows={3}
                    value={question}
                    placeholder="What would you like to know about this data?"
                    autoFocus
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

            <p className="ask-ai__note">
                Opens the assistant you pick, on its own site, with this chart's
                data. We record your question to learn what people want to ask.
            </p>
        </>
    )
}
