import { Span, SpanCallout } from "@ourworldindata/types"

// A "run" is the flat, mark-based representation of inline content that
// ProseMirror uses: a sequence of leaf items, each carrying the full set of
// formatting marks that apply to it. Enriched spans are a tree instead
// (formatting spans nest arbitrarily), so converting between the two
// representations is inherently normalizing: nesting order is lost and
// adjacent equally-formatted text merges. The round-trip guarantee we uphold
// is therefore "equal after flattening to runs", not byte-identical span
// trees.

export type RunMarkType =
    | "bold"
    | "italic"
    | "underline"
    | "subscript"
    | "superscript"
    | "spanQuote"
    | "spanFallback"
    | "link"
    | "ref"
    | "dod"
    | "guidedChartLink"

export interface RunMark {
    type: RunMarkType
    url?: string
    id?: string
}

export type SpanRun =
    | { kind: "text"; text: string; marks: RunMark[] }
    | { kind: "newline"; marks: RunMark[] }
    | { kind: "callout"; span: SpanCallout; marks: RunMark[] }

// Outermost-first order in which marks are nested when rebuilding a span tree.
const MARK_ORDER: RunMarkType[] = [
    "ref",
    "link",
    "guidedChartLink",
    "dod",
    "spanQuote",
    "spanFallback",
    "bold",
    "italic",
    "underline",
    "subscript",
    "superscript",
]

export function runMarksEqual(a: RunMark, b: RunMark): boolean {
    return a.type === b.type && a.url === b.url && a.id === b.id
}

function markOrderIndex(mark: RunMark): number {
    return MARK_ORDER.indexOf(mark.type)
}

function sortMarks(marks: RunMark[]): RunMark[] {
    return [...marks].sort((a, b) => markOrderIndex(a) - markOrderIndex(b))
}

function spanToMark(span: Span): RunMark | undefined {
    switch (span.spanType) {
        case "span-bold":
            return { type: "bold" }
        case "span-italic":
            return { type: "italic" }
        case "span-underline":
            return { type: "underline" }
        case "span-subscript":
            return { type: "subscript" }
        case "span-superscript":
            return { type: "superscript" }
        case "span-quote":
            return { type: "spanQuote" }
        case "span-fallback":
            return { type: "spanFallback" }
        case "span-link":
            return { type: "link", url: span.url }
        case "span-ref":
            return { type: "ref", url: span.url }
        case "span-dod":
            return { type: "dod", id: span.id }
        case "span-guided-chart-link":
            return { type: "guidedChartLink", url: span.url }
        default:
            return undefined
    }
}

function markToSpan(mark: RunMark, children: Span[]): Span {
    switch (mark.type) {
        case "bold":
            return { spanType: "span-bold", children }
        case "italic":
            return { spanType: "span-italic", children }
        case "underline":
            return { spanType: "span-underline", children }
        case "subscript":
            return { spanType: "span-subscript", children }
        case "superscript":
            return { spanType: "span-superscript", children }
        case "spanQuote":
            return { spanType: "span-quote", children }
        case "spanFallback":
            return { spanType: "span-fallback", children }
        case "link":
            return { spanType: "span-link", url: mark.url ?? "", children }
        case "ref":
            return { spanType: "span-ref", url: mark.url ?? "", children }
        case "dod":
            return { spanType: "span-dod", id: mark.id ?? "", children }
        case "guidedChartLink":
            return {
                spanType: "span-guided-chart-link",
                url: mark.url ?? "",
                children,
            }
    }
}

/** Flatten a span tree into runs, merging adjacent equally-marked text. */
export function spanTreeToRuns(spans: Span[]): SpanRun[] {
    const runs: SpanRun[] = []

    const pushTextRun = (text: string, marks: RunMark[]): void => {
        if (text === "") return
        const last = runs[runs.length - 1]
        if (
            last &&
            last.kind === "text" &&
            last.marks.length === marks.length &&
            last.marks.every((m, i) => runMarksEqual(m, marks[i]))
        ) {
            last.text += text
        } else {
            runs.push({ kind: "text", text, marks })
        }
    }

    const walk = (span: Span, marks: RunMark[]): void => {
        switch (span.spanType) {
            case "span-simple-text":
                pushTextRun(span.text, marks)
                return
            case "span-newline":
                runs.push({ kind: "newline", marks })
                return
            case "span-callout":
                runs.push({
                    kind: "callout",
                    span: structuredClone(span),
                    marks,
                })
                return
            default: {
                const mark = spanToMark(span)
                const childMarks =
                    mark && !marks.some((m) => runMarksEqual(m, mark))
                        ? sortMarks([...marks, mark])
                        : marks
                for (const child of span.children ?? []) walk(child, childMarks)
            }
        }
    }

    for (const span of spans) walk(span, [])
    return runs
}

/** Rebuild a (canonically nested) span tree from runs. */
export function runsToSpanTree(runs: SpanRun[]): Span[] {
    const out: Span[] = []

    const pushLeaf = (run: SpanRun): void => {
        if (run.kind === "text") {
            const last = out[out.length - 1]
            if (last && last.spanType === "span-simple-text") {
                last.text += run.text
            } else {
                out.push({ spanType: "span-simple-text", text: run.text })
            }
        } else if (run.kind === "newline") {
            out.push({ spanType: "span-newline" })
        } else {
            out.push(structuredClone(run.span))
        }
    }

    let i = 0
    while (i < runs.length) {
        const run = runs[i]
        if (run.marks.length === 0) {
            pushLeaf(run)
            i += 1
            continue
        }
        const outer = sortMarks(run.marks)[0]
        let j = i
        while (
            j < runs.length &&
            runs[j].marks.some((m) => runMarksEqual(m, outer))
        ) {
            j += 1
        }
        const inner = runs.slice(i, j).map(
            (r): SpanRun => ({
                ...r,
                marks: r.marks.filter((m) => !runMarksEqual(m, outer)),
            })
        )
        out.push(markToSpan(outer, runsToSpanTree(inner)))
        i = j
    }
    return out
}
