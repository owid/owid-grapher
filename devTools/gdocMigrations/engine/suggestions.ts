import * as _ from "lodash-es"
import { type docs_v1 } from "@googleapis/docs"
import { SourceRange } from "../types.js"

function hasSuggestionIds(
    element:
        | {
              suggestedInsertionIds?: string[] | null
              suggestedDeletionIds?: string[] | null
          }
        | undefined
): boolean {
    if (!element) return false
    return (
        (element.suggestedInsertionIds?.length ?? 0) > 0 ||
        (element.suggestedDeletionIds?.length ?? 0) > 0
    )
}

/**
 * Collects the character ranges of all pending suggested insertions and
 * deletions in a document (fetched with SUGGESTIONS_INLINE). Used to skip
 * docs where a suggestion overlaps a block we'd edit — batchUpdate cannot
 * apply edits as suggestions, so touching suggested text would silently
 * resolve an author's open proposal.
 */
export function collectSuggestedRanges(
    document: docs_v1.Schema$Document
): SourceRange[] {
    const ranges: SourceRange[] = []

    const visitContent = (
        content: docs_v1.Schema$StructuralElement[] | undefined | null
    ): void => {
        for (const element of content ?? []) {
            if (element.paragraph) {
                for (const pe of element.paragraph.elements ?? []) {
                    const suggested =
                        hasSuggestionIds(pe.textRun ?? undefined) ||
                        hasSuggestionIds(pe.richLink ?? undefined) ||
                        hasSuggestionIds(pe.inlineObjectElement ?? undefined) ||
                        hasSuggestionIds(pe.horizontalRule ?? undefined)
                    if (
                        suggested &&
                        !_.isNil(pe.startIndex) &&
                        !_.isNil(pe.endIndex)
                    ) {
                        ranges.push({
                            startIndex: pe.startIndex,
                            endIndex: pe.endIndex,
                        })
                    }
                }
            } else if (element.table) {
                for (const row of element.table.tableRows ?? []) {
                    for (const cell of row.tableCells ?? []) {
                        visitContent(cell.content)
                    }
                }
            }
        }
    }

    visitContent(document.body?.content)
    return ranges
}

export function rangesIntersect(a: SourceRange, b: SourceRange): boolean {
    return a.startIndex < b.endIndex && b.startIndex < a.endIndex
}
