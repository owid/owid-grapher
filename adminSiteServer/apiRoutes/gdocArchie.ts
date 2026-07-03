import { docs as googleDocs, type docs_v1 } from "@googleapis/docs"
import {
    GDOCS_BASE_URL,
    GdocsContentSource,
    JsonError,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import {
    archieMlTextToBatchUpdates,
    createGdocAndInsertOwidGdocPostContent,
    deleteGdocContent,
    owidArticleToArchieMLStringGenerator,
} from "../../db/model/Gdoc/archieToGdoc.js"
import {
    joinArchieMlSkipSegments,
    splitArchieMlSkipSegments,
    type ArchieMlSkipSegments,
} from "../../db/model/Gdoc/archieMlSkipBlocks.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { gdocToArchie } from "../../db/model/Gdoc/gdocToArchie.js"
import {
    createOrLoadGdocById,
    getAndLoadGdocById,
    getGdocBaseObjectById,
    updateGdocContentOnly,
} from "../../db/model/Gdoc/GdocFactory.js"
import {
    compareArchieMlContent,
    validateArchieMl,
    type ArchieMlValidationResult,
} from "../../db/model/Gdoc/validateArchieMl.js"
import { GDOCS_AGENT_DRAFTS_FOLDER } from "../../settings/serverSettings.js"
import { getErrors } from "../../adminSiteClient/gdocsValidation.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"

interface ArchieMlGateFailure {
    writable: false
    errors: OwidGdocErrorMessage[]
    warnings: OwidGdocErrorMessage[]
}

const previewUrl = (id: string): string => `/admin/gdocs/${id}/preview`

// The doc's validation report, shaped like every doc-report response:
// errors block publishing (mirrors the admin's publish gating), warnings
// don't. Meaning is carried by the endpoint contract: this always describes
// a stored doc, never the submitted text.
function docReport(adminErrors: OwidGdocErrorMessage[]): {
    publishable: boolean
    errors: OwidGdocErrorMessage[]
    warnings: OwidGdocErrorMessage[]
} {
    const errors = adminErrors.filter(
        (e) => e.type === OwidGdocErrorMessageType.Error
    )
    return {
        publishable: errors.length === 0,
        errors,
        warnings: adminErrors.filter(
            (e) => e.type !== OwidGdocErrorMessageType.Error
        ),
    }
}
const docUrl = (id: string): string => `${GDOCS_BASE_URL}/document/d/${id}/edit`

async function fetchGdocDocument(
    client: docs_v1.Docs,
    documentId: string
): Promise<docs_v1.Schema$Document> {
    try {
        const { data } = await client.documents.get({
            documentId,
            suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
        })
        return data
    } catch {
        throw new JsonError(
            `Could not fetch gdoc "${documentId}" from Google. Check the id and make sure the document is shared with the OWID service account.`,
            404
        )
    }
}

function getArchieMlFromBody(req: Request): string {
    const archieMl = req.body?.archieMl
    if (typeof archieMl !== "string" || !archieMl.trim())
        throw new JsonError(
            `The request body must contain a non-empty "archieMl" string`,
            400
        )
    return archieMl
}

// Validate the ArchieML, treating mid-document :skip/:ignore directives as an
// error: their hidden content has no stable anchor after canonicalization, so
// a wholesale replace would silently destroy it. Leading/trailing blocks are
// fine — the write path preserves those verbatim (see archieMlSkipBlocks.ts).
function validateWithSkipSegments(archieMl: string): {
    validation: ArchieMlValidationResult
    segments: ArchieMlSkipSegments
} {
    const segments = splitArchieMlSkipSegments(archieMl)
    const validation = validateArchieMl(archieMl)
    if (segments.midDocumentDirectiveLines.length > 0) {
        validation.errors.push({
            property: "body",
            type: OwidGdocErrorMessageType.Error,
            message:
                `:skip/:ignore directive in the middle of the document ` +
                `(line ${segments.midDocumentDirectiveLines.join(", ")}). ` +
                `Hidden content there cannot be preserved through a full ` +
                `replace — move it to the very top or bottom of the ` +
                `document, or make that change by hand.`,
        })
        validation.valid = false
    }
    return { validation, segments }
}

/**
 * GET /gdocs/:id/archie
 *
 * Returns the canonical ArchieML view of a Google Doc — the same derived text
 * the ingestion pipeline parses — for agents/tools that reason over or edit a
 * doc as text. Unlike GET /gdocs/:id?contentSource=gdocs this is
 * side-effect-free: no images are synced and nothing is persisted.
 */
export async function getGdocArchie(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const id = req.params.id
    const client = googleDocs({
        version: "v1",
        auth: OwidGoogleAuth.getGoogleReadonlyAuth(),
    })
    const document = await fetchGdocDocument(client, id)
    const { text } = await gdocToArchie(document)
    const dbRow = await getGdocBaseObjectById(trx, id, false)

    res.set("Cache-Control", "no-store")
    return {
        archieMl: text,
        revisionId: document.revisionId,
        title: document.title,
        registered: !!dbRow,
        published: dbRow?.published ?? false,
    }
}

/**
 * GET /gdocs/:id/validation
 *
 * The validation report for a doc, as the admin computes it: the doc is
 * fetched fresh from Google, loaded with its DB context (which runs
 * GdocBase.validate — images, linked documents, …), and run through the same
 * getErrors the admin UI uses. Nothing is persisted. Same { errors, warnings }
 * shape and meaning as the write responses.
 */
export async function getGdocValidation(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = req.params.id
    const dbRow = await getGdocBaseObjectById(trx, id, false)
    if (!dbRow)
        throw new JsonError(
            `Gdoc "${id}" is not registered in the admin. Register it first (PUT /gdocs/:id with an empty body).`,
            404
        )
    const gdoc = await getAndLoadGdocById(trx, id, GdocsContentSource.Gdocs)
    return docReport(getErrors(gdoc))
}

/**
 * PUT /gdocs/:id/archie
 *
 * Replaces the entire content of an (unpublished) Google Doc with the given
 * ArchieML, after validating it against the real ingestion pipeline. Pass
 * `?dryRun=true` to only run the validation. `expectedRevisionId` (from a
 * prior GET) guards against overwriting concurrent author edits.
 */
export async function putGdocArchie(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const id = req.params.id
    const dryRun = req.query.dryRun === "true"
    const archieMl = getArchieMlFromBody(req)

    const { validation, segments } = validateWithSkipSegments(archieMl)
    if (!validation.valid) {
        res.status(400)
        return {
            writable: false,
            errors: validation.errors,
            warnings: validation.warnings,
        } satisfies ArchieMlGateFailure
    }
    if (dryRun)
        return { writable: true, errors: [], warnings: validation.warnings }

    const dbRow = await getGdocBaseObjectById(trx, id, false)
    if (!dbRow)
        throw new JsonError(
            `Gdoc "${id}" is not registered in the admin. Register it first (PUT /gdocs/:id with an empty body).`,
            404
        )
    if (dbRow.published)
        throw new JsonError(
            `Gdoc "${id}" is published. Refusing to overwrite a published document — its Google Doc is shared with production.`,
            403
        )

    const expectedRevisionId = req.body?.expectedRevisionId
    if (typeof expectedRevisionId !== "string" || !expectedRevisionId)
        throw new JsonError(
            `The request body must contain "expectedRevisionId" (returned by GET /gdocs/:id/archie)`,
            400
        )

    const client = googleDocs({
        version: "v1",
        auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
    })
    const before = await fetchGdocDocument(client, id)
    if (before.revisionId !== expectedRevisionId)
        throw new JsonError(
            `The document changed since it was read (revision ${before.revisionId}, expected ${expectedRevisionId}). Re-read it and re-apply your edit.`,
            409
        )

    // Wholesale replace: wipe the body, then insert the new content with real
    // Google Docs formatting. The written text is the canonical form of the
    // parsed content, with any leading/trailing :skip//:ignore segments from
    // the incoming text preserved verbatim around it (their content is
    // invisible to the parse, so this is the only way it survives).
    const canonicalArchieMl = [
        ...owidArticleToArchieMLStringGenerator(validation.content!),
    ].join("\n")
    const textToWrite = joinArchieMlSkipSegments(segments, canonicalArchieMl)
    await deleteGdocContent(client, id)
    await client.documents.batchUpdate({
        documentId: id,
        requestBody: { requests: archieMlTextToBatchUpdates(textToWrite) },
    })

    // Read back and verify at the parse level: Google normalizes bytes
    // (style-run splits, trailing newlines), so a byte comparison would cry
    // wolf. What must survive is the *content*. A mismatch is reported, not
    // rolled back — the doc history still has the previous revision.
    const after = await fetchGdocDocument(client, id)
    const { text: readBack } = await gdocToArchie(after)
    let verification: { identical: boolean; differingBodyBlocks?: number[] }
    try {
        const comparison = compareArchieMlContent(
            validation.content!,
            archieToEnriched(readBack)
        )
        verification = comparison.identical
            ? { identical: true }
            : {
                  identical: false,
                  differingBodyBlocks: comparison.differingBodyBlocks,
              }
    } catch {
        verification = { identical: false }
    }

    // Re-ingest into the DB so the admin preview reflects the change. The
    // loaded gdoc carries the admin's contextual validation (loadState runs
    // GdocBase.validate: broken image references, links to unpublished docs,
    // missing excerpt, …) — report it the way the admin UI would. These are
    // about the *saved* doc: informational, not a failure of the write.
    const gdoc = await getAndLoadGdocById(trx, id, GdocsContentSource.Gdocs)
    await updateGdocContentOnly(trx, id, gdoc)

    return {
        ok: true,
        revisionId: after.revisionId,
        previewUrl: previewUrl(id),
        verification,
        ...docReport(getErrors(gdoc)),
    }
}

/**
 * POST /gdocs
 *
 * Creates a new Google Doc from ArchieML, registers it in the admin, and
 * returns its ids and URLs. Pass `?dryRun=true` to only run the validation.
 * The doc is created inside `folderId` (default: GDOCS_AGENT_DRAFTS_FOLDER) —
 * it must be a folder shared with authors, since a doc created outside a
 * shared folder lands in the service account's private Drive.
 */
export async function createGdocFromArchie(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadWriteTransaction
) {
    const dryRun = req.query.dryRun === "true"
    const archieMl = getArchieMlFromBody(req)

    const { validation, segments } = validateWithSkipSegments(archieMl)
    if (segments.prefix || segments.suffix) {
        validation.errors.push({
            property: "body",
            type: OwidGdocErrorMessageType.Error,
            message:
                "A new document should not contain :skip/:ignore directives — remove them.",
        })
        validation.valid = false
    }
    if (!validation.valid) {
        res.status(400)
        return {
            writable: false,
            errors: validation.errors,
            warnings: validation.warnings,
        } satisfies ArchieMlGateFailure
    }
    if (dryRun)
        return { writable: true, errors: [], warnings: validation.warnings }

    const folderId = req.body?.folderId || GDOCS_AGENT_DRAFTS_FOLDER
    if (typeof folderId !== "string" || !folderId)
        throw new JsonError(
            `No target Drive folder: pass "folderId" or configure GDOCS_AGENT_DRAFTS_FOLDER`,
            400
        )

    const documentId = await createGdocAndInsertOwidGdocPostContent(
        validation.content!,
        null,
        folderId
    )
    // Registers the doc and loads it with its DB context, which runs the
    // admin's contextual validation — reported below like the admin UI would.
    const created = await createOrLoadGdocById(trx, documentId)

    res.status(201)
    return {
        id: documentId,
        docUrl: docUrl(documentId),
        previewUrl: previewUrl(documentId),
        ...docReport(getErrors(created)),
    }
}
