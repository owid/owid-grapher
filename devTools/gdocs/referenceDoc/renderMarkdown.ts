/*
 * Library model → Markdown, for `--dry-run`.
 *
 * A structural view of what each Google Doc will contain. Headings, bullets,
 * tables and fenced examples keep their Markdown form; inline formatting
 * (code, bold, italic) is dropped to plain text, so every backtick or `**`
 * left in the output outside a fence would be one that leaked from the
 * sidecar prose unparsed. Links are kept as `[text](url)`.
 */

import type { Block, ReferenceLibrary, Run } from "./model.js"

export interface MarkdownFile {
    /** `index.md`, `component-chart.md`, `guide-refs.md`, … */
    fileName: string
    markdown: string
}

/** One Markdown file per document, the index first */
export function renderLibraryMarkdown(
    library: ReferenceLibrary
): MarkdownFile[] {
    return [
        { fileName: "index.md", markdown: renderBlocks(library.index.blocks) },
        ...library.items.map((item) => ({
            fileName: `${item.kind}-${item.id}.md`,
            markdown: renderBlocks(item.blocks),
        })),
    ]
}

/** The whole library as one stream: documents separated by a blank line */
export function renderLibraryMarkdownAsOne(library: ReferenceLibrary): string {
    return renderLibraryMarkdown(library)
        .map((file) => file.markdown)
        .join("\n")
}

export function renderBlocks(blocks: Block[]): string {
    return blocks.map(renderBlock).join("\n\n") + "\n"
}

function renderBlock(block: Block): string {
    switch (block.type) {
        case "heading":
            return `${"#".repeat(block.level)} ${block.text}`
        case "paragraph":
            return renderRuns(block.runs)
        case "bullets":
            return block.items.map((item) => `- ${renderRuns(item)}`).join("\n")
        case "code":
            return "```\n" + block.text + "\n```"
        case "table": {
            const header = `| ${block.header.map(escapeCell).join(" | ")} |`
            const divider = `| ${block.header.map(() => "---").join(" | ")} |`
            const rows = block.rows.map(
                (row) =>
                    `| ${row.map((cell) => escapeCell(renderRuns(cell))).join(" | ")} |`
            )
            return [header, divider, ...rows].join("\n")
        }
    }
}

function renderRuns(runs: Run[]): string {
    return runs
        .map((run) =>
            run.link && run.text ? `[${run.text}](${run.link})` : run.text
        )
        .join("")
}

function escapeCell(cell: string): string {
    return cell.replaceAll("|", "\\|").replaceAll("\n", " ")
}
