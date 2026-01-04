#! /usr/bin/env node

import parseArgs from "minimist"
import * as db from "../../db/db.js"
import { docs as googleDocs, docs_v1 } from "@googleapis/docs"
import { OwidGoogleAuth } from "../../db/OwidGoogleAuth.js"
import { sleep } from "@ourworldindata/utils"
import { PostsGdocsTableName, type DbRawPostGdoc } from "@ourworldindata/types"
import { GaxiosError } from "gaxios"

const DEFAULT_BATCH_SIZE = 10
const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 1000

type CliOptions = {
    batchSize: number
    dryRun: boolean
    id?: string
}

function printHelp(): void {
    console.log(`Backfill rawGdoc column for posts_gdocs rows.

Usage:
    yarn tsx devTools/gdocs/backfillRawGdoc.ts [options]

Options:
    --batch-size <n>    Number of rows to process per batch (default: ${DEFAULT_BATCH_SIZE}).
    --dry-run           Log what would be done without making changes.
    --id <gdocId>       Backfill only a single document by id.
    -h, --help          Show this message.

Rate Limiting:
    The script runs at full speed until it hits Google's rate limits (100 req/100s).
    When rate limited (HTTP 429), it uses exponential backoff with the Retry-After
    header if provided, or doubles the wait time on each retry (up to ${MAX_RETRIES} retries).
`)
}

function getRetryAfterMs(error: unknown): number | null {
    if (error instanceof GaxiosError && error.response?.headers) {
        const retryAfter = error.response.headers["retry-after"]
        if (retryAfter) {
            // Retry-After can be seconds or an HTTP date
            const seconds = parseInt(retryAfter, 10)
            if (!isNaN(seconds)) {
                return seconds * 1000
            }
            // Try parsing as date
            const date = Date.parse(retryAfter)
            if (!isNaN(date)) {
                return Math.max(0, date - Date.now())
            }
        }
    }
    return null
}

function isRateLimitError(error: unknown): boolean {
    if (error instanceof GaxiosError) {
        return error.response?.status === 429
    }
    if (error instanceof Error) {
        return (
            error.message.includes("429") ||
            error.message.toLowerCase().includes("rate limit") ||
            error.message.toLowerCase().includes("quota")
        )
    }
    return false
}

async function fetchWithRetry(
    docsClient: docs_v1.Docs,
    documentId: string
): Promise<docs_v1.Schema$Document> {
    let lastError: unknown
    let backoffMs = INITIAL_BACKOFF_MS

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const { data } = await docsClient.documents.get({
                documentId,
                suggestionsViewMode: "PREVIEW_WITHOUT_SUGGESTIONS",
            })
            return data
        } catch (error) {
            lastError = error

            if (!isRateLimitError(error)) {
                throw error
            }

            if (attempt === MAX_RETRIES) {
                throw error
            }

            // Use Retry-After header if available, otherwise exponential backoff
            const retryAfterMs = getRetryAfterMs(error)
            const waitMs = retryAfterMs ?? backoffMs

            console.log(
                `  Rate limited (attempt ${attempt}/${MAX_RETRIES}). ` +
                    `Waiting ${(waitMs / 1000).toFixed(1)}s...`
            )
            await sleep(waitMs)

            // Exponential backoff for next attempt (if no Retry-After)
            if (!retryAfterMs) {
                backoffMs = Math.min(backoffMs * 2, 60000) // Cap at 60s
            }
        }
    }

    throw lastError
}

async function backfillRawGdoc({
    batchSize,
    dryRun,
    id,
}: CliOptions): Promise<void> {
    const knex = db.knexInstance()
    const auth = OwidGoogleAuth.getGoogleReadonlyAuth()
    const docsClient = googleDocs({ version: "v1", auth })

    try {
        // Count documents needing backfill
        const countQuery = knex(PostsGdocsTableName).whereNull("rawGdoc")
        if (id) countQuery.where({ id })
        const countResult = await countQuery.count<{ total: number | string }>({
            total: "*",
        })
        const total = Number(countResult?.[0]?.total ?? 0)

        if (total === 0) {
            console.log(
                id
                    ? `Document ${id} already has rawGdoc or does not exist.`
                    : "All documents already have rawGdoc populated."
            )
            return
        }

        console.log(`Found ${total} documents to backfill.`)
        if (dryRun) {
            console.log("Running in DRY RUN mode - no changes will be made.")
        }

        let processed = 0
        let updated = 0
        const failures: { id: string; error: unknown }[] = []
        const failedIds = new Set<string>()

        while (true) {
            // Query for documents missing rawGdoc (resumable - always fetches next batch)
            // Exclude IDs that have already failed to avoid infinite loops
            const pageQuery = knex
                .table<DbRawPostGdoc>(PostsGdocsTableName)
                .select("id", "revisionId")
                .whereNull("rawGdoc")
                .orderBy("id")
                .limit(batchSize)

            if (id) {
                pageQuery.where({ id })
            }

            if (failedIds.size > 0) {
                pageQuery.whereNotIn("id", Array.from(failedIds))
            }

            const rows = await pageQuery
            if (!rows.length) break

            for (const row of rows) {
                processed += 1
                try {
                    console.log(
                        `[${processed}/${total}] Fetching document ${row.id}...`
                    )

                    if (!dryRun) {
                        const data = await fetchWithRetry(docsClient, row.id)
                        const rawGdoc = JSON.stringify(data)

                        await knex
                            .table(PostsGdocsTableName)
                            .where({ id: row.id })
                            .update({ rawGdoc })

                        updated += 1

                        // Check if revision changed
                        if (data.revisionId !== row.revisionId) {
                            console.log(
                                `  Warning: revisionId changed (${row.revisionId} -> ${data.revisionId}). ` +
                                    `Content may have been updated since last sync.`
                            )
                        }
                    } else {
                        console.log(`  [dry-run] Would fetch and store rawGdoc`)
                        updated += 1
                    }
                } catch (error: unknown) {
                    failures.push({ id: row.id, error })
                    failedIds.add(row.id)
                    const errorMessage =
                        error instanceof Error ? error.message : String(error)
                    console.error(
                        `  Error fetching document ${row.id}: ${errorMessage}`
                    )
                }
            }

            if (id) break
        }

        console.log(
            `\nFinished backfilling rawGdoc. ` +
                `Updated ${updated} of ${processed} documents.`
        )
        if (failures.length) {
            console.log(
                `Skipped ${failures.length} documents due to errors:\n${failures
                    .map(
                        ({ id: gdocId, error }) =>
                            ` - ${gdocId}: ${(error as Error)?.message ?? error}`
                    )
                    .join("\n")}`
            )
            console.log(
                `\nNote: Skipped documents still have rawGdoc=NULL. ` +
                    `They may be deleted or inaccessible to the service account.`
            )
        }
    } finally {
        await db.closeTypeOrmAndKnexConnections()
    }
}

function parseCli(): CliOptions | null {
    const parsed = parseArgs(process.argv.slice(2))
    if (parsed.h || parsed.help) {
        printHelp()
        return null
    }

    const batchSizeArg = parsed["batch-size"] ?? parsed.batchSize
    const batchSize = Number(batchSizeArg ?? DEFAULT_BATCH_SIZE)
    if (!Number.isFinite(batchSize) || batchSize <= 0) {
        throw new Error("--batch-size must be a positive number")
    }

    const dryRun = Boolean(parsed["dry-run"])
    const id = parsed.id ?? parsed._?.[0]

    return { batchSize, dryRun, id }
}

async function main(): Promise<void> {
    try {
        const options = parseCli()
        if (!options) return
        await backfillRawGdoc(options)
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    }
}

void main()
