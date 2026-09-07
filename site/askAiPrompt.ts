import type { AskAiArm, AskAiEngine } from "@ourworldindata/types"

/** Query param that turns the probe on: ?askai=v2 | v3 | v5 */
export const ASK_AI_PARAM = "askai"

const ARMS: AskAiArm[] = ["v2", "v3", "v5"]

export const parseArm = (queryStr: string): AskAiArm | undefined => {
    const value = new URLSearchParams(queryStr).get(ASK_AI_PARAM)
    return ARMS.find((arm) => arm === value)
}

export const ENGINES: { id: AskAiEngine; label: string }[] = [
    { id: "claude", label: "Ask Claude" },
    { id: "chatgpt", label: "Ask ChatGPT" },
]

/**
 * Deep links that open the assistant with the prompt pre-filled.
 *
 * NOTE: the ChatGPT `?q=` param is well established. The Claude one is not —
 * Anthropic only documents the desktop scheme (claude://claude.ai/new?q=...),
 * and the plain web param may no longer be honoured. Verify both by hand
 * before reading anything into the engine split.
 */
export const buildEngineUrl = (engine: AskAiEngine, prompt: string): string => {
    const q = encodeURIComponent(prompt)
    return engine === "chatgpt"
        ? `https://chatgpt.com/?q=${q}`
        : `https://claude.ai/new?q=${q}`
}

export const PRESETS: { id: string; label: string; question: string }[] = [
    {
        id: "explain",
        label: "Explain this chart",
        question:
            "Explain what this chart shows and how to read it, and point out two or three patterns worth noticing.",
    },
    {
        id: "change",
        label: "What's changed over time?",
        question:
            "Describe how this has changed over the period covered, with real figures and years for the biggest shifts.",
    },
    {
        id: "compare",
        label: "How do countries compare?",
        question:
            "Compare the countries I have selected for the most recent year available, and say which year you used.",
    },
]

export const DEFAULT_QUESTION =
    "Explain what this chart shows, how to read it, and any caveats I should know about the data."

/**
 * Wraps the visitor's question with everything the assistant needs to answer
 * from the data rather than from memory: the page, the machine-readable
 * metadata (units, sources, OWID's own notes), the raw CSV, and what the
 * visitor currently has on screen.
 */
export const buildPrompt = ({
    title,
    pageUrl,
    slugUrl,
    stateSummary,
    question,
}: {
    title: string
    pageUrl: string
    slugUrl: string
    stateSummary?: string
    question: string
}): string => {
    const lines = [
        `I'm looking at "${title}" on Our World in Data: ${pageUrl}`,
        "",
        "Please read these before answering:",
        `- ${slugUrl}.metadata.json — units, sources, timespan and Our World in Data's own notes on this indicator`,
        `- ${slugUrl}.csv — the full data`,
        "",
    ]
    if (stateSummary) lines.push(stateSummary, "")
    lines.push(
        `My question: ${question}`,
        "",
        "Answer from that data and those notes. If they don't support an answer, say what's missing rather than estimating."
    )
    return lines.join("\n")
}

/** Human-readable summary of what the visitor currently has on screen. */
export const describeChartState = (queryStr: string): string | undefined => {
    const params = new URLSearchParams(queryStr)
    const parts: string[] = []

    const country = params.get("country")
    if (country) {
        const entities = country
            .split("~")
            .map((c) => decodeURIComponent(c).trim())
            .filter(Boolean)
        if (entities.length)
            parts.push(`I have selected: ${entities.join(", ")}.`)
    }

    const time = params.get("time")
    if (time)
        parts.push(`I'm looking at the period ${time.replace("..", " to ")}.`)

    const tab = params.get("tab")
    if (tab) parts.push(`I'm on the "${tab}" view.`)

    return parts.length ? parts.join(" ") : undefined
}
