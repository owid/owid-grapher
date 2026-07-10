import * as _ from "lodash-es"
import {
    EntityName,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
    MapRegionName,
    Time,
} from "@ourworldindata/types"
import {
    ASSISTANT_UNMATCHED_NOTE,
    AssistantBackend,
    AssistantChartContext,
    AssistantResponse,
    AssistantView,
    AssistantViewOption,
    describeView,
    makeViewOption,
    matchQueryToResponse,
    viewToQueryParams,
} from "./AssistantBackend"

/**
 * Prototype Claude-API backend for the "AI assistant (BETA)" panel.
 *
 * The browser calls the Anthropic Messages API directly (there is no server
 * in the static demo deployment), using an API key the user pasted into the
 * panel. The model is forced — via `tool_choice` — to answer through a single
 * tool whose input schema mirrors the assistant's action space, so it can
 * only ever propose structured chart views, never prose.
 *
 * Client-side validation is the no-prose firewall: entities are matched
 * case-insensitively against the chart's real entity list (anything else is
 * dropped), years are clamped to the available range, unknown tabs/regions
 * are dropped, and every rendered description is produced by the
 * deterministic `describeView` template. The only model-authored text that
 * can reach the DOM is the option-chip `headline`, which is sanitized
 * (single line, no URLs/markdown, ~70 chars). The model's `note` field is
 * used purely as a boolean "nothing matched" signal — its content is never
 * rendered.
 */

/** The Claude model to use; a constant so it's easy to change */
const CLAUDE_MODEL = "claude-sonnet-5"

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
const CLAUDE_MAX_TOKENS = 1500
const CLAUDE_TOOL_NAME = "propose_chart_views"

/** Canned notices — the only backend-status text the panel ever renders */
export const CLAUDE_INVALID_KEY_NOTICE = "Invalid or expired API key"
export const CLAUDE_FALLBACK_NOTICE = "Claude call failed — using demo matcher"

/** Thrown on 401/403 so the panel can re-open the key modal */
export class ClaudeInvalidKeyError extends Error {
    constructor() {
        super(CLAUDE_INVALID_KEY_NOTICE)
    }
}

/** Canned chip headline used when the model didn't provide a usable one */
const FALLBACK_OPTION_HEADLINE = "A related view of this chart"

const MAX_OPTION_VIEWS = 4
const MAX_FOLLOW_UP_VIEWS = 4

// -----------------------------------------------------------------------------
// API key storage (localStorage, so the connection survives a reload)
// -----------------------------------------------------------------------------

export const CLAUDE_API_KEY_STORAGE_KEY = "owid-assistant-claude-key"

export function readStoredClaudeApiKey(): string | undefined {
    try {
        return (
            window.localStorage.getItem(CLAUDE_API_KEY_STORAGE_KEY) ??
            undefined
        )
    } catch {
        return undefined
    }
}

export function storeClaudeApiKey(apiKey: string): void {
    try {
        window.localStorage.setItem(CLAUDE_API_KEY_STORAGE_KEY, apiKey)
    } catch {
        // Storage unavailable (e.g. privacy mode); the key just won't persist
    }
}

export function clearStoredClaudeApiKey(): void {
    try {
        window.localStorage.removeItem(CLAUDE_API_KEY_STORAGE_KEY)
    } catch {
        // Ignore, see above
    }
}

/**
 * Remembers (per browser session) that the user explicitly chose "Use demo
 * responses" in the key modal, so they aren't re-prompted on every query.
 * A fresh visit prompts again.
 */
export const CLAUDE_DEMO_CHOICE_SESSION_KEY = "owid-assistant-demo-responses"

export function readDemoModeChoice(): boolean {
    try {
        return (
            window.sessionStorage.getItem(CLAUDE_DEMO_CHOICE_SESSION_KEY) ===
            "true"
        )
    } catch {
        return false
    }
}

export function rememberDemoModeChoice(): void {
    try {
        window.sessionStorage.setItem(CLAUDE_DEMO_CHOICE_SESSION_KEY, "true")
    } catch {
        // Ignore; the user will just be prompted again
    }
}

// -----------------------------------------------------------------------------
// Request construction
// -----------------------------------------------------------------------------

/** The subset of the view shape the model is allowed to fill in */
const VIEW_INPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        tab: {
            type: "string",
            description: "One of the chart's available tabs",
        },
        entities: {
            type: "array",
            items: { type: "string" },
            description:
                "Entity names, copied EXACTLY from the available entity list",
        },
        startYear: { type: "integer" },
        endYear: { type: "integer" },
        region: {
            type: "string",
            enum: Object.values(MapRegionName),
            description: "Map zoom region; only meaningful on the WorldMap tab",
        },
        headline: {
            type: "string",
            description:
                "Short plain-text label (max 60 chars) for an option chip",
        },
    },
} as const

function buildClaudeTool(context: AssistantChartContext): unknown {
    return {
        name: CLAUDE_TOOL_NAME,
        description:
            "Respond with one or more concrete views of the current chart. " +
            'Use kind "apply" with exactly one view when the request maps to ' +
            'a single unambiguous view; use kind "options" with 2-4 views ' +
            "when it is ambiguous or nothing matches.",
        input_schema: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "views"],
            properties: {
                kind: { type: "string", enum: ["apply", "options"] },
                views: {
                    type: "array",
                    items: VIEW_INPUT_SCHEMA,
                    minItems: 1,
                    maxItems: MAX_OPTION_VIEWS,
                },
                followUps: {
                    type: "array",
                    items: VIEW_INPUT_SCHEMA,
                    maxItems: MAX_FOLLOW_UP_VIEWS,
                    description:
                        'With kind "apply" only: 2-4 sensible next views',
                },
                note: {
                    type: "string",
                    description:
                        "Set ONLY when the request could not be matched to " +
                        "any view of this chart",
                },
            },
        },
    }
}

function buildSystemPrompt(context: AssistantChartContext): string {
    const earliest = _.first(context.availableTimes)
    const latest = _.last(context.availableTimes)

    const lines: string[] = [
        "You map a user's natural-language request onto a concrete view of " +
            "ONE specific chart on Our World in Data. You cannot fetch other " +
            "data or answer questions — you can only reconfigure THIS chart " +
            `by calling the ${CLAUDE_TOOL_NAME} tool.`,
        "",
        "## The chart",
    ]
    if (context.chartTitle) lines.push(`Title: ${context.chartTitle}`)
    if (context.chartSubtitle) lines.push(`Subtitle: ${context.chartSubtitle}`)
    lines.push(
        `Available tabs (view types): ${context.availableTabs.join(", ")}`,
        earliest !== undefined && latest !== undefined
            ? `Years with data: ${earliest} to ${latest}`
            : "Years with data: none",
        `Current view: tab ${context.activeTab}` +
            (context.selectedEntityNames.length > 0
                ? `, selected entities: ${context.selectedEntityNames.join(", ")}`
                : ", no entities selected"),
        "",
        "## Available entities (the ONLY valid values for `entities`)",
        context.availableEntityNames.join("; "),
        "",
        "## Rules",
        "- Map the request to views of THIS chart only.",
        "- Never invent entity names: copy them EXACTLY from the list above. " +
            "If a requested place/entity is not in the list, omit it.",
        `- Never use years outside ${earliest}-${latest}.`,
        "- Only use tabs from the available tabs list.",
        "- `region` may only be set together with the WorldMap tab.",
        "- Keep `entities` short: at most 12 per view.",
        '- If the request maps to one clear view, use kind "apply" with ' +
            "exactly one view, plus 2-4 `followUps` for sensible next steps.",
        '- If the request is ambiguous, use kind "options" with 2-4 views, ' +
            "each with a short factual `headline`.",
        "- If the request does not map to any view of this chart (e.g. it " +
            "asks about a different topic, or only about places without " +
            'data), use kind "options" with 2-4 sensible default views AND ' +
            'set `note` to "no_match".',
        "- Headlines are plain text: no markdown, no URLs, max 60 characters.",
    )
    // The user query goes into the user message, not the system prompt; the
    // forced tool schema plus client-side validation keep the output space
    // safe regardless of what the query contains
    lines.push("", "The user's request is the next message.")
    return lines.join("\n")
}

// -----------------------------------------------------------------------------
// Validation: the no-prose firewall
// -----------------------------------------------------------------------------

function validateEntities(
    raw: unknown,
    context: AssistantChartContext
): EntityName[] {
    if (!Array.isArray(raw)) return []
    const canonicalByLowerCase = new Map(
        context.availableEntityNames.map((name) => [name.toLowerCase(), name])
    )
    const entityNames: EntityName[] = []
    for (const item of raw) {
        if (typeof item !== "string") continue
        const canonical = canonicalByLowerCase.get(item.trim().toLowerCase())
        if (canonical && !entityNames.includes(canonical))
            entityNames.push(canonical)
    }
    return entityNames
}

function validateTab(
    raw: unknown,
    context: AssistantChartContext
): GrapherTabName | undefined {
    if (typeof raw !== "string") return undefined
    const normalized = raw.replace(/[\s_-]/g, "").toLowerCase()
    return context.availableTabs.find(
        (tab) => tab.toLowerCase() === normalized
    )
}

function validateYear(
    raw: unknown,
    context: AssistantChartContext
): Time | undefined {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined
    const earliest = _.first(context.availableTimes)
    const latest = _.last(context.availableTimes)
    if (earliest === undefined || latest === undefined) return undefined
    return _.clamp(Math.round(raw), earliest, latest)
}

function validateMapRegion(raw: unknown): MapRegionName | undefined {
    if (typeof raw !== "string") return undefined
    const normalized = raw.replace(/[\s_-]/g, "").toLowerCase()
    return Object.values(MapRegionName).find(
        (region) => region.toLowerCase() === normalized
    )
}

/**
 * Sanitizes a model-provided chip headline: single line, no URLs or markdown
 * markup, capped at ~70 characters. Returns undefined if nothing safe is left.
 */
export function sanitizeHeadline(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined
    let headline = raw.replace(/\s+/g, " ").trim()
    if (!headline) return undefined
    // Rather than trying to strip URLs, refuse headlines containing them
    if (/https?:\/\/|www\./i.test(headline)) return undefined
    // Strip markdown-ish markup characters
    headline = headline
        .replace(/[*_`#~<>[\]{}|\\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    if (!headline) return undefined
    if (headline.length > 70) headline = `${headline.slice(0, 69).trimEnd()}…`
    return headline
}

interface ValidatedView {
    view: AssistantView
    headline?: string
}

/**
 * Validates one raw model view against the chart context. Returns undefined
 * if nothing valid is left after dropping invalid parts.
 */
function validateView(
    raw: unknown,
    context: AssistantChartContext
): ValidatedView | undefined {
    if (typeof raw !== "object" || raw === null) return undefined
    const input = raw as Record<string, unknown>

    const tab = validateTab(input.tab, context)
    const entityNames = validateEntities(input.entities, context)
    let startTime = validateYear(input.startYear, context)
    let endTime = validateYear(input.endYear, context)
    if (startTime !== undefined && endTime !== undefined && startTime > endTime)
        [startTime, endTime] = [endTime, startTime]

    // A map zoom region only makes sense on the map tab
    const effectiveTab = tab ?? context.activeTab
    const mapRegion =
        effectiveTab === GRAPHER_TAB_NAMES.WorldMap
            ? validateMapRegion(input.region)
            : undefined

    const view: AssistantView = {
        tab,
        entityNames: entityNames.length > 0 ? entityNames : undefined,
        startTime,
        endTime,
        mapRegion,
    }

    // A view with nothing valid left is discarded
    const isEmpty =
        view.tab === undefined &&
        view.entityNames === undefined &&
        view.startTime === undefined &&
        view.endTime === undefined &&
        view.mapRegion === undefined
    if (isEmpty) return undefined

    return { view, headline: sanitizeHeadline(input.headline) }
}

function validateViews(
    raw: unknown,
    context: AssistantChartContext,
    maxCount: number
): ValidatedView[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((item) => validateView(item, context))
        .filter((item): item is ValidatedView => item !== undefined)
        .slice(0, maxCount)
}

function toViewOption(
    { view, headline }: ValidatedView,
    context: AssistantChartContext
): AssistantViewOption {
    return makeViewOption(view, headline ?? FALLBACK_OPTION_HEADLINE, context)
}

/**
 * Turns the model's raw tool input into an AssistantResponse, or undefined if
 * no valid views survive validation (in which case the caller falls back to
 * the mock matcher).
 */
export function claudeToolInputToResponse(
    rawInput: unknown,
    context: AssistantChartContext
): AssistantResponse | undefined {
    if (typeof rawInput !== "object" || rawInput === null) return undefined
    const input = rawInput as Record<string, unknown>

    const kind =
        input.kind === "apply" || input.kind === "options"
            ? input.kind
            : undefined
    if (!kind) return undefined

    const views = validateViews(input.views, context, MAX_OPTION_VIEWS)
    if (views.length === 0) return undefined

    // The note's content is never rendered; it is only a boolean
    // "nothing matched" signal that selects the canned fallback line
    const hasNoMatchNote =
        typeof input.note === "string" && input.note.trim().length > 0

    if (kind === "apply") {
        const { view } = views[0]
        const followUps = validateViews(
            input.followUps,
            context,
            MAX_FOLLOW_UP_VIEWS
        ).map((validated) => toViewOption(validated, context))
        return {
            kind: "apply",
            view,
            params: viewToQueryParams(view, context),
            description: describeView(view, context),
            followUps: followUps.length > 0 ? followUps : undefined,
        }
    }

    const options = _.uniqBy(
        views.map((validated) => toViewOption(validated, context)),
        (option) => option.description
    )
    return {
        kind: "options",
        options,
        note: hasNoMatchNote ? ASSISTANT_UNMATCHED_NOTE : undefined,
    }
}

// -----------------------------------------------------------------------------
// The backend
// -----------------------------------------------------------------------------

class ClaudeCallError extends Error {}

export class ClaudeAssistantBackend implements AssistantBackend {
    constructor(private apiKey: string) {}

    /**
     * Responds to a query via the Claude API. Throws `ClaudeInvalidKeyError`
     * on 401/403 (so the panel can re-open the key modal); any other failure
     * falls back to the deterministic demo matcher.
     */
    async respond(
        query: string,
        context: AssistantChartContext
    ): Promise<AssistantResponse> {
        let toolInput: unknown
        try {
            toolInput = await this.callClaude(query, context)
        } catch (error) {
            if (error instanceof ClaudeInvalidKeyError) throw error
            // Network/server errors: fall back to the demo matcher, with a
            // terse canned notice (never raw error text)
            return {
                ...matchQueryToResponse(query, context),
                notice: CLAUDE_FALLBACK_NOTICE,
            }
        }

        const response = claudeToolInputToResponse(toolInput, context)
        if (response) return response

        // The model responded, but nothing survived validation: fall back to
        // the deterministic mock matcher for this query
        return matchQueryToResponse(query, context)
    }

    /** Calls the Messages API and returns the forced tool call's input */
    private async callClaude(
        query: string,
        context: AssistantChartContext
    ): Promise<unknown> {
        let response: Response
        try {
            response = await fetch(CLAUDE_API_URL, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-api-key": this.apiKey,
                    "anthropic-version": "2023-06-01",
                    // Required for browser-direct calls (no server in the
                    // static demo deployment)
                    "anthropic-dangerous-direct-browser-access": "true",
                },
                body: JSON.stringify({
                    model: CLAUDE_MODEL,
                    max_tokens: CLAUDE_MAX_TOKENS,
                    // Forced tool_choice requires thinking off (and the model
                    // defaults to adaptive thinking when the field is omitted)
                    thinking: { type: "disabled" },
                    system: buildSystemPrompt(context),
                    messages: [{ role: "user", content: query }],
                    tools: [buildClaudeTool(context)],
                    tool_choice: { type: "tool", name: CLAUDE_TOOL_NAME },
                }),
            })
        } catch {
            throw new ClaudeCallError("network error")
        }

        if (response.status === 401 || response.status === 403)
            throw new ClaudeInvalidKeyError()
        // Never surface raw response bodies; only the status class matters
        if (!response.ok) throw new ClaudeCallError(`status ${response.status}`)

        let json: unknown
        try {
            json = await response.json()
        } catch {
            throw new ClaudeCallError("invalid JSON")
        }

        const content = (json as { content?: unknown })?.content
        if (!Array.isArray(content)) throw new ClaudeCallError("no content")
        const toolUse = content.find(
            (block): block is { type: string; name: string; input: unknown } =>
                typeof block === "object" &&
                block !== null &&
                (block as { type?: unknown }).type === "tool_use" &&
                (block as { name?: unknown }).name === CLAUDE_TOOL_NAME
        )
        if (!toolUse) throw new ClaudeCallError("no tool_use block")
        return toolUse.input
    }
}
