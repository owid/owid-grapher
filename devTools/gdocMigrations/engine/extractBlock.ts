import { load } from "archieml"
import { RawBlockJson, SourceLine } from "../types.js"
import { BlockMatch } from "./scopeScanner.js"

/**
 * Parses a matched block's ArchieML lines into a RawBlockJson — the value a
 * migration transform receives. Returns null when the block doesn't parse to
 * an object (e.g. an empty or malformed block), which callers treat as
 * "no match here".
 */
export function extractRawBlock(
    lines: SourceLine[],
    match: BlockMatch
): RawBlockJson | null {
    const text = lines
        .slice(match.openLineIndex, match.closeLineIndex + 1)
        .map((line) => line.text)
        .join("\n")
    const parsed = load(text) as Record<string, unknown>
    const value = parsed?.[match.type]
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return { type: match.type, value: value as Record<string, unknown> }
}
