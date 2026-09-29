// The summaries tool: one line per block from a cheap model, cached by
// content hash. A compact rewrite of the gdocs-chrome-extension's
// summaries.ts for the block model (ids instead of sids); same idea — grasp
// a large document without reading it into the main model's context.

import { Editor } from "@tiptap/core"
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core"
import { Type, type Static } from "typebox"
import { SUMMARIES_DESCRIPTION } from "./prompts.js"
import {
    nodeToEnriched,
    requireEditor,
    topLevelBlocks,
    type DocToolHost,
} from "./docTools.js"

export interface Summarizer {
    /** cheap-model completion */
    complete(systemPrompt: string, userPrompt: string): Promise<string>
    modelLabel?: string
}

export interface SummariesToolHost extends DocToolHost {
    summarizer: Summarizer
}

const SUMMARIZE_SYSTEM_PROMPT =
    "You annotate draft articles the way an author outlines their manuscript for an editor. " +
    "For each TARGET block, write ONE note (max 25 words) describing what the block does for the " +
    "reader at that point in the article — the move it makes and its key claim. " +
    "TARGET blocks are the lines formatted `id<TAB>text`. Everything else (headings, context lines) " +
    "is there so you understand where each target sits; do NOT annotate it. " +
    "Reply with EXACTLY one line per target, formatted `id<TAB>note`, in the same order. " +
    "No preamble, no extra lines, no markdown."

/** blocks short enough to show verbatim instead of summarizing */
const VERBATIM_CHARS = 120

// content-hash cache in localStorage (survives reloads; content-keyed so
// edits invalidate naturally)
function cacheKey(text: string): string {
    // FNV-1a — cheap and good enough for a cache key
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return `assistant-summary:${(hash >>> 0).toString(36)}:${text.length}`
}

function cacheGet(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function cacheSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch {
        // full or unavailable — fine, it's just a cache
    }
}

const summariesParams = Type.Object({
    refresh: Type.Optional(
        Type.Boolean({
            description: "Ignore the cache and re-summarize (default false)",
        })
    ),
})

export const summariesTool = (
    host: SummariesToolHost
): AgentTool<typeof summariesParams> => ({
    label: "Summarize blocks",
    name: "summaries",
    description: SUMMARIES_DESCRIPTION,
    parameters: summariesParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof summariesParams>
    ): Promise<
        AgentToolResult<{ summarizedNow: number; fromCache: number }>
    > => {
        const editor: Editor = requireEditor(host)
        const blocks = topLevelBlocks(editor)

        interface Line {
            id: string
            verbatim?: string
            /** text sent to the summarizer (undefined = verbatim line) */
            toSummarize?: string
        }
        const lines: Line[] = blocks.map((block) => {
            const id = block.id ?? "?"
            if (block.node.type.name === "heading") {
                const level = block.node.attrs.level as number
                return {
                    id,
                    verbatim: `[h${level}] ${block.node.textContent.trim()}`,
                }
            }
            const textContent = block.node.textContent.trim()
            if (textContent.length === 0) {
                // media/atom blocks: describe by type + main attribute
                const enriched = nodeToEnriched(block.node) as {
                    type: string
                    url?: string
                    filename?: string
                }
                return {
                    id,
                    verbatim: `[${enriched.type}] ${enriched.url ?? enriched.filename ?? ""}`,
                }
            }
            if (textContent.length <= VERBATIM_CHARS)
                return { id, verbatim: textContent }
            return { id, toSummarize: textContent }
        })

        // resolve targets from cache first
        let fromCache = 0
        const targets: { id: string; text: string }[] = []
        const notes = new Map<string, string>()
        for (const line of lines) {
            if (line.toSummarize === undefined) continue
            if (params.refresh !== true) {
                const cached = cacheGet(cacheKey(line.toSummarize))
                if (cached !== null) {
                    notes.set(line.id, cached)
                    fromCache++
                    continue
                }
            }
            targets.push({ id: line.id, text: line.toSummarize })
        }

        if (targets.length > 0) {
            const prompt = lines
                .map((line) => {
                    if (line.verbatim !== undefined)
                        return `(context) ${line.verbatim}`
                    const isTarget = targets.some((t) => t.id === line.id)
                    return isTarget
                        ? `${line.id}\t${line.toSummarize}`
                        : `(context) ${line.toSummarize?.slice(0, 200)}`
                })
                .join("\n")
            const reply = await host.summarizer.complete(
                SUMMARIZE_SYSTEM_PROMPT,
                prompt
            )
            for (const replyLine of reply.split("\n")) {
                const tab = replyLine.indexOf("\t")
                if (tab <= 0) continue
                const id = replyLine.slice(0, tab).trim()
                const note = replyLine.slice(tab + 1).trim()
                const target = targets.find((t) => t.id === id)
                if (!target || !note) continue
                notes.set(id, note)
                cacheSet(cacheKey(target.text), note)
            }
        }

        const out = lines
            .map((line) => {
                if (line.verbatim !== undefined)
                    return `${line.id}\t${line.verbatim}`
                const note = notes.get(line.id)
                return `${line.id}\t${note ?? "(no summary produced)"} [${line.toSummarize!.length} chars]`
            })
            .join("\n")
        const summarizedNow = targets.filter((t) => notes.has(t.id)).length
        const suffix = `\n(${summarizedNow} summarized now${host.summarizer.modelLabel ? ` by ${host.summarizer.modelLabel}` : ""}, ${fromCache} from cache)`
        return {
            content: [{ type: "text", text: out + suffix }],
            details: { summarizedNow, fromCache },
        }
    },
})
