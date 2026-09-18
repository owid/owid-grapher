/**
 * Minimal typings for the WebMCP browser API (`document.modelContext`).
 *
 * WebMCP is a W3C Web Machine Learning CG draft, shipped in Chrome behind an
 * origin trial (Chrome 149-156). There are no lib.dom typings for it yet, so we
 * declare the slice we use. See https://github.com/webmachinelearning/webmcp.
 *
 * Note the namespace moved from `navigator.modelContext` to
 * `document.modelContext` during the draft's life; if it moves again, this file
 * is the only place that needs to change.
 */

/**
 * What a tool hands back to the agent.
 *
 * Chrome's shipped examples return a bare string; the spec repo's examples
 * return MCP-style content blocks. We return strings and funnel every result
 * through `toolResult()` so switching costs one line.
 */
export type WebMcpToolResult = string

export interface WebMcpTool {
    name: string
    description: string
    inputSchema: {
        type: "object"
        properties: Record<string, unknown>
        required?: string[]
    }
    execute: (
        input: any,
        options?: { signal?: AbortSignal }
    ) => Promise<WebMcpToolResult>
}

export interface ModelContext {
    registerTool: (
        tool: WebMcpTool,
        options?: { signal?: AbortSignal }
    ) => Promise<void>
}

declare global {
    interface Document {
        modelContext?: ModelContext
    }
}

export const isWebMcpAvailable = (): boolean =>
    typeof document !== "undefined" && !!document.modelContext

export const toolResult = (text: string): WebMcpToolResult => text

/**
 * Register a batch of tools, ignoring failures.
 *
 * A tool that fails to register (schema rejected, API shape drifted) must not
 * take the page down with it — WebMCP is strictly additive to the UI.
 */
export async function registerTools(
    tools: WebMcpTool[],
    signal?: AbortSignal
): Promise<void> {
    const modelContext = document.modelContext
    if (!modelContext) return
    for (const tool of tools) {
        try {
            await modelContext.registerTool(tool, { signal })
        } catch (err) {
            console.warn(`WebMCP: failed to register tool "${tool.name}"`, err)
        }
    }
}
