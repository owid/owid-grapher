/*
 * Sidecar prose (Markdown) → document-model blocks.
 *
 * The registries carry the sidecars' prose as Markdown: `##` headings,
 * lists, inline code / bold / italic / links, and fenced ```archie examples.
 * This turns one such string into Blocks, so that no Markdown syntax is left
 * in the text we send to Google Docs. Inline code spans that are mentions
 * (`{.chart}`, `{guide:refs}`, `{template:article}`) resolve the way the
 * admin's `parseMention` does: a component keeps its `{.id}` form in
 * monospace; a guide or template becomes its title in plain text.
 */

import { fromMarkdown } from "mdast-util-from-markdown"
import type {
    Heading,
    List,
    ListItem,
    PhrasingContent,
    RootContent,
} from "mdast"
import type { RelatedRef } from "@ourworldindata/types"
import { parseMention } from "../mentions.js"
import {
    type Block,
    type HeadingLevel,
    type Run,
    clampHeadingLevel,
    runsToPlainText,
} from "./model.js"

/** Resolves a guide/template mention to the title shown for it */
export type TitleFor = (ref: RelatedRef) => string | undefined

export interface MarkdownToBlocksOptions {
    /**
     * Level of the heading the prose sits under. A `##` in the prose becomes
     * one level deeper than this, `###` two levels, capped at HEADING_4.
     */
    baseLevel: HeadingLevel
    titleFor: TitleFor
}

interface InlineStyle {
    bold?: boolean
    italic?: boolean
    link?: string
}

export function markdownToBlocks(
    markdown: string,
    options: MarkdownToBlocksOptions
): Block[] {
    const tree = fromMarkdown(markdown)
    const blocks: Block[] = []
    for (const node of tree.children) appendBlockNode(node, options, blocks)
    return blocks
}

function appendBlockNode(
    node: RootContent,
    options: MarkdownToBlocksOptions,
    blocks: Block[]
): void {
    switch (node.type) {
        case "heading":
            blocks.push({
                type: "heading",
                level: demotedLevel(node, options.baseLevel),
                text: runsToPlainText(
                    inlineToRuns(node.children, options.titleFor)
                ),
            })
            return
        case "paragraph": {
            const runs = inlineToRuns(node.children, options.titleFor)
            if (runs.length > 0) blocks.push({ type: "paragraph", runs })
            return
        }
        case "list":
            blocks.push({ type: "bullets", items: listToItems(node, options) })
            return
        case "code":
            blocks.push({ type: "code", text: node.value })
            return
        case "blockquote":
            for (const child of node.children)
                appendBlockNode(child, options, blocks)
            return
        default:
            // html, thematicBreak, definitions, yaml front matter … are not
            // rendered by the admin either
            return
    }
}

/**
 * A sidecar's own `##` is its top heading, so it lands one level below the
 * heading the prose is rendered under, `###` two below, never past H4.
 */
function demotedLevel(node: Heading, baseLevel: HeadingLevel): HeadingLevel {
    // A stray `#` counts as `##`: prose never outranks its own heading
    return clampHeadingLevel(baseLevel + Math.max(node.depth, 2) - 1)
}

/** Flattens a (possibly nested) list into one bullet per list item */
function listToItems(list: List, options: MarkdownToBlocksOptions): Run[][] {
    const items: Run[][] = []
    for (const item of list.children) appendListItem(item, options, items)
    return items
}

function appendListItem(
    item: ListItem,
    options: MarkdownToBlocksOptions,
    items: Run[][]
): void {
    const runs: Run[] = []
    const nested: List[] = []
    for (const child of item.children) {
        if (child.type === "paragraph") {
            if (runs.length > 0) runs.push({ text: " " })
            runs.push(...inlineToRuns(child.children, options.titleFor))
        } else if (child.type === "list") nested.push(child)
        else if (child.type === "code") runs.push(codeRun(child.value))
    }
    if (runs.length > 0) items.push(runs)
    for (const list of nested) items.push(...listToItems(list, options))
}

/** Inline Markdown → runs, adjacent runs with the same style merged */
export function inlineToRuns(
    nodes: PhrasingContent[],
    titleFor: TitleFor
): Run[] {
    const runs: Run[] = []
    for (const node of nodes) collectRuns(node, {}, titleFor, runs)
    return mergeRuns(runs)
}

function collectRuns(
    node: PhrasingContent,
    style: InlineStyle,
    titleFor: TitleFor,
    runs: Run[]
): void {
    switch (node.type) {
        case "text":
            runs.push({ ...style, text: softBreaksToSpaces(node.value) })
            return
        case "inlineCode":
            runs.push({ ...style, ...mentionRun(node.value, titleFor) })
            return
        case "strong":
            for (const child of node.children)
                collectRuns(child, { ...style, bold: true }, titleFor, runs)
            return
        case "emphasis":
            for (const child of node.children)
                collectRuns(child, { ...style, italic: true }, titleFor, runs)
            return
        case "link":
            for (const child of node.children)
                collectRuns(child, { ...style, link: node.url }, titleFor, runs)
            return
        case "break":
            runs.push({ ...style, text: " " })
            return
        case "image":
            runs.push({ ...style, text: node.alt ?? "", link: node.url })
            return
        case "html":
            // Raw HTML is dropped, as the admin's renderer does
            return
        default:
            // delete, footnoteReference … — keep whatever text they carry
            if ("children" in node)
                for (const child of node.children)
                    collectRuns(child, style, titleFor, runs)
            else if ("value" in node && typeof node.value === "string")
                runs.push({ ...style, text: node.value })
            return
    }
}

/**
 * An inline code span: a component mention stays `{.id}` in monospace; a
 * guide/template mention becomes the target's title in plain text (its id
 * when the title is unknown); anything else is plain monospace code.
 */
function mentionRun(codeText: string, titleFor: TitleFor): Run {
    const mention = parseMention(codeText)
    if (!mention || mention.kind === "component") return codeRun(codeText)
    return { text: titleFor(mention) ?? mention.id }
}

function codeRun(value: string): Run {
    return { text: value, code: true }
}

/** Markdown soft line breaks inside a paragraph are just spaces */
function softBreaksToSpaces(value: string): string {
    return value.replace(/\s*\n\s*/g, " ")
}

function sameStyle(a: Run, b: Run): boolean {
    return (
        !!a.code === !!b.code &&
        !!a.bold === !!b.bold &&
        !!a.italic === !!b.italic &&
        a.link === b.link
    )
}

export function mergeRuns(runs: Run[]): Run[] {
    const merged: Run[] = []
    for (const run of runs) {
        if (run.text === "") continue
        const last = merged.at(-1)
        if (last && sameStyle(last, run)) last.text += run.text
        else merged.push({ ...run })
    }
    return merged
}

/**
 * One-line Markdown (a field description, a skeleton part's description) →
 * runs. Block structure is flattened: paragraphs are joined with a space.
 */
export function inlineMarkdownToRuns(
    markdown: string,
    titleFor: TitleFor
): Run[] {
    const runs: Run[] = []
    for (const block of markdownToBlocks(markdown, {
        baseLevel: 1,
        titleFor,
    })) {
        if (runs.length > 0) runs.push({ text: " " })
        runs.push(...blockToInlineRuns(block))
    }
    return mergeRuns(runs)
}

function blockToInlineRuns(block: Block): Run[] {
    switch (block.type) {
        case "paragraph":
            return block.runs
        case "bullets":
            return block.items.flatMap((item, index) =>
                index > 0 ? [{ text: "; " }, ...item] : item
            )
        case "table":
            return block.rows.flatMap((row, index) =>
                index > 0 ? [{ text: "; " }, ...joinCells(row)] : joinCells(row)
            )
        case "heading":
            return [{ text: block.text }]
        case "code":
            return [{ text: block.text, code: true }]
    }
}

function joinCells(row: Run[][]): Run[] {
    return row.flatMap((cell, index) =>
        index > 0 ? [{ text: ", " }, ...cell] : cell
    )
}
