import * as _ from "lodash-es"
import { type docs_v1 } from "@googleapis/docs"
import {
    paragraphToString,
    tableToString,
} from "../../../db/model/Gdoc/gdocToArchie.js"
import { SourceLine, SourceRun } from "../types.js"

/**
 * A source-mapped variant of gdocToArchie: converts a Google Doc to the same
 * ArchieML text (it delegates to the exact same conversion functions), but
 * emits individual lines annotated with the doc character ranges they came
 * from, so that surgical batchUpdate edits can be computed against them.
 *
 * Invariant (covered by tests): joinSourceLines(gdocToSourceMappedLines(doc))
 * equals gdocToArchie(doc).text for any document.
 */
export function gdocToSourceMappedLines(
    document: docs_v1.Schema$Document
): SourceLine[] {
    const lines: SourceLine[] = []
    const context = { isInList: false, isInTable: false }
    const content = document.body?.content
    if (!content) return lines

    for (const element of content) {
        if (element.paragraph) {
            const wasInList = context.isInList
            const chunk = paragraphToString(element.paragraph, context)
            lines.push(
                ...chunkToSourceLines(
                    chunk,
                    element,
                    element.paragraph,
                    wasInList
                )
            )
        } else if (element.table) {
            // gdocToArchie skips tables that aren't preceded by a {.table} tag
            if (context.isInTable) {
                const chunk = tableToString(element.table)
                lines.push(...allLinesDerived(chunk, element))
            }
        }
    }
    return lines
}

/** Reassembles the exact text that gdocToArchie would produce */
export function joinSourceLines(lines: SourceLine[]): string {
    return lines.map((line) => `${line.text}\n`).join("")
}

function elementRange(
    element: docs_v1.Schema$StructuralElement
): { startIndex: number; endIndex: number } | null {
    if (_.isNil(element.startIndex) || _.isNil(element.endIndex)) return null
    return { startIndex: element.startIndex, endIndex: element.endIndex }
}

/**
 * Splits a chunk of converted text into lines. Chunks normally end with a
 * newline; if one doesn't (unexpected), the trailing partial line is
 * returned too and the caller treats the chunk as unpatchable.
 */
function splitChunk(chunk: string): { lines: string[]; clean: boolean } {
    const segments = chunk.split("\n")
    const clean = segments[segments.length - 1] === ""
    if (clean) segments.pop()
    return { lines: segments, clean }
}

function makeLine(
    text: string,
    kind: SourceLine["kind"],
    range: SourceLine["range"],
    runs: SourceRun[] = [],
    containsChip = false,
    containsInlineObject = false
): SourceLine {
    return { text, kind, range, runs, containsChip, containsInlineObject }
}

function allLinesDerived(
    chunk: string,
    element: docs_v1.Schema$StructuralElement
): SourceLine[] {
    const range = elementRange(element)
    return splitChunk(chunk).lines.map((text) =>
        makeLine(text, "derived", range)
    )
}

function chunkToSourceLines(
    chunk: string,
    element: docs_v1.Schema$StructuralElement,
    paragraph: docs_v1.Schema$Paragraph,
    wasInList: boolean
): SourceLine[] {
    if (chunk === "") return []

    const { lines: segments, clean } = splitChunk(chunk)
    const range = elementRange(element)

    // Mirror the list-wrapper prefixes that paragraphToString prepends. These
    // lines are fabricated — they have no counterpart in the doc.
    const needsBullet = !_.isNil(paragraph.bullet)
    const expectedPrefix =
        needsBullet && !wasInList
            ? ["", "[.list]"]
            : !needsBullet && wasInList
              ? ["[]"]
              : []
    const prefixMatches = expectedPrefix.every(
        (text, i) => segments[i] === text
    )

    // If our understanding of the chunk's shape is wrong (future drift in
    // paragraphToString), keep the text intact but mark everything derived so
    // the patcher fails closed rather than editing misattributed ranges.
    if (!clean || !prefixMatches) {
        return segments.map((text) => makeLine(text, "derived", range))
    }

    const prefixLines = expectedPrefix.map((text) =>
        makeLine(text, "synthetic", null)
    )
    const contentSegments = segments.slice(expectedPrefix.length)

    const isHeading =
        paragraph.paragraphStyle?.namedStyleType?.includes("HEADING") ?? false
    const elements = paragraph.elements ?? []
    const hasHorizontalRule = elements.some((el) => el.horizontalRule)
    const containsChip = elements.some((el) => el.richLink)
    const containsInlineObject = elements.some((el) => el.inlineObjectElement)
    const hasOpaqueElement = elements.some(
        (el) =>
            !el.textRun &&
            !el.richLink &&
            !el.horizontalRule &&
            !el.inlineObjectElement
    )

    const runs: SourceRun[] = []
    let runsComplete = true
    for (const el of elements) {
        if (!el.textRun) continue
        if (_.isNil(el.startIndex) || _.isNil(el.endIndex)) {
            runsComplete = false
            break
        }
        runs.push({
            content: el.textRun.content ?? "",
            startIndex: el.startIndex,
            endIndex: el.endIndex,
        })
    }

    // A patchable paragraph line must be exactly one line of plain
    // (textRun/richLink/image) content with reliable ranges. Everything else
    // — headings and horizontal rules (which expand into multi-line ArchieML
    // blocks), bullet lines (whose "* " prefix is fabricated), and paragraphs
    // containing elements we don't understand — is derived: its text is
    // faithful but it cannot be line-patched.
    const isPatchable =
        !isHeading &&
        !hasHorizontalRule &&
        !needsBullet &&
        !hasOpaqueElement &&
        runsComplete &&
        range !== null &&
        contentSegments.length === 1

    const contentLines = isPatchable
        ? [
              makeLine(
                  contentSegments[0],
                  "paragraph",
                  range,
                  runs,
                  containsChip,
                  containsInlineObject
              ),
          ]
        : contentSegments.map((text) =>
              makeLine(
                  text,
                  "derived",
                  range,
                  [],
                  containsChip,
                  containsInlineObject
              )
          )

    return [...prefixLines, ...contentLines]
}
