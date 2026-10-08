/*
 * Library → Markdown files, for `--dry-run`: exactly the Markdown each
 * Google Doc is uploaded with.
 */

import type { ReferenceLibrary } from "./model.js"

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
        { fileName: "index.md", markdown: library.index.markdown },
        ...library.items.map((item) => ({
            fileName: `${item.kind}-${item.id}.md`,
            markdown: item.markdown,
        })),
    ]
}

/** The whole library as one stream: documents separated by a blank line */
export function renderLibraryMarkdownAsOne(library: ReferenceLibrary): string {
    return renderLibraryMarkdown(library)
        .map((file) => file.markdown)
        .join("\n")
}
