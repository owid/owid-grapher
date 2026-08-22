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

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(moduleDir, "../../db/gdocMigrations/migrations")
const defaultJournalDir = path.join(moduleDir, "runs")

function printHelp(): void {
    console.log(`Run a gdoc migration against source Google Docs.
See docs/gdoc-migrations.md for the full workflow.

Usage:
    yarn gdocMigration <plan|apply|verify|status> --migration <name> [options]

Commands:
    plan      Fetch candidate docs, compute edits, print a grouped report.
              Writes the journal but never writes to Google or the DB.
    apply     Re-plan each doc against a fresh fetch and apply the edits,
              guarded by the doc's revisionId. Verifies each doc afterwards.
              Resumable: docs already verified are skipped (see --force).
    verify    Re-check docs: the migration must be a no-op everywhere.
    status    Print the journal summary.

Options:
    --migration, -m <name>   Migration name (a file in migrations/).
    --id <docId>             Target specific doc id(s); repeatable. Skips SQL
                             discovery, so it works for docs not in the DB
                             (e.g. a personal test doc).
    --published-only         Restrict discovered docs to published gdocs.
    --concurrency <n>        Max concurrent docs/API calls (default: 4).
    --journal-dir <path>     Where journals live (default: devTools/gdocMigrations/runs).
    --force                  Re-process docs the journal considers done.
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
}

function parseCli(): CliOptions | null {
    const parsed = parseArgs(process.argv.slice(2))
    if (parsed.h || parsed.help || parsed._.length === 0) {
        printHelp()
        return null
    }
    const command = String(parsed._[0])
    if (!["plan", "apply", "verify", "status"].includes(command)) {
        throw new Error(`unknown command "${command}" — see --help`)
    }
    const migrationName = parsed.migration ?? parsed.m
    if (typeof migrationName !== "string") {
        throw new Error("--migration <name> is required")
    }
    const rawIds = parsed.id
    const ids =
        rawIds === undefined
            ? undefined
            : (Array.isArray(rawIds) ? rawIds : [rawIds]).map(String)
    const concurrency = Number(parsed.concurrency ?? 4)
    if (!Number.isInteger(concurrency) || concurrency <= 0) {
        throw new Error("--concurrency must be a positive integer")
    }
    return {
        command,
        migrationName,
        ids,
        publishedOnly: Boolean(parsed["published-only"]),
        concurrency,
        journalDir: parsed["journal-dir"]
            ? String(parsed["journal-dir"])
            : defaultJournalDir,
        force: Boolean(parsed.force),
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
        }
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    } finally {
        await teardownDb()
    }
}

void main()
