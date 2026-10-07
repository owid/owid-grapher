/*
 * Document model → Markdown, for `--dry-run`.
 *
 * A structural view of what the Google Doc will contain. Headings, bullets,
 * tables and fenced examples keep their Markdown form; inline formatting
 * (code, bold, italic) is dropped to plain text, so every backtick or `**`
 * left in the output outside a fence would be one that leaked from the
 * sidecar prose unparsed.
 */

import type { Block, ReferenceDocument, Run, Section } from "./model.js"

export function renderMarkdown(doc: ReferenceDocument): string {
    return doc.sections.map(renderSection).join("\n\n") + "\n"
}

function renderSection(section: Section): string {
    return [`# ${section.title}`, ...section.blocks.map(renderBlock)].join(
        "\n\n"
    )
}

function renderBlock(block: Block): string {
    switch (block.type) {
        case "heading":
            // Section titles are the `#`; everything inside sits one deeper
            return `${"#".repeat(block.level + 1)} ${block.text}`
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
