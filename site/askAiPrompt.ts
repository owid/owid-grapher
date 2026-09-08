import type { AskAiArm, AskAiEngine } from "@ourworldindata/types"

/**
 * The prompt always points at the public site, never at the current
 * environment's baked URL. Staging runs on an internal Tailscale host and dev
 * on localhost — neither is reachable from Claude or ChatGPT, so an
 * environment-relative URL would hand the assistant a dead link and make the
 * probe untestable everywhere except production.
 */
export const OWID_PUBLIC_GRAPHER_URL = "https://ourworldindata.org/grapher"

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
/**
 * Params that describe what the visitor is looking at, and that the grapher's
 * .csv endpoint understands. Carrying them across means the assistant
 * reads the same slice of data the visitor has on screen.
 */
const STATE_PARAMS = ["country", "time", "tab", "region"]

/** `tab` selects a page view (chart/map/table); a CSV export has no such thing. */
const CSV_PARAMS = STATE_PARAMS.filter((p) => p !== "tab")

const stateQuery = (
    queryStr: string,
    keys: string[] = STATE_PARAMS
): string => {
    const from = new URLSearchParams(queryStr)
    const out = new URLSearchParams()
    for (const key of keys) {
        const value = from.get(key)
        if (value) out.set(key, value)
    }
    const s = out.toString()
    return s ? `&${s}` : ""
}

/**
 * Data URL for the visitor's current view. csvType=filtered returns only the
 * entities and years on screen — for a chart like child-mortality that is
 * ~1 KB rather than the 411 KB full export, which is the difference between
 * the assistant reading the data and truncating it. With no selection it
 * falls back to the chart's default entities, so it is always safe to send.
 */
export const buildCsvUrl = (slugUrl: string, queryStr: string): string =>
    `${slugUrl}.csv?csvType=filtered${stateQuery(queryStr, CSV_PARAMS)}`

/**
 * Every entity and year for the indicator, ignoring the visitor's selection.
 * Offered as a fallback for questions that reach beyond what's on screen —
 * it is two orders of magnitude larger than the filtered export (411 KB vs
 * ~1 KB for child-mortality), so the prompt steers towards the filtered one.
 */
export const buildFullCsvUrl = (slugUrl: string): string =>
    `${slugUrl}.csv?csvType=full`

/**
 * Ceiling on the encoded prompt.
 *
 * Chrome and Firefox tolerate tens of thousands of characters, and nginx's
 * default header buffer is 8 KB, so this is not a browser limit — it is a
 * margin against the assistant's own front end and any WAF in between. A
 * typical prompt lands near 1.8 KB and the longest realistic one (a long
 * slug, seven entities, a time range and a wordy question) near 2.2 KB, so
 * 3 KB clears normal use without degrading, while still catching the
 * pathological case of someone pasting an essay into the v3 box.
 *
 * A prompt clipped mid-URL is worse than one that dropped a line on purpose,
 * so past this ceiling we shed content deliberately: the full-CSV fallback
 * first, then the state summary (which restates what the URLs already
 * encode), and only then the visitor's own words.
 */
const MAX_ENCODED_PROMPT = 3000

const assemble = ({
    title,
    pageUrl,
    slugUrl,
    queryStr,
    stateSummary,
    question,
    includeFullCsv,
}: {
    title: string
    pageUrl: string
    slugUrl: string
    queryStr: string
    stateSummary?: string
    question: string
    includeFullCsv: boolean
}): string => {
    const lines = [
        `I'm looking at "${title}" on Our World in Data: ${pageUrl}`,
        "",
        "Please read these before answering:",
        `- ${buildCsvUrl(slugUrl, queryStr)} — the data for the view I'm looking at`,
    ]
    if (includeFullCsv)
        lines.push(
            `- ${buildFullCsvUrl(slugUrl)} — every country and year, if you need more than my selection (much larger — prefer the first)`
        )
    lines.push(
        `- ${slugUrl}.metadata.json — units, sources and Our World in Data's own notes on this indicator`,
        ""
    )
    if (stateSummary) lines.push(stateSummary, "")
    lines.push(
        `My question: ${question}`,
        "",
        "When you answer:",
        "- Answer directly and keep it short. No preamble, no restating my question, no background I didn't ask for.",
        "- Lead with the data. Put the relevant figures in a compact table, and draw a chart from them where it beats prose.",
        "- Use only the linked data and notes. If they don't support an answer, say what's missing rather than estimating.",
        "- Link other Our World in Data articles and charts where genuinely relevant — use the related research and charts listed on the page. Don't invent URLs: if you aren't sure a page exists, don't link it.",
        "",
        "Afterwards, ask whether I'd like Our World in Data available in my chats generally. If I say yes, point me to https://github.com/owid/skills"
    )
    return lines.join("\n")
}

export const buildPrompt = (args: {
    title: string
    pageUrl: string
    slugUrl: string
    queryStr: string
    stateSummary?: string
    question: string
}): string => {
    const encodedLength = (p: string) => encodeURIComponent(p).length

    const full = assemble({ ...args, includeFullCsv: true })
    if (encodedLength(full) <= MAX_ENCODED_PROMPT) return full

    // First to go: the full-CSV fallback. The filtered export answers the
    // question the visitor is actually looking at.
    const lean = assemble({ ...args, includeFullCsv: false })
    if (encodedLength(lean) <= MAX_ENCODED_PROMPT) return lean

    // Next: the state summary. It restates in prose what the URLs above
    // already encode, so it is the cheapest thing to lose.
    const bare = assemble({
        ...args,
        stateSummary: undefined,
        includeFullCsv: false,
    })
    if (encodedLength(bare) <= MAX_ENCODED_PROMPT) return bare

    // Only now is the visitor's own question the outsized part.
    // Trim it rather than let the URL be clipped at an arbitrary point.
    // Encoded length per character varies (a space costs 3, a letter 1), so
    // measure rather than assume a ratio.
    let lo = 0
    let hi = args.question.length
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2)
        const candidate = assemble({
            ...args,
            stateSummary: undefined,
            question: args.question.slice(0, mid).trimEnd() + "\u2026",
            includeFullCsv: false,
        })
        if (encodedLength(candidate) <= MAX_ENCODED_PROMPT) lo = mid
        else hi = mid - 1
    }
    return assemble({
        ...args,
        stateSummary: undefined,
        question: args.question.slice(0, lo).trimEnd() + "\u2026",
        includeFullCsv: false,
    })
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
