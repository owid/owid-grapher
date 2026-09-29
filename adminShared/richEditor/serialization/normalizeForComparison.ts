import { Span } from "@ourworldindata/types"
import { SpanRun, spanTreeToRuns } from "./spanRuns.js"

// Normalization used to decide whether two enriched bodies are semantically
// equal. Converting a span tree to ProseMirror and back is inherently
// normalizing (nesting order of formatting spans is lost, adjacent
// equally-formatted text merges, empty text spans disappear), so the
// round-trip guarantee is checked on this normalized form:
//   - span trees are flattened to runs (the mark-based representation)
//   - `parseErrors` are ignored
//   - `undefined`/`null` values are treated as absent
//   - the dummy `value: {}` on horizontal-rule blocks is ignored

function isSpanArray(value: unknown): value is Span[] {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(
            (item) =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as Record<string, unknown>).spanType === "string"
        )
    )
}

function normalizeRun(run: SpanRun): Record<string, unknown> {
    const marks = run.marks.map((mark) => ({
        type: mark.type,
        ...(mark.url !== undefined ? { url: mark.url } : {}),
        ...(mark.id !== undefined ? { id: mark.id } : {}),
    }))
    if (run.kind === "text") return { text: run.text, marks }
    if (run.kind === "newline") return { br: true, marks }
    return {
        callout: {
            functionName: run.span.functionName,
            parameters: run.span.parameters,
            children: normalizeValue(run.span.children),
        },
        marks,
    }
}

export function normalizeValue(value: unknown): unknown {
    if (isSpanArray(value)) {
        return spanTreeToRuns(value).map(normalizeRun)
    }
    if (Array.isArray(value)) {
        return value.map(normalizeValue)
    }
    if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>
        const out: Record<string, unknown> = {}
        const isEnrichedBlock =
            typeof record.type === "string" && Array.isArray(record.parseErrors)
        for (const key of Object.keys(record)) {
            if (key === "parseErrors") continue
            // editor-assigned block identity is not content
            if (key === "id" && isEnrichedBlock) continue
            if (
                key === "value" &&
                record.type === "horizontal-rule" &&
                typeof record.value === "object"
            ) {
                continue
            }
            // `false` and absent are semantically identical for these image
            // flags; stored content predating the props omits them
            if (
                record.type === "image" &&
                (key === "hasOutline" || key === "preferSmallFilename") &&
                record[key] === false
            ) {
                continue
            }
            const normalized = normalizeValue(record[key])
            if (normalized === undefined || normalized === null) continue
            out[key] = normalized
        }
        return out
    }
    return value
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`
    }
    if (typeof value === "object" && value !== null) {
        const record = value as Record<string, unknown>
        const keys = Object.keys(record).sort()
        const entries = keys.map(
            (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`
        )
        return `{${entries.join(",")}}`
    }
    return JSON.stringify(value) ?? "null"
}

export function normalizedBodyKey(body: unknown): string {
    return stableStringify(normalizeValue(body))
}

/** Semantic equality of two enriched bodies (see normalization rules above). */
export function enrichedBodiesMatch(a: unknown, b: unknown): boolean {
    return normalizedBodyKey(a) === normalizedBodyKey(b)
}
