import { useLocalStorage } from "usehooks-ts"
import {
    AiSearchEvent,
    AiSearchSettings,
    DEFAULT_AI_SEARCH_SETTINGS,
    SearchResultType,
} from "@ourworldindata/types"
import { createLineSplitter } from "@ourworldindata/utils"
import { AI_SEARCH_API_URL } from "../../settings/clientSettings.mjs"

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
    countries,
    resultType,
    settings,
    signal,
    onEvent,
}: {
    query: string
    // The country filter and result type of standard search
    countries: string[]
    resultType: SearchResultType
    settings: AiSearchSettings
    signal: AbortSignal
    onEvent: (event: AiSearchEvent) => void
}): Promise<void> {
    const params = new URLSearchParams({
        q: query,
        resultType,
        model: settings.model,
        debug: settings.debug ? "1" : "0",
    })
    if (countries.length) params.set("countries", countries.join("~"))
    const response = await fetch(`${AI_SEARCH_API_URL}?${params}`, { signal })
    if (!response.ok || !response.body) {
        onEvent({
            type: "error",
            code: response.status === 404 ? "unavailable" : "failed",
        })
        return
    }

    // The stream ends with a done or error event, unless the function was
    // cut off (e.g. by a Workers limit)
    let hasEnded = false
    const splitter = createLineSplitter((line) => {
        if (!line.trim()) return
        let event: AiSearchEvent
        try {
            event = JSON.parse(line)
        } catch {
            // A malformed line is skipped, the rest of the page still renders
            return
        }
        if (event.type === "done" || event.type === "error") hasEnded = true
        onEvent(event)
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
    if (!hasEnded) onEvent({ type: "error", code: "failed" })
}
