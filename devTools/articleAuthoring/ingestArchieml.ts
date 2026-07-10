// Ingest a plain-text ArchieML article file directly into posts_gdocs,
// bypassing Google Docs entirely. Useful for drafting and previewing locally.
//
// Usage:
//   tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/ingestArchieml.ts <archieml-file> <id> [slug]
//
// The id is an arbitrary unique string (stands in for the gdoc id). Re-running
// with the same id updates the draft in place. Preview in the admin with
// ?contentSource=internal (plain admin preview re-fetches from Google and
// doesn't work for these drafts), or render to a file with
// renderGdocPreview.tsx.

import fs from "node:fs"
import * as db from "../../db/db.js"
import { TransactionCloseMode } from "../../db/db.js"
import { archieToEnriched } from "../../db/model/Gdoc/archieToEnriched.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import {
    loadGdocFromGdocBase,
    upsertGdoc,
} from "../../db/model/Gdoc/GdocFactory.js"

async function main(): Promise<void> {
    const [textPath, id, slug] = process.argv.slice(2)
    if (!textPath || !id) {
        console.error(
            "Usage: tsx devTools/articleAuthoring/ingestArchieml.ts <archieml-file> <id> [slug]"
        )
        process.exit(1)
    }
    const text = fs.readFileSync(textPath, "utf8")

    // Same parsing step that fetchAndEnrichGdoc runs on text converted from
    // a Google Doc — our text is already ArchieML, so we skip Google.
    const stub = new GdocPost(id)
    stub.content = archieToEnriched(text, stub._enrichSubclassContent)
    stub.slug = slug ?? id

    const gdoc = await db.knexReadWriteTransaction(async (trx) => {
        const loaded = await loadGdocFromGdocBase(trx, stub)
        return upsertGdoc(trx, loaded)
    }, TransactionCloseMode.Close)

    console.log(`Upserted "${gdoc.content.title}" (type: ${gdoc.content.type})`)
    const parseErrors = gdoc.content.body?.flatMap((b) => b.parseErrors) ?? []
    if (parseErrors.length) {
        console.warn("Parse errors:", JSON.stringify(parseErrors, null, 2))
    }
    console.log(
        `Preview: http://localhost:3030/admin/gdocs/${id}/preview?contentSource=internal`
    )
}

void main().then(
    () => process.exit(0),
    (err) => {
        console.error(err)
        process.exit(1)
    }
)
