// The assistant's agent lifecycle, extracted from the UI: create a
// pi-agent-core Agent wired to a pi-web-ui ChatPanel, autosave the session
// after each turn, remember the last model/thinking level, and keep a
// per-document pointer to the most recent session. Adapted from the
// gdocs-chrome-extension side panel (same pi versions, same patterns).

import {
    Agent,
    type AgentMessage,
    type AgentTool,
    type ThinkingLevel,
} from "@earendil-works/pi-agent-core"
import {
    getModel,
    getModels,
    getProviders,
    type Model,
} from "@earendil-works/pi-ai"
import {
    ApiKeyPromptDialog,
    ChatPanel,
    defaultConvertToLlm,
    ModelSelector,
    type AgentState,
} from "@earendil-works/pi-web-ui"
import {
    assistantCustomProviders,
    assistantProviderKeys,
    assistantSessions,
    assistantSettings,
    initAssistantStorage,
} from "./storage.js"

interface LastUsedModel {
    provider: string
    modelId: string
}

const THINKING_LEVELS: readonly ThinkingLevel[] = [
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
]

function findModel(provider: string, modelId: string): Model<never> | undefined {
    if (!(getProviders() as string[]).includes(provider)) return undefined
    return (
        getModels(provider as Parameters<typeof getModels>[0]) as Model<never>[]
    ).find((m) => m.id === modelId)
}

async function defaultModel(): Promise<Model<never>> {
    const last = await assistantSettings.get<LastUsedModel>("lastUsedModel")
    if (last) {
        const model = findModel(last.provider, last.modelId)
        if (model) return model
    }
    return getModel("anthropic", "claude-sonnet-4-6") as Model<never>
}

async function defaultThinkingLevel(): Promise<ThinkingLevel> {
    const last = await assistantSettings.get<ThinkingLevel>("lastThinkingLevel")
    return last !== null && THINKING_LEVELS.includes(last) ? last : "medium"
}

function generateTitle(messages: AgentMessage[]): string {
    const firstUserMsg = messages.find((m) => m.role === "user")
    if (!firstUserMsg) return ""
    const content = (firstUserMsg as { content: unknown }).content
    let text = ""
    if (typeof content === "string") text = content
    else if (Array.isArray(content))
        text = content
            .filter(
                (c): c is { type: "text"; text: string } => c.type === "text"
            )
            .map((c) => c.text)
            .join(" ")
    text = text.trim()
    if (!text) return ""
    const sentenceEnd = text.search(/[.!?]/)
    if (sentenceEnd > 0 && sentenceEnd <= 50)
        return text.substring(0, sentenceEnd + 1)
    return text.length <= 50 ? text : `${text.substring(0, 47)}...`
}

function shouldSaveSession(messages: AgentMessage[]): boolean {
    return (
        messages.some((m) => m.role === "user") &&
        messages.some((m) => m.role === "assistant")
    )
}

const emptyUsage = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
}

export interface AssistantChatOptions {
    gdocId: string
    /** Used to label sessions in the (cross-document) history dialog */
    docTitle: string
    systemPrompt: string
    toolsFactory: () => AgentTool[]
    /** Called after state changes worth re-rendering around (session switch) */
    onSessionChanged?: () => void
}

const lastSessionKey = (gdocId: string): string => `lastSessionId:${gdocId}`

/**
 * Owns a ChatPanel element and its Agent. The React wrapper appends
 * `chatPanel.element` to the DOM and calls `start()`/`dispose()`.
 */
export class AssistantChat {
    readonly element: ChatPanel
    private readonly options: AssistantChatOptions
    private agent: Agent | null = null
    private agentUnsubscribe: (() => void) | undefined
    private currentSessionId: string | undefined
    private currentTitle = ""
    private disposed = false

    constructor(options: AssistantChatOptions) {
        initAssistantStorage()
        this.options = options
        this.element = new ChatPanel()
    }

    async start(): Promise<void> {
        // reopen the doc's most recent session, if any
        const lastId = await assistantSettings.get<string>(
            lastSessionKey(this.options.gdocId)
        )
        if (this.disposed) return
        if (lastId && (await this.loadSession(lastId))) return
        if (this.disposed) return
        await this.createAgent()
    }

    dispose(): void {
        this.disposed = true
        this.agentUnsubscribe?.()
        this.agentUnsubscribe = undefined
    }

    async newSession(): Promise<void> {
        this.currentSessionId = undefined
        this.currentTitle = ""
        await assistantSettings.delete(lastSessionKey(this.options.gdocId))
        await this.createAgent()
        this.options.onSessionChanged?.()
    }

    async loadSession(sessionId: string): Promise<boolean> {
        const sessionData = await assistantSessions.get(sessionId)
        if (!sessionData) return false
        this.currentSessionId = sessionId
        const metadata = await assistantSessions.getMetadata(sessionId)
        this.currentTitle = metadata?.title ?? ""
        await assistantSettings.set(
            lastSessionKey(this.options.gdocId),
            sessionId
        )
        await this.createAgent({
            model: sessionData.model,
            thinkingLevel: sessionData.thinkingLevel,
            messages: sessionData.messages,
            tools: [],
        })
        this.options.onSessionChanged?.()
        return true
    }

    private async createAgent(
        initialState?: Partial<AgentState>
    ): Promise<void> {
        this.agentUnsubscribe?.()

        const agent = new Agent({
            convertToLlm: defaultConvertToLlm,
            initialState: initialState
                ? { ...initialState, systemPrompt: this.options.systemPrompt }
                : {
                      systemPrompt: this.options.systemPrompt,
                      model: await defaultModel(),
                      thinkingLevel: await defaultThinkingLevel(),
                      messages: [],
                      tools: [],
                  },
        })
        if (this.disposed) return
        this.agent = agent

        this.agentUnsubscribe = agent.subscribe((event) => {
            const type = (event as { type: string }).type
            if (type !== "message_end" && type !== "agent_end") return
            // pi-agent-core flips isStreaming back to false only AFTER the
            // agent_end listeners settle, so AgentInterface's own repaint can
            // render stale state. Schedule one extra repaint on a macrotask.
            // (Workaround for pi-web-ui 0.75.3 + pi-agent-core 0.75.3.)
            setTimeout(() => {
                this.element
                    .querySelector<
                        HTMLElement & { requestUpdate?: () => void }
                    >("agent-interface")
                    ?.requestUpdate?.()
                const messages = agent.state.messages
                if (!this.currentTitle && shouldSaveSession(messages))
                    this.currentTitle = generateTitle(messages)
                if (shouldSaveSession(messages)) this.ensureSessionId()
                if (this.currentSessionId) void this.saveSession()
                void this.rememberModel()
                void this.rememberThinkingLevel()
            }, 0)
        })

        await this.element.setAgent(agent, {
            onApiKeyRequired: async (provider: string) =>
                await ApiKeyPromptDialog.prompt(provider),
            // Limit the model dropdown to providers with a stored API key,
            // plus custom providers; show everything when nothing is
            // configured yet so the dialog isn't a dead end.
            onModelSelect: async () => {
                const known = await assistantProviderKeys.list()
                const custom = (await assistantCustomProviders.getAll()).map(
                    (p) => p.name
                )
                const allowed = [...new Set([...known, ...custom])]
                ModelSelector.open(
                    agent.state.model,
                    (model) => {
                        agent.state.model = model
                    },
                    allowed.length ? allowed : undefined
                )
            },
            toolsFactory: () => this.options.toolsFactory(),
        })
    }

    private ensureSessionId(): string {
        if (!this.currentSessionId) {
            this.currentSessionId = crypto.randomUUID()
            void assistantSettings.set(
                lastSessionKey(this.options.gdocId),
                this.currentSessionId
            )
        }
        return this.currentSessionId
    }

    private async saveSession(): Promise<void> {
        const agent = this.agent
        if (!this.currentSessionId || !agent || !this.currentTitle) return
        const state = agent.state
        if (!shouldSaveSession(state.messages)) return
        try {
            const now = new Date().toISOString()
            const title = `${this.options.docTitle}: ${this.currentTitle}`
            await assistantSessions.save(
                {
                    id: this.currentSessionId,
                    title,
                    model: state.model!,
                    thinkingLevel: state.thinkingLevel,
                    messages: state.messages,
                    createdAt: now,
                    lastModified: now,
                },
                {
                    id: this.currentSessionId,
                    title,
                    createdAt: now,
                    lastModified: now,
                    messageCount: state.messages.length,
                    usage: { ...emptyUsage },
                    thinkingLevel: state.thinkingLevel,
                    preview: generateTitle(state.messages),
                }
            )
        } catch (err) {
            console.error("Failed to save assistant session:", err)
        }
    }

    private async rememberModel(): Promise<void> {
        const model = this.agent?.state.model
        if (!model) return
        const last: LastUsedModel = {
            provider: model.provider,
            modelId: model.id,
        }
        const prev = await assistantSettings.get<LastUsedModel>("lastUsedModel")
        if (prev?.provider !== last.provider || prev?.modelId !== last.modelId)
            await assistantSettings.set("lastUsedModel", last)
    }

    private async rememberThinkingLevel(): Promise<void> {
        const level = this.agent?.state.thinkingLevel
        if (level === undefined) return
        const prev =
            await assistantSettings.get<ThinkingLevel>("lastThinkingLevel")
        if (prev !== level)
            await assistantSettings.set("lastThinkingLevel", level)
    }
}
