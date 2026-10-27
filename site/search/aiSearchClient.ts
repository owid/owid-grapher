import { useLocalStorage } from "usehooks-ts"
import {
    AiSearchEvent,
    AiSearchSettings,
    DEFAULT_AI_SEARCH_SETTINGS,
} from "@ourworldindata/types"
import { createLineSplitter } from "@ourworldindata/utils"

const AI_SEARCH_API_URL = "/api/ai-search"

export function useAiSearchSettings(): [
    AiSearchSettings,
    (update: Partial<AiSearchSettings>) => void,
] {
    const [stored, setStored] = useLocalStorage<Partial<AiSearchSettings>>(
        "owid-ai-search-settings",
        {}
    )
    const settings = { ...DEFAULT_AI_SEARCH_SETTINGS, ...stored }
    return [settings, (update) => setStored({ ...stored, ...update })]
}

/** Streams the events of an AI search to `onEvent` as they arrive */
export async function streamAiSearch({
    query,
    settings,
    signal,
    onEvent,
}: {
    query: string
    settings: AiSearchSettings
    signal: AbortSignal
    onEvent: (event: AiSearchEvent) => void
}): Promise<void> {
    const params = new URLSearchParams({
        q: query,
        model: settings.model,
        debug: settings.debug ? "1" : "0",
    })
    const response = await fetch(`${AI_SEARCH_API_URL}?${params}`, { signal })
    if (!response.ok || !response.body) {
        onEvent({
            type: "error",
            code: response.status === 404 ? "unavailable" : "failed",
        })
        return
    }

    const splitter = createLineSplitter((line) => {
        if (!line.trim()) return
        try {
            onEvent(JSON.parse(line))
        } catch {
            // A malformed line is skipped, the rest of the page still renders
        }
    })
    const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()
    while (true) {
        const { value, done } = await reader.read()
        if (done) break
        splitter.push(value)
    }
    splitter.flush()
}
