import { type drive_v3, drive as googleDrive } from "@googleapis/drive"
import { JsonError, type OwidGdocBaseInterface } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { GdocBase } from "../../db/model/Gdoc/GdocBase.js"
import {
    createGdocAndInsertIntoDb,
    getGdocBaseObjectById,
} from "../../db/model/Gdoc/GdocFactory.js"
import {
    createGdoc,
    NoEditAccessError,
    replaceGdocContentWithArchieMlText,
    StaleRevisionError,
} from "../../db/model/Gdoc/archieToGdoc.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import {
    compareReadBack,
    type DocReport,
    fetchGdocArchieMl,
    findUnwritableCharacter,
    getDocReport,
    getErrorMessage,
    getNewGdocName,
    isDriveFolderId,
    isShareableEmail,
    loadWritableGdoc,
    type ReadBack,
} from "../gdocArchieMl.js"

// Refuses docs that have no posts_gdocs row (404)
async function getRegisteredGdocBase(
    knex: db.KnexReadonlyTransaction,
    id: string
): Promise<OwidGdocBaseInterface> {
    const base = await getGdocBaseObjectById(knex, id, true)
    if (!base)
        throw new JsonError(
            `Gdoc "${id}" is not registered in the admin. Open it in the admin once to register it.`,
            404
        )
    return base
}

// Refuses docs that have no posts_gdocs row (404) or are published (403)
async function getWritableGdocBase(
    knex: db.KnexReadonlyTransaction,
    id: string
): Promise<OwidGdocBaseInterface> {
    const base = await getRegisteredGdocBase(knex, id)
    if (base.published)
        throw new JsonError(
            `Gdoc "${id}" is published. Only unpublished docs can be written here.`,
            403
        )
    return base
}

function getReadWriteDriveClient(): drive_v3.Drive {
    return googleDrive({
        version: "v3",
        auth: OwidGoogleAuth.getGoogleReadWriteAuth(),
    })
}

/**
 * The request body as ArchieML text. Refuses (400) a body that isn't
 * text/plain, or that contains a character Google strips on insert.
 */
function readArchieMlBody(req: Request): string {
    if (!req.is("text/plain") || typeof req.body !== "string")
        throw new JsonError(
            `The request body must be the ArchieML text, sent with Content-Type: text/plain.`,
            400
        )
    const text: string = req.body

    const unwritable = findUnwritableCharacter(text)
    if (unwritable)
        throw new JsonError(
            `Line ${unwritable.line} contains ${unwritable.codePoint}, which Google strips on insert. Remove it and send again.`,
            400
        )
    return text
}

/**
 * GET /gdocs/:id/archieml
 *
 * The doc's ArchieML text, its revision id (to send back with the PUT), the
 * report a PUT of that text would return, and whether it is published. Reads
 * any registered doc, so published docs can serve as structure references.
 * The revision id is null on docs the service account can only view.
 */
export async function getGdocArchieMl(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<{
    text: string
    revisionId: string | null
    report: DocReport
    published: boolean
}> {
    const id = req.params.id
    const base = await getRegisteredGdocBase(trx, id)
    const { text, revisionId } = await fetchGdocArchieMl(id)
    const report = await getDocReport(trx, base, text)

    res.set("Cache-Control", "no-store")
    return { text, revisionId, report, published: base.published }
}

/**
 * PUT /gdocs/:id/archieml?revisionId=<id>   (Content-Type: text/plain)
 *
 * Replaces the doc's content with the request body, written as-is. Every
 * refusal happens before anything is written. After writing, the doc is read
 * back and compared with the sent text; a mismatch is reported, not rolled
 * back. Holds no DB transaction across the Google calls.
 */
export async function putGdocArchieMl(
    req: Request,
    _res: HandlerResponse
): Promise<{ revisionId: string; readBack: ReadBack; report: DocReport }> {
    const id = req.params.id
    const requiredRevisionId = req.query.revisionId
    if (typeof requiredRevisionId !== "string" || !requiredRevisionId)
        throw new JsonError(
            `The "revisionId" query parameter is required (returned by GET /gdocs/:id/archieml).`,
            400
        )

    const text = readArchieMlBody(req)

    const base = await db.knexReadonlyTransaction((trx) =>
        getWritableGdocBase(trx, id)
    )

    // Parse with the subclass enrichment, so text the admin can't load is
    // refused before anything is written
    await db.knexReadonlyTransaction((trx) => loadWritableGdoc(trx, base, text))

    let writtenRevisionId: string
    try {
        writtenRevisionId = await replaceGdocContentWithArchieMlText(id, text, {
            requiredRevisionId,
        })
    } catch (error) {
        if (error instanceof NoEditAccessError)
            throw new JsonError(
                `${error.message} Only docs it can edit can be written here.`,
                403
            )
        if (error instanceof StaleRevisionError)
            throw new JsonError(
                `${error.message} Read the doc again and re-apply your edit.`,
                409
            )
        throw error
    }

    const stored = await fetchGdocArchieMl(id)
    const readBack = compareReadBack(text, stored.text)
    const report = await db.knexReadonlyTransaction((trx) =>
        getDocReport(trx, base, stored.text)
    )

    return { revisionId: writtenRevisionId, readBack, report }
}

/**
 * POST /gdocs/archieml?email=<email>&folderId=<id>   (Content-Type: text/plain)
 *
 * Creates a new doc of any type from the request body, in the Drive folder
 * `folderId` (which may be in a shared drive; the service account's own My
 * Drive has no storage). Shares it as writer with `email` (otherwise only
 * the folder's members could open it), writes the text as-is, reads it back and
 * registers it in posts_gdocs. Every refusal happens before anything is
 * created in Google. No DB transaction is held across the create, share and
 * write; registering fetches the doc from Google again inside its own
 * transaction, as the admin's regular create does.
 */
export async function createGdocArchieMl(
    req: Request,
    _res: HandlerResponse
): Promise<{
    id: string
    url: string
    revisionId: string
    readBack: ReadBack
    report: DocReport
}> {
    const email = req.query.email
    if (!isShareableEmail(email))
        throw new JsonError(
            `The "email" query parameter must be the email address to share the new doc with.`,
            400
        )
    const folderId = req.query.folderId
    if (!isDriveFolderId(folderId))
        throw new JsonError(
            `The "folderId" query parameter must be the id of the Drive folder to create the doc in (the part of the folder URL after /folders/).`,
            400
        )

    const text = readArchieMlBody(req)

    // Parse with the subclass enrichment, so text the admin can't load is
    // refused before anything is created. The doc doesn't exist yet, so parse
    // it as an empty base; loadWritableGdoc takes the type from the text.
    const parsed = await db.knexReadonlyTransaction((trx) =>
        loadWritableGdoc(trx, new GdocBase(), text)
    )

    const driveClient = getReadWriteDriveClient()
    let id: string
    try {
        id = await createGdoc(
            driveClient,
            getNewGdocName(parsed.content.title),
            folderId
        )
    } catch (error) {
        // A 500 rather than Google's own status (e.g. a quota 403), which
        // would read as a refusal of the input
        throw new JsonError(
            `Could not create the doc in Google Drive: ${getErrorMessage(error)}`,
            500
        )
    }
    const url = `https://docs.google.com/document/d/${id}/edit`

    try {
        await driveClient.permissions.create({
            fileId: id,
            sendNotificationEmail: false,
            supportsAllDrives: true,
            requestBody: { type: "user", role: "writer", emailAddress: email },
        })
    } catch (error) {
        // The email can't open the doc, so remove it
        await driveClient.files
            .delete({ fileId: id, supportsAllDrives: true })
            .catch((deleteError) =>
                console.error(
                    `Could not delete unshared gdoc ${id}`,
                    deleteError
                )
            )
        throw new JsonError(
            `Could not share the new doc with ${email}, so it was deleted: ${getErrorMessage(error)}`,
            500
        )
    }

    let revisionId: string
    try {
        revisionId = await replaceGdocContentWithArchieMlText(id, text)
    } catch (error) {
        throw new JsonError(
            `Created and shared ${url}, but writing its content failed, so it is empty and not registered in the admin: ${getErrorMessage(error)}`,
            500
        )
    }

    try {
        const stored = await fetchGdocArchieMl(id)
        const readBack = compareReadBack(text, stored.text)

        // Registering fetches the doc from Google again; accepted for create
        await db.knexReadWriteTransaction((trx) =>
            createGdocAndInsertIntoDb(trx, id)
        )
        const report = await db.knexReadonlyTransaction(async (trx) =>
            getDocReport(trx, await getRegisteredGdocBase(trx, id), stored.text)
        )

        return { id, url, revisionId, readBack, report }
    } catch (error) {
        throw new JsonError(
            `Created, shared and wrote ${url}, but reading it back or registering it failed, so it may not be registered in the admin: ${getErrorMessage(error)}`,
            500
        )
    }
}
