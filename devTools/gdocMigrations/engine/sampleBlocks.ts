import { SourceLine } from "../types.js"
import { PropertyLine, ScanResult } from "./scopeScanner.js"

/**
 * A snippet of real ArchieML copied out of a source doc, to be written into
 * a migration test doc. Lines carry gdocToArchie's span markup (<a href>,
 * <b>, …) so the writer re-creates the original styling. `shape` summarizes
 * the snippet's structure so that one sample per distinct shape can be kept.
 */
export interface Sample {
    sourceGdocId: string
    lines: string[]
    shape: string
}

export type SampleSkipReason =
    | "contains-chip"
    | "contains-inline-object"
    | "non-paragraph-lines"

export interface SampleCollection {
    samples: Sample[]
    skipped: Record<SampleSkipReason, number>
}

function emptySkips(): Record<SampleSkipReason, number> {
    return {
        "contains-chip": 0,
        "contains-inline-object": 0,
        "non-paragraph-lines": 0,
    }
}

/**
 * Only 1:1 paragraph lines can be re-created faithfully through the Docs
 * API; bullets, headings, tables, and smart chips would come back as
 * something else, so snippets containing them are skipped.
 */
function unreproducibleReason(lines: SourceLine[]): SampleSkipReason | null {
    if (lines.some((line) => line.containsChip)) return "contains-chip"
    if (lines.some((line) => line.containsInlineObject))
        return "contains-inline-object"
    if (lines.some((line) => line.kind !== "paragraph"))
        return "non-paragraph-lines"
    return null
}

function valueFlags(lines: SourceLine[], property: PropertyLine): string[] {
    const text = lines
        .slice(property.lineIndex, property.extentEndLineIndex + 1)
        .map((line) => line.text)
        .join("\n")
    const flags: string[] = []
    if (property.multiline) flags.push("multiline")
    if (/<a\s/i.test(text)) flags.push("link")
    if (/<(b|i|u|s|sup|sub)>/i.test(text)) flags.push("styled")
    if (!/:\s*\S/.test(lines[property.lineIndex].text) && !property.multiline)
        flags.push("empty")
    return flags
}

function propertyShape(lines: SourceLine[], property: PropertyLine): string {
    const flags = valueFlags(lines, property)
    return flags.length > 0
        ? `${property.key}[${flags.join(",")}]`
        : property.key
}

/**
 * Collects every {.blockType} block of the doc as a sample, with a shape key
 * built from its direct property names, notable value forms (multi-line,
 * link-styled, bold/italic, empty) and any nested block types.
 */
export function collectBlockSamples(
    sourceGdocId: string,
    lines: SourceLine[],
    scan: ScanResult,
    blockType: string
): SampleCollection {
    const samples: Sample[] = []
    const skipped = emptySkips()

    for (const block of scan.blocks) {
        if (block.type !== blockType) continue
        const blockLines = lines.slice(
            block.openLineIndex,
            block.closeLineIndex + 1
        )
        const reason = unreproducibleReason(blockLines)
        if (reason) {
            skipped[reason]++
            continue
        }
        const nested = scan.blocks
            .filter(
                (other) =>
                    other !== block &&
                    other.openLineIndex > block.openLineIndex &&
                    other.closeLineIndex < block.closeLineIndex
            )
            .map((other) => `{.${other.type}}`)
        const shape = [
            ...block.properties
                .map((property) => propertyShape(lines, property))
                .sort(),
            ...[...new Set(nested)].sort(),
        ].join(" ")
        samples.push({
            sourceGdocId,
            lines: blockLines.map((line) => line.text),
            shape,
        })
    }
    return { samples, skipped }
}

/**
 * Collects the doc's top-level frontmatter lines for the given keys
 * (case-insensitively, as the parser does), one sample per key occurrence.
 */
export function collectFrontmatterSamples(
    sourceGdocId: string,
    lines: SourceLine[],
    scan: ScanResult,
    keys: string[]
): SampleCollection {
    const wanted = new Set(keys.map((key) => key.toLowerCase()))
    const samples: Sample[] = []
    const skipped = emptySkips()

    for (const property of scan.frontmatter) {
        if (!wanted.has(property.key.toLowerCase())) continue
        const propertyLines = lines.slice(
            property.lineIndex,
            property.extentEndLineIndex + 1
        )
        const reason = unreproducibleReason(propertyLines)
        if (reason) {
            skipped[reason]++
            continue
        }
        samples.push({
            sourceGdocId,
            lines: propertyLines.map((line) => line.text),
            shape: propertyShape(lines, property),
        })
    }
    return { samples, skipped }
}

/** Keeps the first sample of each distinct shape, up to `max` */
export function dedupeSamples(samples: Sample[], max: number): Sample[] {
    const seen = new Set<string>()
    const kept: Sample[] = []
    for (const sample of samples) {
        if (seen.has(sample.shape)) continue
        seen.add(sample.shape)
        kept.push(sample)
        if (kept.length >= max) break
    }
    return kept
}
