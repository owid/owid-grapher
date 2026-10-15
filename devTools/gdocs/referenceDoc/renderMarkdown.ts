/*
 * Library → Markdown files, for `--dry-run`: exactly the Markdown each Drive
 * file is uploaded with, under the same file names.
 */

import { fileNameFor } from "./buildModel.js"
import { INDEX_REF, type ReferenceLibrary } from "./model.js"

export interface MarkdownFile {
    /** `owid-writing-reference-index.md`, `component-chart.md`, `guide-refs.md`, … */
    fileName: string
    markdown: string
}

/** One Markdown file per document, the index first */
export function renderLibraryMarkdown(
    library: ReferenceLibrary
): MarkdownFile[] {
    return [
        { fileName: fileNameFor(INDEX_REF), markdown: library.index.markdown },
        ...library.items.map((item) => ({
            fileName: fileNameFor(item),
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
