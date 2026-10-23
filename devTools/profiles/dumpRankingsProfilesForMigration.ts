// PROTOTYPE ONLY — DO NOT MERGE.
//
// Dumps the rankings prototype profiles (posts_gdocs rows whose id ends in
// `-rankings`, plus `test-rankings-prototype-profile`) and their
// posts_gdocs_x_tags / posts_gdocs_components rows from the local dev DB into
// db/migration/data/PrototypeSeedRankingProfiles.json. That file is read by the
// PrototypeSeedRankingProfiles migration, which seeds these rows into the
// staging server of branch country-profile-rankings.
//
// Re-run after changing the seeds (seedRankingsTestProfile.ts /
// seedRankingsProfileCopies.ts) to refresh the migration data:
//
//   yarn tsx --tsconfig tsconfig.tsx.json devTools/profiles/dumpRankingsProfilesForMigration.ts
//
// Columns are serialized exactly as stored: JSON columns as their raw JSON
// string, datetimes as 'YYYY-MM-DD HH:MM:SS' (no timezone conversion).
// Generated columns (posts_gdocs.type/contentMd5/authors,
// posts_gdocs_components.type) and auto-increment ids are left out.

import fs from "fs-extra"
import path from "path"
import * as db from "../../db/db.js"

const OUT_FILE = path.join(
    __dirname,
    "../../db/migration/data/PrototypeSeedRankingProfiles.json"
)

const ID_FILTER = `(id LIKE '%-rankings' OR id = 'test-rankings-prototype-profile')`

const DATETIME_FORMAT = "'%Y-%m-%d %H:%i:%s'"

async function main(): Promise<void> {
    await db.knexReadonlyTransaction(async (trx) => {
        const gdocs = await db.knexRaw<Record<string, unknown>>(
            trx,
            `-- sql
            SELECT
                id,
                slug,
                CAST(content AS CHAR) AS content,
                published,
                DATE_FORMAT(createdAt, ${DATETIME_FORMAT}) AS createdAt,
                DATE_FORMAT(publishedAt, ${DATETIME_FORMAT}) AS publishedAt,
                DATE_FORMAT(updatedAt, ${DATETIME_FORMAT}) AS updatedAt,
                publicationContext,
                revisionId,
                CAST(manualBreadcrumbs AS CHAR) AS manualBreadcrumbs,
                markdown
            FROM posts_gdocs
            WHERE ${ID_FILTER}
            ORDER BY id`
        )
        const ids = gdocs.map((gdoc) => gdoc.id as string)
        if (ids.length === 0) throw new Error("No rankings profiles found")

        const tags = await db.knexRaw<Record<string, unknown>>(
            trx,
            `-- sql
            SELECT gdocId, tagId
            FROM posts_gdocs_x_tags
            WHERE gdocId IN (?)
            ORDER BY gdocId, tagId`,
            [ids]
        )

        const components = await db.knexRaw<Record<string, unknown>>(
            trx,
            `-- sql
            SELECT gdocId, CAST(config AS CHAR) AS config, parent, path
            FROM posts_gdocs_components
            WHERE gdocId IN (?)
            ORDER BY id`,
            [ids]
        )

        await fs.writeFile(
            OUT_FILE,
            JSON.stringify({ gdocs, tags, components }, null, 2) + "\n"
        )
        console.log(
            `Wrote ${gdocs.length} gdocs, ${tags.length} tag rows, ${components.length} component rows to ${OUT_FILE}`
        )
        for (const gdoc of gdocs) console.log(`  ${gdoc.id} -> /${gdoc.slug}`)
    }, db.TransactionCloseMode.Close)
}

void main()
