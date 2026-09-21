/*
 * What "validated" means for a sidecar example.
 *
 * Body snippets are wrapped in a fragment and parsed with the real pipeline
 * (archieToEnriched); whole documents are parsed as they are. The pipeline
 * does not validate most front matter — sticky-nav passes through untouched
 * and deprecation-notice parse errors are recorded but transcribed by
 * nobody — so the document checks below spell out exactly which constructs
 * a guide may present as validated. Anything not checked here is not
 * guaranteed.
 */

import {
    GDOC_TEMPLATE_CONTENT_INTERFACES,
    OwidGdocErrorMessageType,
    OwidGdocType,
    type OwidEnrichedGdocBlock,
    type OwidGdocPostContent,
    type SidecarExample,
} from "@ourworldindata/types"
import { getParseFindings } from "@ourworldindata/utils"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"

interface ParsedDocument {
    type?: unknown
    body?: OwidEnrichedGdocBlock[]
    refs?: OwidGdocPostContent["refs"]
    "sticky-nav"?: unknown
    "deprecation-notice"?: unknown
    [key: string]: unknown
}

// The pipeline synthesises these front-matter keys itself rather than
// reading them from what the author wrote, so they never appear in a
// type's content-interface key kinds and must be exempt from the
// unknown-key check below:
//   - `refs`: archieToEnriched always sets `parsed.refs = parsedRefs`
//     (db/model/Gdoc/archieToEnriched.ts, around line 275)
//   - `byline`: read as a legacy fallback for `authors`
//     (db/model/Gdoc/archieToEnriched.ts, around line 281)
const IGNORED_PARSER_KEYS = new Set(["refs", "byline"])

function parse(archie: string): { content?: ParsedDocument; error?: string } {
    try {
        return {
            content: archieToEnriched(archie) as unknown as ParsedDocument,
        }
    } catch (error) {
        return { error: "failed to parse — " + String(error) }
    }
}

function parseErrorFindings(content: ParsedDocument): string[] {
    return getParseFindings({ body: content.body, refs: content.refs })
        .filter((finding) => finding.type === OwidGdocErrorMessageType.Error)
        .map((finding) => finding.property + ": " + finding.message)
}

/** A body-level snippet: wrapped in a fragment, must parse to ≥1 clean block */
export function validateBodyExample(archie: string): string[] {
    const wrapped =
        "title: Example\ntype: fragment\n[+body]\n" + archie + "\n[]\n"
    const { content, error } = parse(wrapped)
    if (!content) return [error ?? "failed to parse"]
    const failures = parseErrorFindings(content)
    if (failures.length > 0) return failures
    // Parsing can't catch an example that vanishes entirely — e.g. [socials]
    // instead of [.socials] inside [+body] is silently dropped by the parser.
    if ((content.body ?? []).length === 0)
        return [
            "parsed to zero body blocks — the example is silently dropped by the parser",
        ]
    return []
}

function checkStickyNav(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0)
        return ["sticky-nav must be a non-empty [.sticky-nav] array"]
    const failures: string[] = []
    value.forEach((entry, index) => {
        const label = "sticky-nav[" + index + "]"
        if (typeof entry !== "object" || entry === null) {
            failures.push(label + " must be a target + text pair")
            return
        }
        const { target, text } = entry as Record<string, unknown>
        if (typeof target !== "string" || !target.startsWith("#"))
            failures.push(label + ".target must be an anchor starting with #")
        if (typeof text !== "string" || text.trim().length === 0)
            failures.push(label + ".text must be a non-empty string")
    })
    return failures
}

function checkDeprecationNotice(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0)
        return ["deprecation-notice must be a non-empty block of paragraphs"]
    const failures: string[] = []
    for (const block of value as OwidEnrichedGdocBlock[]) {
        if (block.type !== "text")
            failures.push(
                "deprecation-notice: only text paragraphs are allowed, got [" +
                    block.type +
                    "]"
            )
        for (const parseError of block.parseErrors ?? [])
            if (!parseError.isWarning)
                failures.push("deprecation-notice: " + parseError.message)
    }
    return failures
}

/**
 * A whole document, front matter included. Passes when: it parses, `type`
 * names a documented template, body and refs report no parse error, the
 * deprecation notice (if any) is clean paragraphs, the sticky nav (if any)
 * is well-formed, every top-level key is a field of the type's content
 * interface, and the body is non-empty.
 */
export function validateDocumentExample(archie: string): string[] {
    const { content, error } = parse(archie)
    if (!content) return [error ?? "failed to parse"]

    const { type } = content
    if (typeof type !== "string") return ["document has no known type: key"]
    if (!Object.values(OwidGdocType).includes(type as OwidGdocType))
        return ['unknown type "' + type + '"']
    const template = (
        GDOC_TEMPLATE_CONTENT_INTERFACES as Record<
            string,
            { keyKinds: Record<string, string> } | undefined
        >
    )[type]
    if (!template)
        return [
            'type "' +
                type +
                '" has no documented template yet — document examples ' +
                "are limited to types with a template sidecar",
        ]

    const failures = parseErrorFindings(content)
    for (const key of Object.keys(content)) {
        if (IGNORED_PARSER_KEYS.has(key)) continue
        if (!(key in template.keyKinds))
            failures.push(
                'unknown front-matter key "' +
                    key +
                    '" for type ' +
                    type +
                    " — not a field of its content interface"
            )
    }
    if (content["deprecation-notice"] !== undefined)
        failures.push(...checkDeprecationNotice(content["deprecation-notice"]))
    if (content["sticky-nav"] !== undefined)
        failures.push(...checkStickyNav(content["sticky-nav"]))
    if ((content.body ?? []).length === 0)
        failures.push("document has no body — add a [+body] … [] block")
    return failures
}

export function validateExample(example: SidecarExample): string[] {
    return example.flavour === "archie-document"
        ? validateDocumentExample(example.archie)
        : validateBodyExample(example.archie)
}
