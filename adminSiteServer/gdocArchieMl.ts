// Shared building blocks for the agent ArchieML endpoints
// (GET/PUT /gdocs/:id/archieml and POST /gdocs/archieml): the checks a text
// must pass before it is written to Google, the read-back comparison and the
// doc report.

import { docs as googleDocs } from "@googleapis/docs"
import { archieToEnriched, gdocToArchie } from "@ourworldindata/gdoc-pipeline"
import {
    JsonError,
    type OwidGdocBaseInterface,
    type OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/types"
import { checkIsOwidGdocType } from "@ourworldindata/utils"
import { getErrors } from "../adminSiteClient/gdocsValidation.js"
import * as db from "../db/db.js"
import { OwidGoogleAuth } from "../db/OwidGoogleAuth.js"
import {
    type AnyGdoc,
    loadGdocFromGdocBase,
} from "../db/model/Gdoc/GdocFactory.js"

export interface UnwritableCharacter {
    /** 1-based line number */
    line: number
    /** The character as a code point, e.g. "U+000D" */
    codePoint: string
}

export interface ReadBack {
    match: boolean
    /** 1-based number of the first line that differs */
    line?: number
    /** That line in the sent text; absent when the sent text has fewer lines */
    sent?: string
    /** That line in the stored text; absent when the stored text has fewer lines */
    stored?: string
}

export interface DocReport {
    errors: OwidGdocErrorMessage[]
    warnings: OwidGdocErrorMessage[]
}

// Characters Google strips when inserting text: \r, the C0 controls except
// tab (U+0009), \n (U+000A) and \v (U+000B, Google's soft line break), and the
// Private Use Area. Compared as numbers, because the formatter rewrites
// Private Use Area escapes into invisible literal characters.
function isUnwritableCodePoint(codePoint: number): boolean {
    return (
        codePoint <= 0x0008 ||
        (codePoint >= 0x000c && codePoint <= 0x001f) ||
        (codePoint >= 0xe000 && codePoint <= 0xf8ff)
    )
}

function formatCodePoint(codePoint: number): string {
    return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`
}

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/** The first character Google would strip on insert, if any. */
export function findUnwritableCharacter(
    text: string
): UnwritableCharacter | undefined {
    const lines = text.split("\n")
    for (let i = 0; i < lines.length; i++) {
        for (const character of lines[i]) {
            const codePoint = character.codePointAt(0)!
            if (isUnwritableCodePoint(codePoint))
                return { line: i + 1, codePoint: formatCodePoint(codePoint) }
        }
    }
    return undefined
}

// Loose on purpose: Google rejects whatever else is wrong with the address
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

/** Whether `value` looks like an email address to share a new doc with. */
export function isShareableEmail(value: unknown): value is string {
    return typeof value === "string" && EMAIL_PATTERN.test(value)
}

// Drive ids are URL-safe base64: letters, digits, "-" and "_"
const DRIVE_ID_PATTERN = /^[\w-]+$/

/** Whether `value` looks like a Drive folder id to create a new doc in. */
export function isDriveFolderId(value: unknown): value is string {
    return typeof value === "string" && DRIVE_ID_PATTERN.test(value)
}

/** The Drive name for a new doc: its front-matter title, else "Untitled". */
export function getNewGdocName(title: unknown): string {
    if (typeof title === "string" && title.trim()) return title.trim()
    return "Untitled"
}

/**
 * The doc `base` as its subclass, with `content` parsed from `text` the way
 * the admin parses a fetched doc, subclass enrichment included. Throws a 400
 * JsonError when the text can't be parsed, its front-matter type isn't a valid
 * gdoc type, or the subclass enrichment fails. PUT and POST (create) run it
 * before anything is written.
 * Loads no state, so it doesn't query the DB.
 */
export async function loadWritableGdoc(
    knex: db.KnexReadonlyTransaction,
    base: OwidGdocBaseInterface,
    text: string
): Promise<AnyGdoc> {
    let type: unknown
    try {
        type = archieToEnriched(text).type
    } catch (error) {
        throw new JsonError(
            `The ArchieML could not be parsed: ${getErrorMessage(error)}`,
            400
        )
    }
    if (!checkIsOwidGdocType(type)) {
        const shown = type === undefined ? "missing" : `"${String(type)}"`
        throw new JsonError(
            `The front-matter "type" is ${shown}, which is not a valid gdoc type.`,
            400
        )
    }

    // The subclass is picked from the content type, so use the text's type:
    // a PUT may change it.
    const gdoc = await loadGdocFromGdocBase(
        knex,
        {
            ...base,
            content: {
                ...base.content,
                type,
            } as OwidGdocBaseInterface["content"],
        },
        undefined,
        false,
        { loadState: false }
    )

    // Same parse as GdocBase.fetchAndEnrichGdoc, minus the Google fetch.
    // Subclass enrichers can throw on text the plain parse accepts, e.g. an
    // author's `bio` written as a scalar instead of an array.
    try {
        gdoc.content = archieToEnriched(text, gdoc._enrichSubclassContent)
    } catch (error) {
        throw new JsonError(
            `The ArchieML could not be parsed as a "${type}" doc: ${getErrorMessage(error)}`,
            400
        )
    }
    return gdoc
}

/** Compares sent and stored text byte for byte, with no normalization. */
export function compareReadBack(sent: string, stored: string): ReadBack {
    if (sent === stored) return { match: true }

    const sentLines = sent.split("\n")
    const storedLines = stored.split("\n")
    let i = 0
    while (sentLines[i] === storedLines[i]) i++
    return {
        match: false,
        line: i + 1,
        sent: sentLines[i],
        stored: storedLines[i],
    }
}

/**
 * The doc's current ArchieML text and revision id, as the admin preview sees
 * it (suggestions not applied). Uses the read-write auth: revision ids can't
 * be shared across users, and the writer checks them with that auth.
 * `revisionId` is null when the service account can only view the doc:
 * Google returns revision ids only to accounts that can edit it.
 */
export async function fetchGdocArchieMl(
    documentId: string
): Promise<{ text: string; revisionId: string | null }> {
    const client = googleDocs({
        version: "v1",
        auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
    })
    const { data: document } = await client.documents.get({
        documentId,
        suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
    })
    const { text } = await gdocToArchie(document)
    return { text, revisionId: document.revisionId ?? null }
}

/**
 * The revision id PUT and POST return after writing. Throws a 500 when
 * Google gave none, which shouldn't happen for a doc the service account
 * just wrote.
 */
export function requireRevisionId(
    revisionId: string | null | undefined,
    documentId: string
): string {
    if (!revisionId)
        throw new JsonError(
            `Wrote gdoc "${documentId}", but Google returned no revision id when reading it back.`,
            500
        )
    return revisionId
}

function splitReport(messages: OwidGdocErrorMessage[]): DocReport {
    return {
        errors: messages.filter(
            (m) => m.type === OwidGdocErrorMessageType.Error
        ),
        warnings: messages.filter(
            (m) => m.type !== OwidGdocErrorMessageType.Error
        ),
    }
}

/**
 * The admin's publishability report for `text`, as the doc `base`, without
 * fetching from Google. Errors don't block writing; they block publishing.
 * Unpublished docs leave out the `slug` error: new and test docs have an
 * empty slug, which no text can fix (it is set in the admin before
 * publishing, where the admin UI still shows the error).
 */
export async function getDocReport(
    knex: db.KnexReadonlyTransaction,
    base: OwidGdocBaseInterface,
    text: string
): Promise<DocReport> {
    let gdoc: AnyGdoc
    try {
        gdoc = await loadWritableGdoc(knex, base, text)
    } catch (error) {
        // A text that can't be written still gets a report, so GET answers
        if (!(error instanceof JsonError) || error.status !== 400) throw error
        return splitReport([
            {
                property: "body",
                type: OwidGdocErrorMessageType.Error,
                message: error.message,
            },
        ])
    }
    await gdoc.loadState(knex) // ends in validate()
    const messages = getErrors(gdoc.toJSON())
    if (base.published) return splitReport(messages)
    return splitReport(
        messages.filter(
            (m) =>
                !(
                    m.property === "slug" &&
                    m.type === OwidGdocErrorMessageType.Error
                )
        )
    )
}
