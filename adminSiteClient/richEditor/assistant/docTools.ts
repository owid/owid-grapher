// The assistant's document tools, operating on the live TipTap editor.
// Adapted from the gdocs-chrome-extension tool set, with the Google Docs
// staging/apply cycle replaced by immediate edits: every edit lands as one
// ProseMirror transaction on the collaborative (Yjs-backed) document, merges
// with concurrent human edits via CRDT, and is a single undo step.

import { Editor } from "@tiptap/core"
import { Node as PmNode } from "@tiptap/pm/model"
import { Type, type Static } from "typebox"
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { excludeNullish } from "@ourworldindata/utils"
import {
    enrichedBlockToXhtml,
    prettyPrintXhtml,
} from "../../../db/model/Gdoc/enrichedToXhtml.js"
import {
    xhtmlToEnrichedBlocks,
    XhtmlParseError,
} from "../../../db/model/Gdoc/xhtmlToEnriched.js"
import {
    catalogSummary,
    collectBlockErrors,
    componentTypes,
    describeComponent,
    type ComponentType,
} from "../../../db/model/Gdoc/componentCatalog.js"
import {
    enrichedBlockToPmNode,
    pmNodeToEnrichedBlock,
} from "../../../adminShared/richEditor/serialization/serialization.js"
import { isIdentifiedNodeName } from "../../../adminShared/richEditor/serialization/pmJson.js"
import { normalizedBodyKey } from "../../../adminShared/richEditor/serialization/normalizeForComparison.js"
import { RichEditorCommentThread } from "../../../adminShared/RichEditorTypes.js"
import { Admin } from "../../Admin.js"
import { resolveSelectionRef, selectionRefFromEditor } from "../selectionRef.js"
import { undoPluginKey } from "../ySync.js"
import {
    DESCRIBE_COMPONENT_DESCRIPTION,
    EDIT_DESCRIPTION,
    FIND_DESCRIPTION,
    GET_SELECTION_DESCRIPTION,
    LIST_COMMENTS_DESCRIPTION,
    OUTLINE_DESCRIPTION,
    READ_DESCRIPTION,
    SEARCH_CHARTS_DESCRIPTION,
} from "./prompts.js"

export interface DocToolHost {
    getEditor(): Editor | null
    getDocInfo(): { id: string; type: string; title: string }
    admin: Admin
}

const text = (t: string): AgentToolResult<unknown>["content"] => [
    { type: "text", text: t },
]

export function requireEditor(host: DocToolHost): Editor {
    const editor = host.getEditor()
    if (!editor)
        throw new Error(
            "The document editor is not ready yet — ask the user to wait a moment and try again."
        )
    return editor
}

/**
 * One undo boundary around each agent edit: the collaborative UndoManager
 * groups edits by time, so without this an agent edit could merge into the
 * same undo step as the user's own typing (or a previous agent edit).
 */
export function undoBoundary(editor: Editor): void {
    undoPluginKey.getState(editor.state)?.undoManager?.stopCapturing()
}

/** Briefly highlight blocks the assistant just changed, so edits are visible. */
export function flashBlocks(editor: Editor, blockIds: string[]): void {
    for (const blockId of blockIds) {
        const located = locateBlockById(editor.state.doc, blockId)
        if (!located) continue
        const dom = editor.view.nodeDOM(located.pos)
        if (!(dom instanceof HTMLElement)) continue
        dom.classList.remove("rich-editor-assistant-flash")
        // restart the animation even when the class was just applied
        void dom.offsetWidth
        dom.classList.add("rich-editor-assistant-flash")
        setTimeout(
            () => dom.classList.remove("rich-editor-assistant-flash"),
            1700
        )
    }
}

// ---------------------------------------------------------------------------
// Locating blocks
// ---------------------------------------------------------------------------

interface LocatedBlock {
    node: PmNode
    /** position just before the node */
    pos: number
    parent: PmNode
    /** child index within the parent */
    index: number
}

function locateBlockById(doc: PmNode, blockId: string): LocatedBlock | null {
    let found: LocatedBlock | null = null
    doc.descendants((node, pos, parent, index) => {
        if (found) return false
        if (
            parent &&
            isIdentifiedNodeName(node.type.name) &&
            node.attrs.blockId === blockId
        ) {
            found = { node, pos, parent, index }
            return false
        }
        return true
    })
    return found
}

export function requireBlock(doc: PmNode, blockId: string): LocatedBlock {
    const located = locateBlockById(doc, blockId)
    if (!located)
        throw new Error(
            `No block with id "${blockId}" exists (it may have been deleted or the document changed) — check the outline or re-read the section.`
        )
    return located
}

export function nodeToEnriched(node: PmNode): OwidEnrichedGdocBlock {
    return pmNodeToEnrichedBlock(node.toJSON())
}

export function nodeToXhtml(node: PmNode): string {
    return prettyPrintXhtml(enrichedBlockToXhtml(nodeToEnriched(node)))
}

/** Best-effort one-line stub for the outline. */
function blockStub(node: PmNode): string {
    const enriched = nodeToEnriched(node) as OwidEnrichedGdocBlock & {
        url?: string
        filename?: string
        title?: string
    }
    const textContent = node.textContent.trim()
    const detail =
        textContent || enriched.url || enriched.filename || enriched.title || ""
    const shortened = detail.length > 90 ? detail.slice(0, 87) + "..." : detail
    return shortened ? ` ${JSON.stringify(shortened)}` : ""
}

interface TopBlock {
    node: PmNode
    id: string | null
    enrichedType: string
}

export function topLevelBlocks(editor: Editor): TopBlock[] {
    const blocks: TopBlock[] = []
    editor.state.doc.forEach((node) => {
        blocks.push({
            node,
            id: (node.attrs.blockId as string | null) ?? null,
            enrichedType: (nodeToEnriched(node) as { type: string }).type,
        })
    })
    return blocks
}

/** heading section: the heading plus everything until the next heading of the same or higher level */
function sectionBlocks(editor: Editor, headingId: string): PmNode[] {
    const blocks = topLevelBlocks(editor)
    const start = blocks.findIndex((block) => block.id === headingId)
    if (start === -1)
        throw new Error(
            `No top-level block with id "${headingId}" — sections are addressed by a top-level heading's id.`
        )
    const startNode = blocks[start].node
    if (startNode.type.name !== "heading")
        throw new Error(
            `Block "${headingId}" is a ${blocks[start].enrichedType}, not a heading — pass a heading id for section reads.`
        )
    const level = startNode.attrs.level as number
    const out: PmNode[] = [startNode]
    for (let i = start + 1; i < blocks.length; i++) {
        const block = blocks[i]
        if (
            block.node.type.name === "heading" &&
            (block.node.attrs.level as number) <= level
        )
            break
        out.push(block.node)
    }
    return out
}

// ---------------------------------------------------------------------------
// outline
// ---------------------------------------------------------------------------

const outlineParams = Type.Object({})

const outlineTool = (host: DocToolHost): AgentTool<typeof outlineParams> => ({
    label: "Document outline",
    name: "outline",
    description: OUTLINE_DESCRIPTION,
    parameters: outlineParams,
    executionMode: "sequential",
    execute: async (): Promise<AgentToolResult<{ blocks: number }>> => {
        const editor = requireEditor(host)
        const info = host.getDocInfo()
        const blocks = topLevelBlocks(editor)
        const totalChars = editor.state.doc.textContent.length

        let out = `Document: "${info.title}" (${info.type}, id ${info.id})\n`
        out += `${blocks.length} top-level blocks, ~${totalChars} chars of text.\n\n`
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i]
            const id = block.id ?? "(no id yet)"
            if (block.node.type.name === "heading") {
                const level = block.node.attrs.level as number
                // section size: blocks and chars until the next heading of
                // the same or higher level
                let sectionBlockCount = 0
                let sectionChars = 0
                for (let j = i + 1; j < blocks.length; j++) {
                    const next = blocks[j]
                    if (
                        next.node.type.name === "heading" &&
                        (next.node.attrs.level as number) <= level
                    )
                        break
                    sectionBlockCount++
                    sectionChars += next.node.textContent.length
                }
                out += `- ${id} [heading h${level}]${blockStub(block.node)} — section: ${sectionBlockCount} blocks, ~${sectionChars} chars\n`
            } else {
                out += `- ${id} [${block.enrichedType}]${blockStub(block.node)}\n`
            }
        }
        return { content: text(out), details: { blocks: blocks.length } }
    },
})

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

const readParams = Type.Object({
    blocks: Type.Optional(
        Type.Array(Type.String(), {
            description:
                'Block ids to read (from the outline or find), e.g. ["aB3xK9pQr2"]. Nested blocks (inside layouts or sections) work too.',
        })
    ),
    section: Type.Optional(
        Type.String({
            description:
                "Id of a top-level heading — reads the heading plus everything under it (until the next heading of the same or higher level)",
        })
    ),
    full: Type.Optional(
        Type.Boolean({ description: "Read the whole document" })
    ),
})

const READ_CHAR_LIMIT = 50_000

const readTool = (host: DocToolHost): AgentTool<typeof readParams> => ({
    label: "Read blocks",
    name: "read",
    description: READ_DESCRIPTION,
    parameters: readParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof readParams>
    ): Promise<AgentToolResult<{ blocks: number }>> => {
        const editor = requireEditor(host)
        let nodes: PmNode[]
        if (params.full === true) {
            nodes = topLevelBlocks(editor).map((block) => block.node)
        } else if (params.section !== undefined) {
            nodes = sectionBlocks(editor, params.section)
        } else if (params.blocks !== undefined && params.blocks.length > 0) {
            nodes = params.blocks.map(
                (blockId) => requireBlock(editor.state.doc, blockId).node
            )
        } else {
            throw new Error("Provide one of: blocks, section, or full=true.")
        }
        let out = nodes.map(nodeToXhtml).join("\n\n")
        if (out.length > READ_CHAR_LIMIT)
            out =
                out.slice(0, READ_CHAR_LIMIT) +
                `\n\n[truncated at ${READ_CHAR_LIMIT} chars — read narrower selections]`
        return { content: text(out), details: { blocks: nodes.length } }
    },
})

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

const findParams = Type.Object({
    query: Type.String({
        description:
            "Text to search for (plain text, or a regex with regex=true)",
    }),
    regex: Type.Optional(
        Type.Boolean({ description: "Treat query as a JavaScript regex" })
    ),
    case_sensitive: Type.Optional(
        Type.Boolean({ description: "Match case (default false)" })
    ),
    max_matches: Type.Optional(
        Type.Number({ description: "Max matches to return (default 20)" })
    ),
})

interface FindMatch {
    id: string
    type: string
    context: string
}

const findTool = (host: DocToolHost): AgentTool<typeof findParams> => ({
    label: "Find in document",
    name: "find",
    description: FIND_DESCRIPTION,
    parameters: findParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof findParams>
    ): Promise<AgentToolResult<{ total: number }>> => {
        const editor = requireEditor(host)
        const flags = params.case_sensitive === true ? "g" : "gi"
        const pattern =
            params.regex === true
                ? new RegExp(params.query, flags)
                : new RegExp(
                      params.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                      flags
                  )
        const maxMatches = Math.max(1, Math.round(params.max_matches ?? 20))

        const matches: FindMatch[] = []
        let total = 0
        // search the most specific identified block that has no identified
        // children of its own (a paragraph inside a section matches itself,
        // not the section), against its XHTML so attributes match too
        const search = (parent: PmNode): void => {
            parent.forEach((node) => {
                let hasIdentifiedChildren = false
                node.descendants((child) => {
                    if (isIdentifiedNodeName(child.type.name)) {
                        hasIdentifiedChildren = true
                        return false
                    }
                    return true
                })
                if (hasIdentifiedChildren) {
                    search(node)
                    return
                }
                if (!isIdentifiedNodeName(node.type.name)) return
                const haystack = enrichedBlockToXhtml(nodeToEnriched(node))
                pattern.lastIndex = 0
                let match: RegExpExecArray | null
                while ((match = pattern.exec(haystack)) !== null) {
                    total++
                    if (matches.length < maxMatches) {
                        const from = Math.max(0, match.index - 60)
                        const to = Math.min(
                            haystack.length,
                            match.index + match[0].length + 60
                        )
                        matches.push({
                            id: String(node.attrs.blockId ?? "(no id)"),
                            type: (nodeToEnriched(node) as { type: string })
                                .type,
                            context: `...${haystack.slice(from, to)}...`,
                        })
                    }
                    if (match[0].length === 0) pattern.lastIndex++
                }
            })
        }
        search(editor.state.doc)

        if (total === 0)
            return { content: text("No matches."), details: { total } }
        let out = matches
            .map((m) => `${m.id} (${m.type}): ${m.context}`)
            .join("\n")
        if (total > matches.length)
            out += `\n(${total - matches.length} more matches not shown — narrow the query or raise max_matches)`
        return { content: text(out), details: { total } }
    },
})

// ---------------------------------------------------------------------------
// edit
// ---------------------------------------------------------------------------

const editParams = Type.Object({
    action: Type.Union(
        [
            Type.Literal("replace"),
            Type.Literal("insert_after"),
            Type.Literal("delete"),
        ],
        {
            description:
                "replace: swap the range from..to for the new blocks; " +
                'insert_after: insert the new blocks after an anchor (or "start"); ' +
                "delete: remove the range from..to",
        }
    ),
    from: Type.Optional(
        Type.String({
            description: "First block id of the range (replace/delete)",
        })
    ),
    to: Type.Optional(
        Type.String({
            description:
                "Last block id of the range, inclusive (defaults to `from`; must be a following sibling of `from`)",
        })
    ),
    after: Type.Optional(
        Type.String({
            description:
                'Anchor for insert_after: a block id, or "start" (top of the document)',
        })
    ),
    xhtml: Type.Optional(
        Type.String({
            description:
                "New blocks (replace/insert_after) as semantic XHTML in the same form read returns. " +
                "Keep the id attribute on blocks that are edited versions of existing ones; omit ids " +
                "on genuinely new blocks.",
        })
    ),
})

export function parseXhtmlBlocks(xhtml: string): OwidEnrichedGdocBlock[] {
    let blocks: OwidEnrichedGdocBlock[]
    try {
        blocks = xhtmlToEnrichedBlocks(xhtml)
    } catch (err) {
        if (err instanceof XhtmlParseError) throw err
        throw new Error(
            `Could not parse the XHTML: ${err instanceof Error ? err.message : String(err)}`,
            { cause: err }
        )
    }
    if (blocks.length === 0)
        throw new Error(
            "The XHTML contained no blocks — provide at least one block element."
        )
    const errors = blocks.flatMap((block) =>
        collectBlockErrors(block).filter((e) => !e.startsWith("warning:"))
    )
    if (errors.length > 0)
        throw new Error(
            `The blocks did not validate:\n${errors.map((e) => `- ${e}`).join("\n")}\nFix exactly these issues and retry.`
        )
    return blocks
}

const editTool = (host: DocToolHost): AgentTool<typeof editParams> => ({
    label: "Edit document",
    name: "edit",
    description: EDIT_DESCRIPTION,
    parameters: editParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof editParams>
    ): Promise<AgentToolResult<{ applied: boolean }>> => {
        const editor = requireEditor(host)
        const doc = editor.state.doc

        // resolve new content first (cheap validation before touching the doc)
        let pmNodes: PmNode[] = []
        if (params.action === "replace" || params.action === "insert_after") {
            if (params.xhtml === undefined)
                throw new Error(`${params.action} requires "xhtml".`)
            const blocks = parseXhtmlBlocks(params.xhtml)
            pmNodes = blocks.map((block) => {
                const node = editor.schema.nodeFromJSON(
                    enrichedBlockToPmNode(block)
                )
                node.check()
                return node
            })
        }

        let insertPos: number
        let deleteTo: number
        let parent: PmNode
        let childIndex: number
        if (params.action === "insert_after") {
            if (params.after === undefined)
                throw new Error(
                    'insert_after requires "after" (a block id or "start").'
                )
            if (params.after === "start") {
                parent = doc
                childIndex = 0
                insertPos = 0
                deleteTo = 0
            } else {
                const anchor = requireBlock(doc, params.after)
                parent = anchor.parent
                childIndex = anchor.index + 1
                insertPos = anchor.pos + anchor.node.nodeSize
                deleteTo = insertPos
            }
        } else {
            if (params.from === undefined)
                throw new Error(
                    `${params.action} requires "from" (and optional "to") block ids.`
                )
            const from = requireBlock(doc, params.from)
            const to =
                params.to === undefined || params.to === params.from
                    ? from
                    : requireBlock(doc, params.to)
            if (to.parent !== from.parent)
                throw new Error(
                    `Blocks "${params.from}" and "${params.to}" have different parents — a range must be siblings within the same container.`
                )
            if (to.index < from.index)
                throw new Error(
                    `"to" (${params.to}) comes before "from" (${params.from}) in the document.`
                )
            parent = from.parent
            childIndex = from.index
            insertPos = from.pos
            deleteTo = to.pos + to.node.nodeSize
        }

        undoBoundary(editor)
        try {
            const tr = editor.state.tr
            if (params.action === "delete") {
                tr.delete(insertPos, deleteTo)
            } else {
                tr.replaceWith(insertPos, deleteTo, pmNodes)
            }
            editor.view.dispatch(tr)
        } catch (err) {
            throw new Error(
                `The edit is not valid here (${parent.type.name} cannot hold this content): ${
                    err instanceof Error ? err.message : String(err)
                }`,
                { cause: err }
            )
        }
        undoBoundary(editor)

        if (params.action === "delete") {
            return {
                content: text(
                    `Deleted ${params.to && params.to !== params.from ? "blocks" : "block"} ${params.from}${
                        params.to && params.to !== params.from
                            ? `..${params.to}`
                            : ""
                    }.`
                ),
                details: { applied: true },
            }
        }

        // report the blocks as they now exist (ids assigned by the editor)
        const newDoc = editor.state.doc
        const landed: string[] = []
        const landedIds: string[] = []
        // re-locate the parent in the new state: for the doc it is the doc;
        // otherwise find it via any surviving child position
        const container =
            parent === doc ? newDoc : newDoc.resolve(insertPos + 1).node(-1)
        for (
            let i = childIndex;
            i < Math.min(childIndex + pmNodes.length, container.childCount);
            i++
        ) {
            const child = container.child(i)
            const childType = (nodeToEnriched(child) as { type: string }).type
            landed.push(`${String(child.attrs.blockId ?? "?")} [${childType}]`)
            if (child.attrs.blockId) landedIds.push(String(child.attrs.blockId))
        }
        flashBlocks(editor, landedIds)
        const verb = params.action === "replace" ? "Replaced with" : "Inserted"
        return {
            content: text(
                `${verb} ${pmNodes.length} block${pmNodes.length === 1 ? "" : "s"}: ${landed.join(", ")}. The change is live in the user's editor (one undo step).`
            ),
            details: { applied: true },
        }
    },
})

// ---------------------------------------------------------------------------
// get_selection
// ---------------------------------------------------------------------------

const getSelectionParams = Type.Object({})

/** Human-readable description of the user's current selection (also used to
 * attach selection context to outgoing user messages). */
export function describeSelection(editor: Editor): string {
    const ref = selectionRefFromEditor(editor)
    if (ref.kind === "document")
        return "Nothing is selected in the editor right now."
    if (ref.kind === "block") {
        const resolved = resolveSelectionRef(editor, ref)
        if (resolved?.kind !== "block")
            return "The previously selected block no longer exists."
        return `The user has selected a whole ${ref.blockType} block (id ${ref.blockId}):\n${nodeToXhtml(resolved.node)}`
    }
    const resolved = resolveSelectionRef(editor, ref)
    const where = ref.blockId ? ` (in block ${ref.blockId})` : ""
    if (resolved?.kind !== "text")
        return `The user had selected text${where}: "${ref.excerpt}" — but the selection could not be resolved anymore.`
    return `The user has selected text${where}: "${ref.excerpt}"`
}

const getSelectionTool = (
    host: DocToolHost
): AgentTool<typeof getSelectionParams> => ({
    label: "Get selection",
    name: "get_selection",
    description: GET_SELECTION_DESCRIPTION,
    parameters: getSelectionParams,
    executionMode: "sequential",
    execute: async (): Promise<AgentToolResult<{ selected: boolean }>> => {
        const editor = requireEditor(host)
        const description = describeSelection(editor)
        return {
            content: text(description),
            details: {
                selected: !description.startsWith("Nothing"),
            },
        }
    },
})

// ---------------------------------------------------------------------------
// list_comments
// ---------------------------------------------------------------------------

const listCommentsParams = Type.Object({
    include_resolved: Type.Optional(
        Type.Boolean({
            description: "Also list resolved comment threads (default false)",
        })
    ),
})

const listCommentsTool = (
    host: DocToolHost
): AgentTool<typeof listCommentsParams> => ({
    label: "List comments",
    name: "list_comments",
    description: LIST_COMMENTS_DESCRIPTION,
    parameters: listCommentsParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof listCommentsParams>
    ): Promise<AgentToolResult<{ count: number }>> => {
        const info = host.getDocInfo()
        const { threads } = (await host.admin.getJSON(
            `/api/gdocs/${info.id}/comments`
        )) as unknown as { threads: RichEditorCommentThread[] }
        const visible = threads.filter(
            (thread) =>
                params.include_resolved === true || thread.status !== "resolved"
        )
        if (visible.length === 0)
            return {
                content: text(
                    params.include_resolved
                        ? "No comments on this document."
                        : "No open comments on this document (pass include_resolved=true for resolved ones)."
                ),
                details: { count: 0 },
            }
        const out = visible
            .map((thread) => {
                const anchor =
                    thread.anchorType === "block"
                        ? `block ${thread.anchorBlockId ?? "?"} (${thread.anchorText ?? "block"})`
                        : thread.anchorType === "range"
                          ? `text ${JSON.stringify(thread.anchorText ?? "")}`
                          : "the whole document"
                const posts = thread.comments
                    .map(
                        (comment) =>
                            `  ${comment.userFullName ?? "Unknown"}: ${comment.text}`
                    )
                    .join("\n")
                return `[${thread.status}] on ${anchor}:\n${posts}`
            })
            .join("\n\n")
        return { content: text(out), details: { count: visible.length } }
    },
})

// ---------------------------------------------------------------------------
// describe_component
// ---------------------------------------------------------------------------

const describeComponentParams = Type.Object({
    components: Type.Optional(
        Type.Array(Type.String(), {
            description:
                'Component type names to describe in detail (e.g. ["chart", "callout"]). ' +
                "Omit to get the catalog: one line per component.",
        })
    ),
})

function renderComponentDetail(type: ComponentType, host: DocToolHost): string {
    const d = describeComponent(type)
    let out = `## ${d.type} — ${d.description}`
    if (d.pageTypes) out += ` (${d.pageTypes})`
    out += "\n"
    if (d.whenToUse) out += `When to use: ${d.whenToUse}\n`
    if (d.notes) out += `Notes: ${d.notes}\n`
    out += `Required: ${d.requiredFields.join(", ") || "(none)"}; optional: ${d.optionalFields.join(", ") || "(none)"}\n`
    if (d.prodUsageCount !== undefined)
        out += `Used ${d.prodUsageCount}× in published OWID content.\n`
    out += `\nMinimal form:\n${d.minimalXhtml.trimEnd()}\n`
    if (d.fullXhtml !== d.minimalXhtml)
        out += `\nAll fields:\n${d.fullXhtml.trimEnd()}\n`
    for (const example of d.realExamples.slice(0, 2))
        out += `\nReal example (from "${example.slug}", ${example.gdocType}):\n${example.xhtml.trimEnd()}\n`
    // instances in the open document are the best models to imitate
    const editor = host.getEditor()
    if (editor) {
        const inDoc = topLevelBlocks(editor)
            .filter((block) => block.enrichedType === type && block.id)
            .map((block) => block.id)
        if (inDoc.length > 0)
            out += `\nIn this document: ${inDoc.join(", ")} (read them for in-context models).\n`
    }
    return out
}

const describeComponentTool = (
    host: DocToolHost
): AgentTool<typeof describeComponentParams> => ({
    label: "Describe components",
    name: "describe_component",
    description:
        DESCRIBE_COMPONENT_DESCRIPTION + componentTypes().join(", ") + ".",
    parameters: describeComponentParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof describeComponentParams>
    ): Promise<AgentToolResult<{ components: number }>> => {
        if (!params.components || params.components.length === 0) {
            return {
                content: text(
                    `Available components (pass names for details):\n${catalogSummary()}`
                ),
                details: { components: componentTypes().length },
            }
        }
        const known = new Set<string>(componentTypes())
        const sections = params.components.map((name) => {
            if (!known.has(name)) {
                const near = componentTypes().filter(
                    (t) => t.includes(name) || name.includes(t)
                )
                return `## ${name} — unknown component${near.length > 0 ? ` (did you mean: ${near.join(", ")}?)` : ""}`
            }
            return renderComponentDetail(name as ComponentType, host)
        })
        return {
            content: text(sections.join("\n\n")),
            details: { components: params.components.length },
        }
    },
})

// ---------------------------------------------------------------------------
// search_charts
// ---------------------------------------------------------------------------

const searchChartsParams = Type.Object({
    query: Type.String({
        description:
            'What to search for, e.g. "life expectancy" or a slug fragment',
    }),
    max_results: Type.Optional(
        Type.Number({ description: "Max results (default 8)" })
    ),
})

interface ChartRow {
    id: number
    title: string
    slug: string
    type: string | null
    variantName: string | null
    isPublished: number
    tags?: { name: string }[]
}

let chartListCache: { rows: ChartRow[]; fetchedAt: number } | null = null
const CHART_LIST_TTL_MS = 5 * 60 * 1000

async function chartList(admin: Admin): Promise<ChartRow[]> {
    if (
        chartListCache &&
        Date.now() - chartListCache.fetchedAt < CHART_LIST_TTL_MS
    )
        return chartListCache.rows
    const response = (await admin.getJSON("/api/charts.json")) as unknown as {
        charts: ChartRow[]
    }
    chartListCache = { rows: response.charts, fetchedAt: Date.now() }
    return chartListCache.rows
}

const searchChartsTool = (
    host: DocToolHost
): AgentTool<typeof searchChartsParams> => ({
    label: "Search charts",
    name: "search_charts",
    description: SEARCH_CHARTS_DESCRIPTION,
    parameters: searchChartsParams,
    executionMode: "sequential",
    execute: async (
        _id,
        params: Static<typeof searchChartsParams>
    ): Promise<AgentToolResult<{ total: number }>> => {
        const rows = await chartList(host.admin)
        const terms = params.query
            .toLowerCase()
            .split(/\s+/)
            .filter((term) => term.length > 0)
        if (terms.length === 0) throw new Error("Provide a non-empty query.")
        const scored = excludeNullish(
            rows.map((row) => {
                const haystack = [
                    row.title,
                    row.slug,
                    row.variantName ?? "",
                    String(row.id),
                    ...(row.tags?.map((tag) => tag.name) ?? []),
                ]
                    .join(" ")
                    .toLowerCase()
                if (!terms.every((term) => haystack.includes(term))) return null
                // crude relevance: published first, then title-prefix matches
                const score =
                    (row.isPublished ? 2 : 0) +
                    (row.title.toLowerCase().startsWith(terms[0]) ? 1 : 0)
                return { row, score }
            })
        ).sort((a, b) => b.score - a.score)
        const maxResults = Math.max(1, Math.round(params.max_results ?? 8))
        if (scored.length === 0)
            return {
                content: text(
                    "No charts matched — try fewer or different terms."
                ),
                details: { total: 0 },
            }
        const out = scored
            .slice(0, maxResults)
            .map(({ row }) => {
                const url = `https://ourworldindata.org/grapher/${row.slug}`
                const bits = [
                    row.type ?? "chart",
                    row.isPublished ? "published" : "draft",
                    `id ${row.id}`,
                ]
                return `${url} — "${row.title}"${row.variantName ? ` (${row.variantName})` : ""} [${bits.join(", ")}]`
            })
            .join("\n")
        return {
            content: text(
                out +
                    (scored.length > maxResults
                        ? `\n(${scored.length - maxResults} more matches)`
                        : "")
            ),
            details: { total: scored.length },
        }
    },
})

// ---------------------------------------------------------------------------

export function createDocTools(host: DocToolHost): AgentTool[] {
    return [
        outlineTool(host) as AgentTool,
        readTool(host) as AgentTool,
        findTool(host) as AgentTool,
        editTool(host) as AgentTool,
        getSelectionTool(host) as AgentTool,
        listCommentsTool(host) as AgentTool,
        describeComponentTool(host) as AgentTool,
        searchChartsTool(host) as AgentTool,
    ]
}

// ---------------------------------------------------------------------------
// Whole-file document rewrites (the JavaScript workspace's /doc/current.xhtml
// path): diff the file's blocks against the live document BY BLOCK ID and
// apply the delta — untouched blocks are never rewritten, so concurrent
// edits and comment anchors on them survive. All ops land in one undo group.
// ---------------------------------------------------------------------------

export function fullDocXhtml(editor: Editor): string {
    return topLevelBlocks(editor)
        .map((block) => nodeToXhtml(block.node))
        .join("\n\n")
}

export interface DocFileDiffResult {
    replaced: number
    inserted: number
    deleted: number
    unchanged: number
    /** ids of blocks that were replaced or inserted (for highlighting) */
    changedIds: string[]
}

export function applyDocFileDiff(
    editor: Editor,
    newBlocks: OwidEnrichedGdocBlock[]
): DocFileDiffResult {
    const old = topLevelBlocks(editor)
    const oldIds = old.map((block) => block.id).filter(Boolean) as string[]
    const oldById = new Map(
        old.filter((block) => block.id).map((block) => [block.id!, block])
    )
    const keptIds = newBlocks
        .map((block) => block.id)
        .filter((id): id is string => !!id && oldById.has(id))

    // reordering existing blocks via the file is not supported — the diff
    // would degenerate into delete+reinsert and lose identity
    const keptInOldOrder = oldIds.filter((id) => keptIds.includes(id))
    if (keptInOldOrder.join("\n") !== keptIds.join("\n"))
        throw new Error(
            "The file reorders existing blocks — that is not supported through /doc/current.xhtml. Use the edit tool to move blocks, or keep their order and only change content."
        )

    const keptIdSet = new Set(keptIds)
    const result: DocFileDiffResult = {
        replaced: 0,
        inserted: 0,
        deleted: 0,
        unchanged: 0,
        changedIds: [],
    }

    undoBoundary(editor)
    try {
        // deletions first (ids re-resolved each time; positions stay valid
        // because every op re-reads the current state)
        for (const oldId of oldIds) {
            if (keptIdSet.has(oldId)) continue
            const located = requireBlock(editor.state.doc, oldId)
            const tr = editor.state.tr
            tr.delete(located.pos, located.pos + located.node.nodeSize)
            editor.view.dispatch(tr)
            result.deleted++
        }
        // then walk the new list: replace changed kept blocks in place,
        // insert new blocks after the previously placed one
        let lastPlacedId: string | null = null
        for (const block of newBlocks) {
            const isKept = !!block.id && keptIdSet.has(block.id)
            if (isKept) {
                const located = requireBlock(editor.state.doc, block.id!)
                const changed =
                    normalizedBodyKey([nodeToEnriched(located.node)]) !==
                    normalizedBodyKey([block])
                if (changed) {
                    const node = editor.schema.nodeFromJSON(
                        enrichedBlockToPmNode(block)
                    )
                    node.check()
                    const tr = editor.state.tr
                    tr.replaceWith(
                        located.pos,
                        located.pos + located.node.nodeSize,
                        node
                    )
                    editor.view.dispatch(tr)
                    result.replaced++
                    result.changedIds.push(block.id!)
                } else {
                    result.unchanged++
                }
                lastPlacedId = block.id!
            } else {
                const node = editor.schema.nodeFromJSON(
                    enrichedBlockToPmNode(block)
                )
                node.check()
                let insertPos = 0
                if (lastPlacedId) {
                    const anchor = requireBlock(editor.state.doc, lastPlacedId)
                    insertPos = anchor.pos + anchor.node.nodeSize
                }
                const tr = editor.state.tr
                tr.insert(insertPos, node)
                editor.view.dispatch(tr)
                result.inserted++
                // the assignment plugin may have minted the id; read it back
                const placed: PmNode | null = editor.state.doc
                    .resolve(insertPos + 1)
                    .node(1)
                lastPlacedId =
                    (placed?.attrs.blockId as string | null) ?? lastPlacedId
                if (placed?.attrs.blockId)
                    result.changedIds.push(String(placed.attrs.blockId))
            }
        }
    } finally {
        undoBoundary(editor)
    }
    flashBlocks(editor, result.changedIds)
    return result
}
