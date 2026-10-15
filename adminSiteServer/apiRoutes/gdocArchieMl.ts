import { type drive_v3, drive as googleDrive } from "@googleapis/drive"
import { JsonError, type OwidGdocBaseInterface } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { getGdocBaseObjectById } from "../../db/model/Gdoc/GdocFactory.js"
import {
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
 * Refuses (403) a doc in any shared drive: those are authors' docs, even when
 * unpublished. Drive returns a `driveId` only for files in a shared drive.
 * When the lookup fails, refuses (500) rather than risk writing.
 */
async function assertNotInSharedDrive(id: string): Promise<void> {
    const driveClient = getReadWriteDriveClient()
    let driveId: string | null | undefined
    try {
        const { data } = await driveClient.files.get({
            fileId: id,
            fields: "driveId",
            supportsAllDrives: true,
        })
        driveId = data.driveId
    } catch (error) {
        throw new JsonError(
            `Could not check whether gdoc "${id}" is in a shared drive, so nothing was written: ${getErrorMessage(error)}`,
            500
        )
    }
    if (driveId)
        throw new JsonError(
            `Gdoc "${id}" is in a shared drive. Only docs outside shared drives can be written here.`,
            403
        )
}

/**
 * GET /gdocs/:id/archieml
 *
 * The doc's ArchieML text, its revision id (to send back with the PUT), the
 * report a PUT of that text would return, and whether it is published. Reads
 * any registered doc, so published docs can serve as structure references.
 */
export async function getGdocArchieMl(
    req: Request,
    res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
): Promise<{
    text: string
    revisionId: string
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

    const base = await db.knexReadonlyTransaction((trx) =>
        getWritableGdocBase(trx, id)
    )

    await assertNotInSharedDrive(id)

    // Parse with the subclass enrichment, so text the admin can't load is
    // refused before anything is written
    await db.knexReadonlyTransaction((trx) => loadWritableGdoc(trx, base, text))

    let writtenRevisionId: string | undefined
    try {
        writtenRevisionId = await replaceGdocContentWithArchieMlText(id, text, {
            requiredRevisionId,
        })
    } catch (error) {
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

    return {
        revisionId: writtenRevisionId ?? stored.revisionId,
        readBack,
        report,
    }
}
