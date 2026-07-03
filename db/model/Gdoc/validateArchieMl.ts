import * as _ from "lodash-es"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocPostContent,
    OwidGdocType,
} from "@ourworldindata/types"
import { getParseFindings } from "@ourworldindata/utils"
import { archieToEnriched } from "./archieToEnriched.js"
import { owidArticleToArchieMLStringGenerator } from "./archieToGdoc.js"

export interface ArchieMlValidationResult {
    valid: boolean
    errors: OwidGdocErrorMessage[]
    warnings: OwidGdocErrorMessage[]
    /** Present when the parse itself succeeded (even if block errors exist). */
    content?: OwidGdocPostContent
}

/**
 * Gdoc types whose content the ArchieML write-back layer
 * (owidArticleToArchieMLStringGenerator) knows how to serialize.
 */
export const ARCHIE_WRITABLE_GDOC_TYPES: OwidGdocType[] = [
    OwidGdocType.Article,
    OwidGdocType.TopicPage,
    OwidGdocType.LinearTopicPage,
    OwidGdocType.Fragment,
    OwidGdocType.DataInsight,
]

/** Strip undefined object properties on both sides of a deep comparison. */
const normalizeForComparison = (value: unknown): unknown =>
    JSON.parse(JSON.stringify(value ?? null))

// The parse of a real gdoc can contain empty text blocks (e.g. from stray
// formatting in the doc). They render as nothing, and the write-back emits
// nothing for them, so the re-parse legitimately drops them. Strip them
// before the fixed-point comparison so this canonicalization does not count
// as content loss.
const withoutEmptyTextBlocks = (
    blocks: OwidGdocPostContent["body"]
): OwidGdocPostContent["body"] =>
    blocks?.filter((b) => !(b.type === "text" && b.value.length === 0))

// Inline refs are keyed by a sha1 of their *raw* source bytes, which a
// write-back can only reproduce canonically (e.g. a dod link re-emitted in
// its short form, or blank paragraphs dropped). The content itself is still
// compared in full at its footnote index, so the regenerated hash key is
// noise — replace hash-shaped ids with a placeholder. Author-chosen ids
// (ID-based refs) are kept and must survive the round trip.
const CONTENT_HASH_ID = /^[0-9a-f]{40}$/

const normalizeRefDefinitions = (
    definitions:
        | NonNullable<OwidGdocPostContent["refs"]>["definitions"]
        | undefined
): unknown =>
    Object.values(definitions ?? {})
        .map((ref) => ({
            ...ref,
            id: CONTENT_HASH_ID.test(ref.id) ? "<content-hash>" : ref.id,
            content: withoutEmptyTextBlocks(ref.content),
        }))
        .sort((a, b) => a.index - b.index)

export interface ArchieMlContentComparison {
    identical: boolean
    /** Indices (in the empty-block-stripped body) of blocks that differ */
    differingBodyBlocks: number[]
    refsMatch: boolean
}

/**
 * Semantic equality of two parsed documents, with the tolerances a canonical
 * round trip is allowed: empty text blocks are ignored and inline-ref content
 * hashes are treated as opaque. Used both by the fixed-point check below and
 * by the write endpoint's post-write read-back verification.
 */
export function compareArchieMlContent(
    expected: OwidGdocPostContent,
    actual: OwidGdocPostContent
): ArchieMlContentComparison {
    const a = withoutEmptyTextBlocks(expected.body) ?? []
    const b = withoutEmptyTextBlocks(actual.body) ?? []
    const differingBodyBlocks: number[] = []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (
            !_.isEqual(
                normalizeForComparison(a[i]),
                normalizeForComparison(b[i])
            )
        )
            differingBodyBlocks.push(i)
    }
    const refsMatch = _.isEqual(
        normalizeForComparison(
            normalizeRefDefinitions(expected.refs?.definitions)
        ),
        normalizeForComparison(
            normalizeRefDefinitions(actual.refs?.definitions)
        )
    )
    return {
        identical: differingBodyBlocks.length === 0 && refsMatch,
        differingBodyBlocks,
        refsMatch,
    }
}

function collectParseErrors(
    content: OwidGdocPostContent,
    errors: OwidGdocErrorMessage[],
    warnings: OwidGdocErrorMessage[]
): void {
    for (const finding of getParseFindings(content)) {
        const target =
            finding.type === OwidGdocErrorMessageType.Warning
                ? warnings
                : errors
        target.push(finding)
    }
}

/**
 * Validate an ArchieML document against the real gdoc ingestion pipeline.
 *
 * Composes existing primitives into the single gate used by the admin API
 * (and, via the round-trip tests, exercised on every CI run):
 *   1. `archieToEnriched` — throws on unknown block types; a throw becomes a
 *      single error.
 *   2. Collect the non-fatal `parseErrors` attached to blocks (body and ref
 *      contents), split into errors and warnings.
 *   3. Fixed point: serialize the parsed content back to ArchieML and re-parse
 *      it. ArchieML's `load()` never errors — a typo'd marker or unclosed tag
 *      silently swallows content — so a mismatch here is the only signal that
 *      content was dropped or mangled.
 *   4. `content.type` must be a type the write-back layer knows how to
 *      serialize (see ARCHIE_WRITABLE_GDOC_TYPES). Disable with
 *      `requireType: false` (e.g. for fragments under test).
 */
export function validateArchieMl(
    text: string,
    { requireType = true }: { requireType?: boolean } = {}
): ArchieMlValidationResult {
    const errors: OwidGdocErrorMessage[] = []
    const warnings: OwidGdocErrorMessage[] = []

    let content: OwidGdocPostContent
    try {
        content = archieToEnriched(text)
    } catch (error) {
        errors.push({
            property: "body",
            type: OwidGdocErrorMessageType.Error,
            message: `The document failed to parse: ${
                error instanceof Error ? error.message : String(error)
            }`,
        })
        return { valid: false, errors, warnings }
    }

    collectParseErrors(content, errors, warnings)

    if (
        requireType &&
        (!content.type || !ARCHIE_WRITABLE_GDOC_TYPES.includes(content.type))
    ) {
        errors.push({
            property: "type",
            type: OwidGdocErrorMessageType.Error,
            message: content.type
                ? `Gdoc type "${content.type}" is not supported by the ArchieML write-back layer. Supported types: ${ARCHIE_WRITABLE_GDOC_TYPES.join(", ")}.`
                : `The document is missing a "type" front-matter field. Supported types: ${ARCHIE_WRITABLE_GDOC_TYPES.join(", ")}.`,
        })
    }

    // Fixed-point check: writing the parsed content back to ArchieML and
    // re-parsing it must reproduce the same content.
    try {
        const canonicalArchieMl = [
            ...owidArticleToArchieMLStringGenerator(content),
        ].join("\n")
        const reparsed = archieToEnriched(canonicalArchieMl)
        if (!compareArchieMlContent(content, reparsed).identical) {
            errors.push({
                property: "body",
                type: OwidGdocErrorMessageType.Error,
                message:
                    "The document does not round-trip cleanly: some content is " +
                    "silently dropped or altered when it is written back to " +
                    "ArchieML (e.g. an unclosed [.list] tag or a malformed " +
                    "block marker). Compare your input against the parsed result.",
            })
        }
    } catch (error) {
        errors.push({
            property: "body",
            type: OwidGdocErrorMessageType.Error,
            message: `The document parses, but its canonical write-back form does not: ${
                error instanceof Error ? error.message : String(error)
            }`,
        })
    }

    return { valid: errors.length === 0, errors, warnings, content }
}
