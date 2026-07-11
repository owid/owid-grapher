import * as _ from "lodash-es"
import {
    getContentKeysForGdocType,
    OWID_GDOC_BASE_ROW_KEYS,
    OWID_GDOC_POST_CONTENT_KEYS,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageProperty,
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
    OwidGdocType.Announcement,
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

const frontMatterKeys = (content: OwidGdocPostContent): string[] =>
    Object.keys(content).filter((key) => key !== "body" && key !== "refs")

export interface ArchieMlContentComparison {
    identical: boolean
    /** Indices (in the empty-block-stripped body) of blocks that differ */
    differingBodyBlocks: number[]
    refsMatch: boolean
    /** Top-level keys (other than body/refs) that are dropped or altered */
    differingFrontMatterKeys: string[]
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
    const expectedByKey = expected as unknown as Record<string, unknown>
    const actualByKey = actual as unknown as Record<string, unknown>
    const differingFrontMatterKeys = [
        ...new Set([...frontMatterKeys(expected), ...frontMatterKeys(actual)]),
    ].filter(
        (key) =>
            !_.isEqual(
                normalizeForComparison(expectedByKey[key]),
                normalizeForComparison(actualByKey[key])
            )
    )
    return {
        identical:
            differingBodyBlocks.length === 0 &&
            refsMatch &&
            differingFrontMatterKeys.length === 0,
        differingBodyBlocks,
        refsMatch,
        differingFrontMatterKeys,
    }
}

/**
 * Classify front-matter keys that do not survive the write-back round trip,
 * using the write-back fate classification declared next to the content
 * interfaces (the single source of truth for what the write-back supports).
 */
function collectFrontMatterFindings(
    differingFrontMatterKeys: string[],
    type: OwidGdocType | undefined,
    errors: OwidGdocErrorMessage[],
    warnings: OwidGdocErrorMessage[]
): void {
    const keyFates: Record<string, string> =
        (type && getContentKeysForGdocType(type)) || OWID_GDOC_POST_CONTENT_KEYS
    for (const key of differingFrontMatterKeys) {
        const property = key as OwidGdocErrorMessageProperty
        switch (keyFates[key]) {
            case "unsupported":
                errors.push({
                    property,
                    type: OwidGdocErrorMessageType.Error,
                    message:
                        `The front-matter field "${key}" is not yet supported ` +
                        `by the ArchieML write-back — writing this document ` +
                        `would lose it. Edit this document in Google Docs ` +
                        `directly instead.`,
                })
                break
            case "derived":
                warnings.push({
                    property,
                    type: OwidGdocErrorMessageType.Warning,
                    message:
                        `The front-matter field "${key}" is derived from other ` +
                        `content and regenerated on every parse — the value in ` +
                        `the document is ignored and removed by the write.`,
                })
                break
            case "emitted":
                errors.push({
                    property,
                    type: OwidGdocErrorMessageType.Error,
                    message:
                        `The front-matter field "${key}" does not survive the ` +
                        `write-back round trip — its value would be altered or ` +
                        `lost. Compare your input against the parsed result.`,
                })
                break
            default:
                if (OWID_GDOC_BASE_ROW_KEYS.includes(key)) {
                    // Admin-managed row property (slug, tags, …): dropping it
                    // from the document is correct, so this is only a warning.
                    warnings.push({
                        property,
                        type: OwidGdocErrorMessageType.Warning,
                        message:
                            `"${key}" is not part of the document's content — ` +
                            `it is managed in the admin and will be removed by ` +
                            `the write. Relay requested changes to it to a ` +
                            `human author instead of putting it in the document.`,
                    })
                } else {
                    // A key the schema doesn't know — most often a misspelled
                    // field (e.g. "sutitle"). Dropping it silently would lose
                    // the author's intent, so refuse the write.
                    errors.push({
                        property,
                        type: OwidGdocErrorMessageType.Error,
                        message:
                            `Unrecognized front-matter field "${key}" — it is ` +
                            `not a known field${type ? ` for a ${type}` : ""} ` +
                            `and would be dropped on write. If it is a ` +
                            `misspelling of a real field, fix it; otherwise ` +
                            `remove it.`,
                    })
                }
        }
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
        const comparison = compareArchieMlContent(content, reparsed)
        if (
            comparison.differingBodyBlocks.length > 0 ||
            !comparison.refsMatch
        ) {
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
        collectFrontMatterFindings(
            comparison.differingFrontMatterKeys,
            content.type,
            errors,
            warnings
        )
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
