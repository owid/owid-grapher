// One-off migration: import existing file-backed "data nuggets" version
// JSON files into the new agentic_writing_* DB tables as data_nugget
// lineages. Safe to re-run — skips lineages that already exist.
//
// Usage:
//   tsx --tsconfig tsconfig.tsx.json devTools/migrateAgenticWritingToDb.ts \
//     --owner=bobbie@ourworldindata.org --rootDir=data-nuggets/versions
//
//   --owner    : email of the user who will own all migrated lineages
//                (must exist in the `users` table). Default: bobbie@ourworldindata.org.
//   --rootDir  : path to the legacy versions/ directory. Default: data-nuggets/versions
//   --dryRun   : if set, prints what would be inserted but doesn't write.
import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as db from "../db/db.js"
import {
    AgenticWritingLineagesTableName,
    AgenticWritingVersionsTableName,
    UsersTableName,
} from "@ourworldindata/types"

interface Args {
    owner: string
    rootDir: string
    dryRun: boolean
}

interface FileVersionRecord {
    viewLineageId: string
    versionId: string
    parentVersionId: string | null
    createdAt: string
    createdBy: string
    kind: "initial" | "decision" | "revision"
    sourceId: string
    localId: string
    title: string
    description: string
    grapherViews: unknown[]
    metadata: Record<string, unknown>
    review: {
        decision: "approved" | "rejected" | "request_revisions" | null
        comment: string | null
        reviewedAt: string | null
        reviewedBy: string | null
    }
}

async function main(args: Args) {
    const rootDir = path.resolve(args.rootDir)
    if (!fs.existsSync(rootDir)) {
        console.error(`rootDir not found: ${rootDir}`)
        process.exit(1)
    }

    const lineageDirs = fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    console.log(`Found ${lineageDirs.length} lineage directories.`)

    const result = await db.knexReadWriteTransaction(async (trx) => {
        const owner = await trx
            .table(UsersTableName)
            .where({ email: args.owner })
            .first<{ id: number; email: string }>()
        if (!owner) {
            throw new Error(
                `Owner user not found for email ${args.owner}. Pass --owner=<existing-user-email>.`
            )
        }

        // Build an email → user.id map up front so we can map createdBy /
        // reviewedBy labels to FK columns where the label happens to be a
        // real OWID email.
        const userRows = await trx
            .table(UsersTableName)
            .select<{ id: number; email: string }[]>("id", "email")
        const userIdByEmail = new Map<string, number>()
        for (const u of userRows) userIdByEmail.set(u.email, u.id)
        const resolveUserId = (label: string | null): number | null => {
            if (!label) return null
            return userIdByEmail.get(label) ?? null
        }

        let lineagesInserted = 0
        let lineagesSkipped = 0
        let versionsInserted = 0

        for (const lineageDirName of lineageDirs) {
            const versionFiles = fs
                .readdirSync(path.join(rootDir, lineageDirName))
                .filter((f) => f.startsWith("v-") && f.endsWith(".json"))
                .sort()
            if (versionFiles.length === 0) continue

            const versions: FileVersionRecord[] = versionFiles.map((f) =>
                JSON.parse(
                    fs.readFileSync(
                        path.join(rootDir, lineageDirName, f),
                        "utf-8"
                    )
                )
            )
            const first = versions[0]
            const existing = await trx
                .table(AgenticWritingLineagesTableName)
                .where({ lineageKey: first.viewLineageId })
                .first<{ id: number }>()
            if (existing) {
                lineagesSkipped++
                continue
            }

            if (args.dryRun) {
                console.log(
                    `[dryRun] would insert lineage ${first.viewLineageId} + ${versions.length} versions`
                )
                continue
            }

            const insertedLineage = await trx
                .table(AgenticWritingLineagesTableName)
                .insert({
                    lineageKey: first.viewLineageId,
                    contentType: "data_nugget",
                    sourceId: first.sourceId,
                    localId: first.localId,
                    ownerUserId: owner.id,
                    createdAt: new Date(first.createdAt),
                    updatedAt: new Date(
                        versions[versions.length - 1].createdAt
                    ),
                })
            const lineageId = insertedLineage[0]
            lineagesInserted++

            for (const v of versions) {
                // The legacy file format stored grapherViews at the top level.
                // The new schema wraps it inside `payload` so future content
                // types can ship different payload shapes.
                const payload = { grapherViews: v.grapherViews }
                await trx
                    .table(AgenticWritingVersionsTableName)
                    .insert({
                        lineageId,
                        versionId: v.versionId,
                        parentVersionId: v.parentVersionId,
                        createdAt: new Date(v.createdAt),
                        createdByUserId: resolveUserId(v.createdBy),
                        createdByLabel: v.createdBy,
                        kind: v.kind,
                        title: v.title,
                        description: v.description,
                        payload: JSON.stringify(payload),
                        metadata: JSON.stringify(v.metadata ?? {}),
                        reviewDecision: v.review?.decision ?? null,
                        reviewComment: v.review?.comment ?? null,
                        reviewedAt: v.review?.reviewedAt
                            ? new Date(v.review.reviewedAt)
                            : null,
                        reviewedByUserId: resolveUserId(
                            v.review?.reviewedBy ?? null
                        ),
                        reviewedByLabel: v.review?.reviewedBy ?? null,
                    })
                versionsInserted++
            }
        }

        return { lineagesInserted, lineagesSkipped, versionsInserted }
    }, db.TransactionCloseMode.Close)

    console.log(
        `Done. lineagesInserted=${result.lineagesInserted} lineagesSkipped=${result.lineagesSkipped} versionsInserted=${result.versionsInserted}`
    )
}

void yargs(hideBin(process.argv))
    .command(
        "$0",
        "Import legacy file-backed data-nuggets JSON into the agentic_writing_* tables",
        (y) =>
            y
                .option("owner", {
                    type: "string",
                    description: "Email of the user to own the migrated lineages",
                    default: "bobbie@ourworldindata.org",
                })
                .option("rootDir", {
                    type: "string",
                    description: "Path to data-nuggets/versions/",
                    default: "data-nuggets/versions",
                })
                .option("dryRun", {
                    type: "boolean",
                    default: false,
                }),
        (argv) =>
            main({
                owner: argv.owner,
                rootDir: argv.rootDir,
                dryRun: argv.dryRun,
            }).catch((e) => {
                console.error(e)
                process.exit(1)
            })
    )
    .strict()
    .help()
    .parse()
