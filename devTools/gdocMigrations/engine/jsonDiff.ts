import * as _ from "lodash-es"
import { Span, spansToUnformattedPlainText } from "@ourworldindata/utils"

const MAX_VALUE_LENGTH = 60

function isSpanArray(value: unknown): value is Span[] {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every(
            (item) =>
                _.isPlainObject(item) &&
                typeof (item as Record<string, unknown>).spanType === "string"
        )
    )
}

function shortValue(value: unknown): string {
    const text = isSpanArray(value)
        ? JSON.stringify(spansToUnformattedPlainText(value))
        : JSON.stringify(value)
    if (text === undefined) return "undefined"
    return text.length > MAX_VALUE_LENGTH
        ? `${text.slice(0, MAX_VALUE_LENGTH - 1)}…`
        : text
}

export interface JsonDiffLine {
    /** Full description with values, e.g. `$.body[3].url: "a" → "b"` */
    detail: string
    /**
     * Structural summary without values or array indexes, e.g.
     * `$.body[].url: changed`, so equivalent diffs group together
     */
    shape: string
}

function line(path: string, kind: string, detail: string): JsonDiffLine {
    return {
        detail: `${path}: ${detail}`,
        shape: `${path.replace(/\[\d+\]/g, "[]")}: ${kind}`,
    }
}

/**
 * Describes how `after` differs from `before`, one line per changed leaf,
 * with JSONPath-style locations (`$.body[3].caption`). Renames (a removed
 * key and an added key holding an identical value) are reported as a single
 * line. Used by the db-plan report.
 */
export function describeJsonDiff(
    before: unknown,
    after: unknown,
    path = "$"
): JsonDiffLine[] {
    if (_.isEqual(before, after)) return []

    if (_.isPlainObject(before) && _.isPlainObject(after)) {
        const beforeObject = before as Record<string, unknown>
        const afterObject = after as Record<string, unknown>
        const removed = Object.keys(beforeObject).filter(
            (key) => !(key in afterObject)
        )
        const added = Object.keys(afterObject).filter(
            (key) => !(key in beforeObject)
        )
        const lines: JsonDiffLine[] = []
        const renamedFrom = new Set<string>()
        const renamedTo = new Set<string>()
        for (const from of removed) {
            const to = added.find(
                (key) =>
                    !renamedTo.has(key) &&
                    _.isEqual(beforeObject[from], afterObject[key])
            )
            if (to === undefined) continue
            renamedFrom.add(from)
            renamedTo.add(to)
            const rename = `"${from}" → "${to}" (renamed)`
            lines.push(line(path, rename, rename))
        }
        for (const key of removed) {
            if (renamedFrom.has(key)) continue
            lines.push(
                line(
                    `${path}.${key}`,
                    "removed",
                    `removed (was ${shortValue(beforeObject[key])})`
                )
            )
        }
        for (const key of added) {
            if (renamedTo.has(key)) continue
            lines.push(
                line(
                    `${path}.${key}`,
                    "added",
                    `added ${shortValue(afterObject[key])}`
                )
            )
        }
        for (const key of Object.keys(beforeObject)) {
            if (!(key in afterObject)) continue
            lines.push(
                ...describeJsonDiff(
                    beforeObject[key],
                    afterObject[key],
                    `${path}.${key}`
                )
            )
        }
        return lines
    }

    if (Array.isArray(before) && Array.isArray(after)) {
        if (isSpanArray(before) || isSpanArray(after)) {
            return [
                line(
                    path,
                    "changed",
                    `${shortValue(before)} → ${shortValue(after)}`
                ),
            ]
        }
        if (before.length !== after.length) {
            return [
                line(
                    path,
                    "array length changed",
                    `array of ${before.length} → ${after.length} item(s)`
                ),
            ]
        }
        return before.flatMap((item, index) =>
            describeJsonDiff(item, after[index], `${path}[${index}]`)
        )
    }

    return [
        line(path, "changed", `${shortValue(before)} → ${shortValue(after)}`),
    ]
}

/** The distinct shapes of a diff, sorted, for grouping docs */
export function diffShape(lines: JsonDiffLine[]): string[] {
    return [...new Set(lines.map((entry) => entry.shape))].sort()
}
