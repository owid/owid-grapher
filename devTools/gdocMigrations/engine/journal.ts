import fs from "fs"
import path from "path"
import { PatchFlag } from "../types.js"

export type JournalDocStatus =
    | "planned" // plan computed edits for this doc
    | "no-match" // no blocks of the target type (or nothing to change)
    | "flagged" // fails closed — needs manual handling
    | "applied" // batchUpdate succeeded
    | "verified" // post-apply checks passed
    | "failed" // apply or verification failed; see error

export interface JournalDocEntry {
    status: JournalDocStatus
    updatedAt: string
    editSummaries?: string[]
    flags?: PatchFlag[]
    /** The doc revision the plan was computed against */
    plannedRevisionId?: string | null
    error?: string
}

export interface JournalData {
    migration: string
    startedAt: string
    updatedAt: string
    docs: Record<string, JournalDocEntry>
}

/**
 * Per-migration, per-doc state, persisted to disk after every update so a
 * crashed or interrupted run can resume: docs already "verified" (or
 * terminally "flagged"/"no-match") are skipped on re-run unless --force.
 */
export class Journal {
    readonly filePath: string
    private readonly data: JournalData

    constructor(journalDir: string, migrationName: string) {
        fs.mkdirSync(journalDir, { recursive: true })
        this.filePath = path.join(journalDir, `${migrationName}.json`)
        if (fs.existsSync(this.filePath)) {
            this.data = JSON.parse(
                fs.readFileSync(this.filePath, "utf8")
            ) as JournalData
        } else {
            this.data = {
                migration: migrationName,
                startedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                docs: {},
            }
        }
    }

    get(gdocId: string): JournalDocEntry | undefined {
        return this.data.docs[gdocId]
    }

    entries(): Array<[string, JournalDocEntry]> {
        return Object.entries(this.data.docs)
    }

    update(gdocId: string, entry: Omit<JournalDocEntry, "updatedAt">): void {
        this.data.docs[gdocId] = {
            ...entry,
            updatedAt: new Date().toISOString(),
        }
        this.data.updatedAt = new Date().toISOString()
        this.save()
    }

    private save(): void {
        fs.writeFileSync(
            this.filePath,
            JSON.stringify(this.data, null, 2),
            "utf8"
        )
    }

    countByStatus(): Record<string, number> {
        const counts: Record<string, number> = {}
        for (const entry of Object.values(this.data.docs)) {
            counts[entry.status] = (counts[entry.status] ?? 0) + 1
        }
        return counts
    }
}
