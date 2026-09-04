import fs from "fs"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import parseArgs from "minimist"
import { GdocMigration } from "./types.js"
import {
    runApply,
    runPlan,
    runStatus,
    runVerify,
    teardownDb,
} from "./engine/runner.js"
import { runDbPlan } from "./engine/dbPlan.js"
import { runCreateTestDoc } from "./engine/testDoc.js"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(moduleDir, "../../db/gdocMigrations/migrations")
const defaultJournalDir = path.join(moduleDir, "runs")

function printHelp(): void {
    console.log(`Run a gdoc migration against source Google Docs.
See docs/gdoc-migrations.md for the full workflow.

Usage:
    yarn gdocMigration <command> --migration <name> [options]

Commands (gdoc side):
    plan      Fetch candidate docs, compute edits, print a grouped report.
              Writes the journal but never writes to Google or the DB.
    apply     Re-plan each doc against a fresh fetch and apply the edits,
              guarded by the doc's revisionId. Verifies each doc afterwards.
              Resumable: docs already verified are skipped (see --force).
    verify    Re-check docs: the migration must be a no-op everywhere.
    status    Print the journal summary.

Commands (authoring a migration):
    db-plan          Dry-run the DB side (dbTransform / frontmatter ops)
                     against the local posts_gdocs table and print what
                     would change, grouped by diff shape. Writes nothing.
    create-test-doc  Create a Google Doc filled with real samples of the
                     migration's target (one per distinct shape, copied
                     from discovered docs) to plan/apply/verify against.

Options:
    --migration, -m <name>   Migration name (a file in migrations/).
    --id <docId>             Target specific doc id(s); repeatable. Skips SQL
                             discovery, so it works for docs not in the DB
                             (e.g. a personal test doc). For create-test-doc:
                             the docs to sample from.
    --published-only         Restrict discovered docs to published gdocs.
    --concurrency <n>        Max concurrent docs/API calls (default: 4).
    --journal-dir <path>     Where journals live (default: devTools/gdocMigrations/runs).
    --force                  Re-process docs the journal considers done.
    --limit <n>              db-plan: changed docs to print in full (default: 5).
    --sample-docs <n>        create-test-doc: source docs to fetch (default: 15).
    --max-samples <n>        create-test-doc: distinct samples to keep (default: 12).
    --folder <driveFolderId> create-test-doc: where to create the doc
                             (default: GDOCS_MIGRATION_TEST_FOLDER).
    --share <email>          create-test-doc: share the doc with this address
                             as an editor; repeatable.
    --dry-run                create-test-doc: print the ArchieML, create nothing.
    -h, --help               Show this message.
`)
}

function isGdocMigration(value: unknown): value is GdocMigration {
    const migration = value as Record<string, unknown> | null
    if (
        typeof migration?.name !== "string" ||
        typeof migration.discover !== "string"
    ) {
        return false
    }
    if (migration.mode === "component") {
        return (
            typeof migration.blockType === "string" &&
            typeof migration.transform === "function"
        )
    }
    if (migration.mode === "frontmatter") {
        return Array.isArray(migration.ops)
    }
    return false
}

async function loadMigration(name: string): Promise<GdocMigration> {
    const candidates = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".ts"))
        .filter(
            (file) =>
                file === `${name}.ts` || file.replace(/\.ts$/, "") === name
        )
    const files = candidates.length
        ? candidates
        : fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".ts"))

    for (const file of files) {
        const imported = (await import(
            pathToFileURL(path.join(migrationsDir, file)).href
        )) as { default?: unknown }
        if (isGdocMigration(imported.default) && imported.default.name === name)
            return imported.default
    }
    throw new Error(
        `no migration named "${name}" found in ${migrationsDir} — expected a file with a defineGdocMigration default export`
    )
}

interface CliOptions {
    command: string
    migrationName: string
    ids?: string[]
    publishedOnly: boolean
    concurrency: number
    journalDir: string
    force: boolean
    limit: number
    sampleDocs: number
    maxSamples: number
    folder?: string
    shareWith: string[]
    dryRun: boolean
}

const COMMANDS = [
    "plan",
    "apply",
    "verify",
    "status",
    "db-plan",
    "create-test-doc",
]

function positiveInteger(
    value: unknown,
    flag: string,
    fallback: number
): number {
    const number = Number(value ?? fallback)
    if (!Number.isInteger(number) || number <= 0) {
        throw new Error(`${flag} must be a positive integer`)
    }
    return number
}

function stringList(value: unknown): string[] | undefined {
    if (value === undefined) return undefined
    return (Array.isArray(value) ? value : [value]).map(String)
}

function parseCli(): CliOptions | null {
    const parsed = parseArgs(process.argv.slice(2))
    if (parsed.h || parsed.help || parsed._.length === 0) {
        printHelp()
        return null
    }
    const command = String(parsed._[0])
    if (!COMMANDS.includes(command)) {
        throw new Error(`unknown command "${command}" — see --help`)
    }
    const migrationName = parsed.migration ?? parsed.m
    if (typeof migrationName !== "string") {
        throw new Error("--migration <name> is required")
    }
    return {
        command,
        migrationName,
        ids: stringList(parsed.id),
        publishedOnly: Boolean(parsed["published-only"]),
        concurrency: positiveInteger(parsed.concurrency, "--concurrency", 4),
        journalDir: parsed["journal-dir"]
            ? String(parsed["journal-dir"])
            : defaultJournalDir,
        force: Boolean(parsed.force),
        limit: positiveInteger(parsed.limit, "--limit", 5),
        sampleDocs: positiveInteger(parsed["sample-docs"], "--sample-docs", 15),
        maxSamples: positiveInteger(parsed["max-samples"], "--max-samples", 12),
        folder: parsed.folder ? String(parsed.folder) : undefined,
        shareWith: stringList(parsed.share) ?? [],
        dryRun: Boolean(parsed["dry-run"]),
    }
}

async function main(): Promise<void> {
    try {
        const options = parseCli()
        if (!options) return
        const migration = await loadMigration(options.migrationName)
        const runnerOptions = {
            migration,
            ids: options.ids,
            publishedOnly: options.publishedOnly,
            concurrency: options.concurrency,
            journalDir: options.journalDir,
            force: options.force,
        }
        switch (options.command) {
            case "plan":
                await runPlan(runnerOptions)
                break
            case "apply":
                await runApply(runnerOptions)
                break
            case "verify":
                await runVerify(runnerOptions)
                break
            case "status":
                runStatus(runnerOptions)
                break
            case "db-plan":
                await runDbPlan({
                    migration,
                    ids: options.ids,
                    limit: options.limit,
                })
                break
            case "create-test-doc":
                await runCreateTestDoc({
                    migration,
                    ids: options.ids,
                    publishedOnly: options.publishedOnly,
                    concurrency: options.concurrency,
                    sampleDocs: options.sampleDocs,
                    maxSamples: options.maxSamples,
                    folder: options.folder,
                    shareWith: options.shareWith,
                    dryRun: options.dryRun,
                })
                break
        }
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await teardownDb()
    }
}

void main()
