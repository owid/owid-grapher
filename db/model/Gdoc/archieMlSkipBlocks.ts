// Handling of ArchieML's :skip/:endskip and :ignore directives for the
// wholesale-replace write path.
//
// Content inside these directives is invisible to the enriched model (the
// parser discards it), so a canonical write-back cannot re-emit it. Blocks at
// the very start or very end of a document have stable anchors and can be
// preserved verbatim around the canonicalized core; a :skip block in the
// middle of the document has no stable anchor after canonicalization, so the
// caller should refuse rather than silently destroy hidden content.

const SKIP_START = /^[ \t\r]*:[ \t\r]*skip\b/i
const SKIP_END = /^[ \t\r]*:[ \t\r]*endskip\b/i
const IGNORE = /^[ \t\r]*:[ \t\r]*ignore\b/i
const BLANK = /^[ \t\r]*$/

export interface ArchieMlSkipSegments {
    /** Leading :skip…:endskip block(s), verbatim (empty if none) */
    prefix: string
    /** The parseable middle of the document */
    core: string
    /**
     * Trailing :skip…:endskip block(s), an :ignore (which by definition runs
     * to the end of the document), or an unterminated :skip — verbatim.
     */
    suffix: string
    /** 1-based line numbers of :skip/:endskip directives inside the core */
    midDocumentDirectiveLines: number[]
}

export function splitArchieMlSkipSegments(text: string): ArchieMlSkipSegments {
    const lines = text.split("\n")

    // :ignore and an unterminated :skip both run to the end of the document,
    // so the earliest of them starts the suffix.
    let tailStart = lines.length
    for (let i = 0; i < lines.length; i++) {
        if (IGNORE.test(lines[i])) {
            tailStart = i
            break
        }
        if (
            SKIP_START.test(lines[i]) &&
            !lines.slice(i + 1).some((l) => SKIP_END.test(l))
        ) {
            tailStart = i
            break
        }
    }

    // Leading complete :skip…:endskip blocks (with any blank lines between)
    let coreStart = 0
    for (;;) {
        let i = coreStart
        while (i < tailStart && BLANK.test(lines[i])) i++
        if (i >= tailStart || !SKIP_START.test(lines[i])) break
        const end = lines.findIndex((l, j) => j > i && SKIP_END.test(l))
        if (end === -1 || end >= tailStart) break
        coreStart = end + 1
    }

    // Trailing complete :skip…:endskip blocks just before the tail
    let coreEnd = tailStart // exclusive
    for (;;) {
        let i = coreEnd - 1
        while (i >= coreStart && BLANK.test(lines[i])) i--
        if (i < coreStart || !SKIP_END.test(lines[i])) break
        let start = -1
        for (let j = i - 1; j >= coreStart; j--) {
            if (SKIP_START.test(lines[j])) {
                start = j
                break
            }
            if (SKIP_END.test(lines[j])) break
        }
        if (start === -1) break
        coreEnd = start
    }

    const midDocumentDirectiveLines: number[] = []
    for (let i = coreStart; i < coreEnd; i++) {
        if (SKIP_START.test(lines[i]) || SKIP_END.test(lines[i]))
            midDocumentDirectiveLines.push(i + 1)
    }

    return {
        prefix: lines.slice(0, coreStart).join("\n"),
        core: lines.slice(coreStart, coreEnd).join("\n"),
        suffix: lines.slice(coreEnd).join("\n"),
        midDocumentDirectiveLines,
    }
}

/** Re-attach preserved skip segments around a canonicalized core. */
export function joinArchieMlSkipSegments(
    segments: Pick<ArchieMlSkipSegments, "prefix" | "suffix">,
    canonicalCore: string
): string {
    return [segments.prefix, canonicalCore, segments.suffix]
        .filter((s) => s.trim() !== "")
        .join("\n")
}
