// Create an OWID article gdoc from a plain-text ArchieML file, share it, and
// register it in the DB via the regular ingestion pipeline.
//
// Usage:
//   tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/createGdocArticle.ts <archieml-file> "<doc title>" [share-with-email]
//
// Prints the created gdoc id and the local admin preview URL.

import fs from "node:fs"
import { docs as googleDocs } from "@googleapis/docs"
import { drive as googleDrive } from "@googleapis/drive"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { GDOCS_BACKPORTING_TARGET_FOLDER } from "../../settings/serverSettings.js"
import * as db from "../../db/db.js"
import { TransactionCloseMode } from "../../db/db.js"
import { createOrLoadGdocById } from "../../db/model/Gdoc/GdocFactory.js"

const DOCS_MIME_TYPE = "application/vnd.google-apps.document"

async function main(): Promise<void> {
    const [textPath, title, shareWith] = process.argv.slice(2)
    if (!textPath || !title) {
        console.error(
            'Usage: tsx devTools/articleAuthoring/createGdocArticle.ts <archieml-file> "<doc title>" [share-with-email]'
        )
        process.exit(1)
    }
    const articleText = fs.readFileSync(textPath, "utf8")

    const auth = OwidGoogleAuth.getGoogleReadWriteAuth()
    const driveClient = googleDrive({ version: "v3", auth })
    const docsClient = googleDocs({ version: "v1", auth })

    // Create an empty Google Doc (same pattern as archieToGdoc.ts createGdoc)
    const parents = GDOCS_BACKPORTING_TARGET_FOLDER
        ? [GDOCS_BACKPORTING_TARGET_FOLDER]
        : undefined
    const createResp = await driveClient.files.create({
        supportsAllDrives: true,
        requestBody: {
            parents,
            mimeType: DOCS_MIME_TYPE,
            name: title,
        },
        media: {
            mimeType: DOCS_MIME_TYPE,
            body: "",
        },
    })
    const documentId = createResp.data.id
    if (!documentId) throw new Error("Failed to create Google Doc")
    console.log(
        `Created gdoc: https://docs.google.com/document/d/${documentId}/edit`
    )

    // Insert the ArchieML text as plain text
    await docsClient.documents.batchUpdate({
        documentId,
        requestBody: {
            requests: [
                {
                    insertText: {
                        location: { index: 1 },
                        text: articleText,
                    },
                },
            ],
        },
    })
    console.log("Inserted ArchieML content")

    if (shareWith) {
        await driveClient.permissions.create({
            fileId: documentId,
            supportsAllDrives: true,
            sendNotificationEmail: false,
            requestBody: {
                role: "writer",
                type: "user",
                emailAddress: shareWith,
            },
        })
        console.log(`Shared with ${shareWith}`)
    }

    // Register in the DB via the regular ingestion pipeline
    const gdoc = await db.knexReadWriteTransaction(
        async (trx) => createOrLoadGdocById(trx, documentId),
        TransactionCloseMode.Close
    )
    console.log(
        `Registered in DB as "${gdoc.content.title}" (type: ${gdoc.content.type})`
    )
    const parseErrors = gdoc.content.body?.flatMap((b) => b.parseErrors) ?? []
    if (parseErrors.length) {
        console.warn("Parse errors:", JSON.stringify(parseErrors, null, 2))
    }
    console.log(
        `Preview: http://localhost:3030/admin/gdocs/${documentId}/preview`
    )
}

void main().then(
    () => process.exit(0),
    (err) => {
        console.error(err)
        process.exit(1)
    }
)
