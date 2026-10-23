import { useLocalStorage } from "usehooks-ts"
import {
    AiSearchEvent,
    AiSearchSettings,
    DEFAULT_AI_SEARCH_SETTINGS,
} from "@ourworldindata/types"

const AI_SEARCH_API_URL = "/api/ai-search"

/** The prototype settings plus the ones that only affect the page. */
export interface AiSearchPageSettings extends AiSearchSettings {
    cache: boolean
    teaser: boolean
}

export const DEFAULT_AI_SEARCH_PAGE_SETTINGS: AiSearchPageSettings = {
    ...DEFAULT_AI_SEARCH_SETTINGS,
    cache: true,
    teaser: true,
}

export function useAiSearchSettings(): [
    AiSearchPageSettings,
    (update: Partial<AiSearchPageSettings>) => void,
] {
    const [stored, setStored] = useLocalStorage<Partial<AiSearchPageSettings>>(
        "owid-ai-search-settings",
        {}
    )
    const settings = { ...DEFAULT_AI_SEARCH_PAGE_SETTINGS, ...stored }
    return [settings, (update) => setStored({ ...stored, ...update })]
}

const CACHE_TTL_MS = 5 * 60 * 1000
const answerCache = new Map<string, { at: number; events: AiSearchEvent[] }>()

export function buildAiSearchUrl(
    query: string,
    settings: AiSearchSettings
): string {
    const params = new URLSearchParams({
        q: query,
        model: settings.model,
        effort: settings.effort,
        expand: settings.expand ? "1" : "0",
        pool: String(settings.pool),
        debug: settings.debug ? "1" : "0",
    })
    return `${AI_SEARCH_API_URL}?${params}`
}

/**
 * Streams the events of an AI search to `onEvent` as they arrive. With
 * `useCache`, a finished answer to the same search with the same settings
 * from the last five minutes is replayed instead.
 */
export async function streamAiSearch({
    query,
    settings,
    useCache,
    signal,
    onEvent,
}: {
    query: string
    settings: AiSearchSettings
    useCache: boolean
    signal: AbortSignal
    onEvent: (event: AiSearchEvent) => void
}): Promise<void> {
    const url = buildAiSearchUrl(query, settings)
    const cached = answerCache.get(url)
    if (useCache && cached && Date.now() - cached.at < CACHE_TTL_MS) {
        cached.events.forEach(onEvent)
        return
    }

    const response = await fetch(url, { signal })
    if (!response.ok || !response.body) {
        onEvent({
            type: "error",
            code: response.status === 404 ? "unavailable" : "failed",
            message:
                response.status === 404
                    ? "AI search isn't available on this server."
                    : "Something went wrong while grouping the results. Try again.",
        })
        return
    }

    const events: AiSearchEvent[] = []
    const handleLine = (line: string): void => {
        if (!line.trim()) return
        let event: AiSearchEvent
        try {
            event = JSON.parse(line)
        } catch {
            return
        }
        events.push(event)
        onEvent(event)
    }

    const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()
    let buffer = ""
    while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const lines = (buffer + value).split("\n")
        buffer = lines.pop() ?? ""
        lines.forEach(handleLine)
    }
    handleLine(buffer)

    if (events.some((event) => event.type === "done"))
        answerCache.set(url, { at: Date.now(), events })
}
