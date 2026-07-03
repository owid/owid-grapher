import fs from "fs"
import path from "path"
import * as db from "../../../db/db.js"
import { GdocMigration } from "../types.js"
import { gdocToSourceMappedLines } from "./sourceMap.js"
import { DocPlan, planDocumentPatch } from "./planDoc.js"
import { buildExpectedLines, compareToExpectedLines } from "./verifyDoc.js"
import { Journal, JournalDocStatus } from "./journal.js"
import {
    RevisionMismatchError,
    ThrottledDocsClient,
} from "./throttledDocsClient.js"

export interface RunnerOptions {
    migration: GdocMigration
    /** Explicit doc ids; skips SQL discovery (works for docs not in the DB) */
    ids?: string[]
    publishedOnly?: boolean
    journalDir: string
    concurrency: number
    /** Re-process docs the journal already considers resolved */
    force?: boolean
}

async function mapConcurrent<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length)
    let next = 0
    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        async () => {
            while (next < items.length) {
                const index = next++
                results[index] = await fn(items[index])
            }
        }
    )
    await Promise.all(workers)
    return results
}

async function resolveIds(options: RunnerOptions): Promise<string[]> {
    if (options.ids?.length) return options.ids

    const knex = db.knexInstance()
    const rows = await db.knexRaw<Record<string, unknown>>(
        knex,
        options.migration.discover
    )
    let ids = rows
        .map((row) => Object.values(row)[0])
        .filter((value): value is string => typeof value === "string")
    ids = [...new Set(ids)]

    if (options.publishedOnly && ids.length > 0) {
        const published = await db.knexRaw<{ id: string }>(
            knex,
            `SELECT id FROM posts_gdocs WHERE published = 1 AND id IN (${ids.map(() => "?").join(",")})`,
            ids
        )
        const publishedIds = new Set(published.map((row) => row.id))
        ids = ids.filter((id) => publishedIds.has(id))
    }
    return ids
}

export async function teardownDb(): Promise<void> {
    await db.closeTypeOrmAndKnexConnections()
}

interface DocResult {
    gdocId: string
    status: JournalDocStatus
    plan?: DocPlan
    error?: string
}

function planStatus(plan: DocPlan): JournalDocStatus {
    if (plan.flags.length > 0) return "flagged"
    if (plan.requests.length > 0) return "planned"
    return "no-match"
}

export async function runPlan(options: RunnerOptions): Promise<void> {
    const ids = await resolveIds(options)
    const journal = new Journal(options.journalDir, options.migration.name)
    const client = new ThrottledDocsClient({
        concurrency: options.concurrency,
    })
    console.log(
        `Planning "${options.migration.name}" across ${ids.length} doc(s)…`
    )

    const results = await mapConcurrent(
        ids,
        options.concurrency,
        async (gdocId): Promise<DocResult> => {
            try {
                const document = await client.getDocument(gdocId)
                const plan = await planDocumentPatch(
                    gdocId,
                    document,
                    options.migration
                )
                const status = planStatus(plan)
                journal.update(gdocId, {
                    status,
                    editSummaries: plan.editSummaries,
                    flags: plan.flags,
                    plannedRevisionId: plan.revisionId,
                })
                return { gdocId, status, plan }
            } catch (error) {
                const message = errorMessage(error)
                journal.update(gdocId, { status: "failed", error: message })
                return { gdocId, status: "failed", error: message }
            }
        }
    )

    printPlanReport(results)
    console.log(`\nJournal: ${journal.filePath}`)
}

export async function runApply(options: RunnerOptions): Promise<void> {
    const ids = await resolveIds(options)
    const journal = new Journal(options.journalDir, options.migration.name)
    const client = new ThrottledDocsClient({
        concurrency: options.concurrency,
    })

    const pending = options.force
        ? ids
        : ids.filter((id) => journal.get(id)?.status !== "verified")
    const skipped = ids.length - pending.length
    console.log(
        `Applying "${options.migration.name}" to ${pending.length} doc(s)` +
            (skipped > 0 ? ` (${skipped} already verified, skipped)` : "") +
            "…"
    )

    const snapshotDir = path.join(
        options.journalDir,
        "snapshots",
        options.migration.name
    )

    const results = await mapConcurrent(
        pending,
        options.concurrency,
        async (gdocId): Promise<DocResult> => {
            try {
                const result = await applyToDoc(
                    gdocId,
                    client,
                    options.migration,
                    snapshotDir
                )
                journal.update(gdocId, {
                    status: result.status,
                    editSummaries: result.plan?.editSummaries,
                    flags: result.plan?.flags,
                    plannedRevisionId: result.plan?.revisionId,
                    error: result.error,
                })
                return result
            } catch (error) {
                const message = errorMessage(error)
                journal.update(gdocId, { status: "failed", error: message })
                return { gdocId, status: "failed", error: message }
            }
        }
    )

    printApplyReport(results)
    console.log(`\nJournal: ${journal.filePath}`)
}

/**
 * Apply is always computed against a fresh fetch, guarded by
 * writeControl.requiredRevisionId. On a revision conflict (author edited
 * between fetch and write) the doc is re-fetched and re-planned once; a
 * second conflict fails the doc. After a successful write, two independent
 * checks run: the whole-doc expected-lines comparison (catches collateral
 * damage) and a re-plan that must come back a no-op (the semantic
 * invariant: the migrated doc is the transform's fixed point).
 */
async function applyToDoc(
    gdocId: string,
    client: ThrottledDocsClient,
    migration: GdocMigration,
    snapshotDir: string
): Promise<DocResult> {
    let document = await client.getDocument(gdocId)
    let plan = await planDocumentPatch(gdocId, document, migration)

    for (let attempt = 1; ; attempt++) {
        if (plan.flags.length > 0) return { gdocId, status: "flagged", plan }
        if (plan.requests.length === 0)
            return { gdocId, status: "no-match", plan }
        try {
            // Snapshot the exact pre-edit doc JSON for manual recovery
            // (alongside Google's native version history)
            fs.mkdirSync(snapshotDir, { recursive: true })
            fs.writeFileSync(
                path.join(snapshotDir, `${gdocId}.json`),
                JSON.stringify(document, null, 2),
                "utf8"
            )
            await client.batchUpdate(gdocId, plan.requests, plan.revisionId)
            break
        } catch (error) {
            if (error instanceof RevisionMismatchError && attempt === 1) {
                document = await client.getDocument(gdocId)
                plan = await planDocumentPatch(gdocId, document, migration)
                continue
            }
            throw error
        }
    }

    const refetched = await client.getDocument(gdocId)
    const mismatches = compareToExpectedLines(
        buildExpectedLines(plan.lines, plan.blockEdits),
        gdocToSourceMappedLines(refetched)
    )
    const replan = await planDocumentPatch(gdocId, refetched, migration)
    const problems = [
        ...mismatches,
        ...(replan.requests.length > 0 || replan.editSummaries.length > 0
            ? ["re-planning the migrated doc still finds edits to make"]
            : []),
        ...replan.flags.map((flag) => `${flag.reason}: ${flag.detail}`),
    ]
    if (problems.length > 0) {
        return {
            gdocId,
            status: "failed",
            plan,
            error: `applied, but verification failed — restore from version history if needed. ${problems.join("; ")}`,
        }
    }
    return { gdocId, status: "verified", plan }
}

export async function runVerify(options: RunnerOptions): Promise<void> {
    const journal = new Journal(options.journalDir, options.migration.name)
    const ids = options.ids?.length
        ? options.ids
        : journal.entries().map(([gdocId]) => gdocId)
    const client = new ThrottledDocsClient({
        concurrency: options.concurrency,
    })
    console.log(
        `Verifying "${options.migration.name}" across ${ids.length} doc(s)…`
    )

    const results = await mapConcurrent(
        ids,
        options.concurrency,
        async (gdocId): Promise<DocResult> => {
            try {
                const document = await client.getDocument(gdocId)
                const plan = await planDocumentPatch(
                    gdocId,
                    document,
                    options.migration
                )
                const clean =
                    plan.flags.length === 0 && plan.requests.length === 0
                const wasApplied = ["applied", "verified", "failed"].includes(
                    journal.get(gdocId)?.status ?? ""
                )
                const status: JournalDocStatus = clean
                    ? wasApplied
                        ? "verified"
                        : "no-match"
                    : planStatus(plan)
                journal.update(gdocId, {
                    status,
                    editSummaries: plan.editSummaries,
                    flags: plan.flags,
                    plannedRevisionId: plan.revisionId,
                })
                return { gdocId, status, plan }
            } catch (error) {
                const message = errorMessage(error)
                journal.update(gdocId, { status: "failed", error: message })
                return { gdocId, status: "failed", error: message }
            }
        }
    )

    const dirty = results.filter(
        (result) => !["verified", "no-match"].includes(result.status)
    )
    if (dirty.length === 0) {
        console.log(`✓ all ${results.length} doc(s) are clean`)
    } else {
        console.log(`✗ ${dirty.length} doc(s) still need attention:`)
        for (const result of dirty) printDocLine(result)
    }
    console.log(`\nJournal: ${journal.filePath}`)
}

export function runStatus(options: RunnerOptions): void {
    const journal = new Journal(options.journalDir, options.migration.name)
    const counts = journal.countByStatus()
    console.log(`Status for "${options.migration.name}":`)
    for (const [status, count] of Object.entries(counts)) {
        console.log(`  ${status}: ${count}`)
    }
    const needAttention = journal
        .entries()
        .filter(([, entry]) => ["flagged", "failed"].includes(entry.status))
    for (const [gdocId, entry] of needAttention) {
        console.log(`\n  ${gdocId} (${entry.status})`)
        for (const flag of entry.flags ?? []) {
            console.log(`    ${flag.reason}: ${flag.detail}`)
        }
        if (entry.error) console.log(`    ${entry.error}`)
    }
    console.log(`\nJournal: ${journal.filePath}`)
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function printDocLine(result: DocResult): void {
    const detail =
        result.error ??
        result.plan?.flags
            .map((flag) => `${flag.reason}: ${flag.detail}`)
            .join("; ") ??
        ""
    console.log(`  ${result.gdocId} (${result.status}) ${detail}`)
}

const MAX_IDS_SHOWN = 10

/**
 * Groups docs by the shape of their edits so a 200-doc migration reads as a
 * handful of groups plus outliers, instead of 200 individual diffs.
 */
function printPlanReport(results: DocResult[]): void {
    const withEdits = results.filter((result) => result.status === "planned")
    const flagged = results.filter((result) => result.status === "flagged")
    const failed = results.filter((result) => result.status === "failed")
    const noMatch = results.filter((result) => result.status === "no-match")

    console.log(
        `\nPlan: ${withEdits.length} doc(s) with edits, ${flagged.length} flagged, ` +
            `${noMatch.length} without matches, ${failed.length} failed`
    )

    const groups = new Map<string, { gdocIds: string[]; shape: string[] }>()
    for (const result of withEdits) {
        const shape = [...new Set(result.plan?.editSummaries ?? [])].sort()
        const key = shape.join("\n")
        const group = groups.get(key) ?? { gdocIds: [], shape }
        group.gdocIds.push(result.gdocId)
        groups.set(key, group)
    }

    let groupNumber = 1
    for (const group of [...groups.values()].sort(
        (a, b) => b.gdocIds.length - a.gdocIds.length
    )) {
        console.log(
            `\nGroup ${groupNumber++} — ${group.gdocIds.length} doc(s):`
        )
        for (const summary of group.shape) console.log(`  ${summary}`)
        const shown = group.gdocIds.slice(0, MAX_IDS_SHOWN)
        const more = group.gdocIds.length - shown.length
        console.log(
            `  ids: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`
        )
    }

    if (flagged.length > 0) {
        console.log("\nFlagged (manual handling needed):")
        for (const result of flagged) printDocLine(result)
    }
    if (failed.length > 0) {
        console.log("\nFailed:")
        for (const result of failed) printDocLine(result)
    }
}

function printApplyReport(results: DocResult[]): void {
    const counts: Record<string, number> = {}
    for (const result of results) {
        counts[result.status] = (counts[result.status] ?? 0) + 1
    }
    console.log(
        `\nApply: ${Object.entries(counts)
            .map(([status, count]) => `${count} ${status}`)
            .join(", ")}`
    )
    const problems = results.filter((result) =>
        ["flagged", "failed"].includes(result.status)
    )
    if (problems.length > 0) {
        console.log("\nNeeds attention:")
        for (const result of problems) printDocLine(result)
    }
}
