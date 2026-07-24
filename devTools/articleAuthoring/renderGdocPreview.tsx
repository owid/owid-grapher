// Render a posts_gdocs row (by id) to a standalone HTML preview file, reading
// from the DB only — no Google involved. Companion to ingestArchieml.ts.
//
// Usage:
//   tsx --tsconfig tsconfig.tsx.json devTools/articleAuthoring/renderGdocPreview.tsx <id> <out.html>
//
// Serve the output over http (e.g. python3 -m http.server) rather than opening
// it as a file:// URL — in dev, styles load through the vite dev server and the
// request is blocked by CORS for file:// origins.

import fs from "node:fs"
import * as React from "react"
import * as db from "../../db/db.js"
import { TransactionCloseMode } from "../../db/db.js"
import { getAndLoadGdocById } from "../../db/model/Gdoc/GdocFactory.js"
import { renderToHtmlPage } from "../../serverUtils/serverUtil.js"
import OwidGdocPage from "../../site/gdocs/OwidGdocPage.js"
import { BAKED_BASE_URL } from "../../settings/serverSettings.js"

async function main(): Promise<void> {
    const [id, outPath] = process.argv.slice(2)
    if (!id || !outPath) {
        console.error(
            "Usage: tsx devTools/articleAuthoring/renderGdocPreview.tsx <id> <out.html>"
        )
        process.exit(1)
    }

    const html = await db.knexReadonlyTransaction(async (knex) => {
        // No contentSource argument -> loads from the DB (Internal)
        const gdoc = await getAndLoadGdocById(knex, id)
        return renderToHtmlPage(
            <OwidGdocPage
                baseUrl={BAKED_BASE_URL}
                gdoc={gdoc}
                debug
                isPreviewing
            />
        )
    }, TransactionCloseMode.Close)

    // In production the charset comes from the Content-Type header; add a meta
    // tag so the file also renders correctly from ad-hoc static servers.
    const htmlWithCharset = html.replace(
        "<head>",
        '<head><meta charset="utf-8"/>'
    )
    fs.writeFileSync(outPath, htmlWithCharset)
    console.log(`Wrote ${outPath}`)
}

void main().then(
    () => process.exit(0),
    (err) => {
        console.error(err)
        process.exit(1)
    }
)
