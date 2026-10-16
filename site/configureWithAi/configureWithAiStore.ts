import { CONFIGURE_WITH_AI_API_URL } from "../../settings/clientSettings.mjs"
import type { ConfigureWithAiView } from "./configureWithAiView.js"

// State of the "Configure with AI" side panel. Grapher unmounts the panel on
// every resize between panel and modal, so the state lives here, one store
// per chart, rather than in the components.

export interface Usage {
    model: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    contextMs: number
    ms: number
}

/** What a page has to provide so the panel can read and change its chart */
export interface ChartAdapter {
    slug: string
    /** The current view as a query string: Grapher's params plus MDim choices */
    getQueryStr: () => string
    applyView: (view: ConfigureWithAiView) => void
    /** Restores the chart as it was when the panel was installed */
    restoreStart: () => void
}

export type PanelTab = "customize" | "ai"

export interface HistoryEntry {
    id: number
    query: string
    interpretation: string
    views: ConfigureWithAiView[]
    active: number
    runId: string
    usage: Usage
    feedback?: "up" | "down"
}

export type Request =
    | { status: "idle" }
    | { status: "thinking"; query: string; started: number }
    | { status: "error"; query: string; message: string }
    /** The model answered but had no view of this chart to offer */
    | { status: "empty"; query: string; interpretation: string }

export interface PanelState {
    tab: PanelTab
    request: Request
    /** Newest first */
    history: HistoryEntry[]
    /** The entry on the chart; null when it shows the chart as opened */
    currentId: number | null
    /** Set while an MDim page loads another view; history and views wait for it */
    isBusy: boolean
}

const MAX_HISTORY = 10

const errorMessage = (error: unknown): string =>
    error === "invalid_json"
        ? "The answer couldn't be read as a set of views."
        : error === "refused"
          ? "The model declined this request."
          : "Something went wrong."

export class PanelStore {
    private state: PanelState = {
        tab: "customize",
        request: { status: "idle" },
        history: [],
        currentId: null,
        isBusy: false,
    }
    private readonly listeners = new Set<() => void>()
    private abortController: AbortController | null = null
    private nextId = 1

    constructor(private adapter: ChartAdapter) {}

    setAdapter(adapter: ChartAdapter): void {
        this.adapter = adapter
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    getState = (): PanelState => this.state

    private update(patch: Partial<PanelState>): void {
        this.state = { ...this.state, ...patch }
        for (const listener of this.listeners) listener()
    }

    get slug(): string {
        return this.adapter.slug
    }

    get current(): HistoryEntry | undefined {
        return this.state.history.find((e) => e.id === this.state.currentId)
    }

    setTab(tab: PanelTab): void {
        this.update({ tab })
    }

    setBusy(isBusy: boolean): void {
        if (isBusy !== this.state.isBusy) this.update({ isBusy })
    }

    async ask(rawQuery: string, model: string): Promise<void> {
        const query = rawQuery.trim()
        if (!query || this.state.request.status === "thinking") return
        const controller = new AbortController()
        this.abortController = controller
        this.update({
            request: { status: "thinking", query, started: Date.now() },
        })
        try {
            const response = await fetch(CONFIGURE_WITH_AI_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    slug: this.adapter.slug,
                    query,
                    queryStr: this.adapter.getQueryStr(),
                    model,
                }),
                signal: controller.signal,
            })
            const body = await response.json()
            if (!response.ok) {
                this.update({
                    request: {
                        status: "error",
                        query,
                        message: errorMessage(body.error),
                    },
                })
                return
            }
            if (!body.views.length) {
                this.update({
                    request: {
                        status: "empty",
                        query,
                        interpretation: body.interpretation,
                    },
                })
                return
            }
            const entry: HistoryEntry = {
                id: this.nextId++,
                query,
                interpretation: body.interpretation,
                views: body.views,
                active: 0,
                runId: body.runId,
                usage: body.usage,
            }
            this.update({
                request: { status: "idle" },
                history: [entry, ...this.state.history].slice(0, MAX_HISTORY),
                currentId: entry.id,
            })
            this.adapter.applyView(entry.views[0])
        } catch (error) {
            if (controller.signal.aborted) {
                this.update({ request: { status: "idle" } })
            } else {
                console.error(error)
                this.update({
                    request: {
                        status: "error",
                        query,
                        message: errorMessage(undefined),
                    },
                })
            }
        } finally {
            if (this.abortController === controller) this.abortController = null
        }
    }

    stop(): void {
        this.abortController?.abort()
    }

    /** Shows another of the current answer's views; it replaces the entry's view rather than adding one */
    selectView(index: number): void {
        const entry = this.current
        if (!entry || this.state.isBusy) return
        this.replaceEntry({ ...entry, active: index })
        this.adapter.applyView(entry.views[index])
    }

    goBackTo(id: number | null): void {
        if (this.state.isBusy) return
        this.update({ currentId: id, request: { status: "idle" } })
        const entry = this.current
        if (entry) this.adapter.applyView(entry.views[entry.active])
        else this.adapter.restoreStart()
    }

    sendFeedback(feedback: "up" | "down"): void {
        const entry = this.current
        if (!entry) return
        this.replaceEntry({ ...entry, feedback })
        void fetch(`${CONFIGURE_WITH_AI_API_URL}/feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ runId: entry.runId, feedback }),
        }).catch((error) => console.warn("Feedback not saved", error))
    }

    private replaceEntry(entry: HistoryEntry): void {
        this.update({
            history: this.state.history.map((e) =>
                e.id === entry.id ? entry : e
            ),
        })
    }
}
