// Tool-card renderers: pi-web-ui's DefaultRenderer titles every card "Tool
// Call"; this one shows the tool's label, a compact one-line input summary,
// and the plain-text output. Ported from the gdocs-chrome-extension.

import { html } from "lit"
import { FileText } from "lucide"
import type { AgentTool } from "@earendil-works/pi-agent-core"
import type { ToolResultMessage } from "@earendil-works/pi-ai"
import {
    registerToolRenderer,
    renderHeader,
    type ToolRenderer,
    type ToolRenderResult,
} from "@earendil-works/pi-web-ui"

/** One-line params summary, e.g. `action: "replace", from: "aB3xK9"`. */
function summarizeParams(params: unknown): string {
    let record: Record<string, unknown>
    try {
        record =
            typeof params === "string"
                ? JSON.parse(params)
                : (params as Record<string, unknown>)
    } catch {
        return String(params)
    }
    if (!record || typeof record !== "object") return ""
    return Object.entries(record)
        .map(([key, value]) => {
            let text =
                typeof value === "string"
                    ? JSON.stringify(value)
                    : (JSON.stringify(value) ?? String(value))
            if (text.length > 60) text = text.slice(0, 57) + "..."
            return `${key}: ${text}`
        })
        .join(", ")
}

function resultText(result: ToolResultMessage | undefined): string {
    return (result?.content ?? [])
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
}

function makeRenderer(tool: AgentTool): ToolRenderer {
    return {
        render(
            params: unknown,
            result: ToolResultMessage | undefined,
            isStreaming?: boolean
        ): ToolRenderResult {
            const state = result
                ? result.isError
                    ? "error"
                    : "complete"
                : isStreaming
                  ? "inprogress"
                  : "complete"
            const paramLine = summarizeParams(params)
            const title = html`<span class="font-mono">${tool.name}</span>
                <span class="text-muted-foreground font-normal"
                    >· ${tool.label}</span
                >`
            const output = resultText(result)
            return {
                isCustom: true,
                content: html`
                    <div class="space-y-2">
                        ${renderHeader(state, FileText, title)}
                        ${paramLine !== "" && paramLine !== "{}"
                            ? html`<div
                                  class="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all"
                              >
                                  ${paramLine}
                              </div>`
                            : ""}
                        ${result
                            ? html`<pre
                                  class="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto m-0"
                              >
${output
                                      ? output.length > 4000
                                          ? output.slice(0, 4000) + "\n…"
                                          : output
                                      : "(no output)"}</pre
                              >`
                            : ""}
                    </div>
                `,
            }
        },
    }
}

export function registerAssistantToolRenderers(tools: AgentTool[]): void {
    for (const tool of tools)
        registerToolRenderer(tool.name, makeRenderer(tool))
}
