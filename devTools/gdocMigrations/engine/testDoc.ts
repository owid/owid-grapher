import { createGdocFromArchieMlLines } from "../../../db/model/Gdoc/archieToGdoc.js"
import { GDOCS_MIGRATION_TEST_FOLDER } from "../../../settings/serverSettings.js"
import { FrontmatterOp, GdocMigration } from "../types.js"
import { gdocToSourceMappedLines } from "./sourceMap.js"
import { scanScopes } from "./scopeScanner.js"
import {
    collectBlockSamples,
    collectFrontmatterSamples,
    dedupeSamples,
    Sample,
    SampleSkipReason,
} from "./sampleBlocks.js"
import { resolveIds } from "./runner.js"
import { ThrottledDocsClient } from "./throttledDocsClient.js"

export interface TestDocOptions {
    migration: GdocMigration
    /** Source docs to sample from; default: the migration's discover query */
    ids?: string[]
    publishedOnly?: boolean
    concurrency: number
    /** How many source docs to fetch and sample from */
    sampleDocs: number
    /** How many distinct samples to include in the test doc */
    maxSamples: number
    /** Drive folder to create the doc in */
    folder?: string
    /** Email addresses to share the doc with (as editors) */
    shareWith: string[]
    /** Print the doc's ArchieML instead of creating it */
    dryRun: boolean
}

function docUrl(gdocId: string): string {
    return `https://docs.google.com/document/d/${gdocId}/edit`
}

/** Spreads `count` picks evenly over the list, for variety across the corpus */
function spread<T>(items: T[], count: number): T[] {
    if (items.length <= count) return items
    const step = items.length / count
    return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)])
}

function frontmatterOpKeys(op: FrontmatterOp): string[] {
    return op.kind === "rename-key" ? [op.from, op.to] : [op.key]
}

/**
 * Assembles a minimal, parseable article around the samples. Component
 * samples go into the body, each preceded by a plain paragraph naming its
 * source; frontmatter samples go at the top, one per key (the first sample
 * per key wins — create further docs with --id to cover other shapes).
 */
export function buildTestDocLines(
    migration: GdocMigration,
    samples: Sample[]
): string[] {
    const title = `Migration test doc: ${migration.name}`
    const lines: string[] = []

    if (migration.mode === "frontmatter") {
        // a doc can hold each top-level key only once
        const firstPerKey = new Map<string, Sample>()
        for (const sample of samples) {
            const key = sample.lines[0].split(":")[0].trim().toLowerCase()
            if (!firstPerKey.has(key)) firstPerKey.set(key, sample)
        }
        if (!firstPerKey.has("title")) lines.push(`title: ${title}`)
        if (!firstPerKey.has("type")) lines.push("type: article")
        for (const sample of firstPerKey.values()) lines.push(...sample.lines)
        lines.push("", "[+body]", "")
        lines.push(
            `Test doc for the "${migration.name}" frontmatter migration. Sampled from: ` +
                [...new Set(samples.map((s) => docUrl(s.sourceGdocId)))].join(
                    ", "
                )
        )
        lines.push("", "[]")
        return lines
    }

    lines.push(`title: ${title}`, "type: article", "", "[+body]", "")
    samples.forEach((sample, index) => {
        lines.push(
            `Sample ${index + 1} of ${samples.length} — copied from ${docUrl(sample.sourceGdocId)}`,
            ""
        )
        lines.push(...sample.lines, "")
    })
    lines.push("[]")
    return lines
}

export async function runCreateTestDoc(options: TestDocOptions): Promise<void> {
    const { migration } = options
    const candidates = await resolveIds({
        migration,
        ids: options.ids,
        publishedOnly: options.publishedOnly,
        journalDir: "",
        concurrency: options.concurrency,
    })
    const sourceIds = spread(candidates, options.sampleDocs)
    console.log(
        `Sampling {${migration.mode === "component" ? `.${migration.blockType}` : "frontmatter"}} from ${sourceIds.length} of ${candidates.length} candidate doc(s)…`
    )

    const client = new ThrottledDocsClient({ concurrency: options.concurrency })
    const allSamples: Sample[] = []
    const skipped: Record<SampleSkipReason, number> = {
        "contains-chip": 0,
        "contains-inline-object": 0,
        "non-paragraph-lines": 0,
    }
    for (const gdocId of sourceIds) {
        let document
        try {
            document = await client.getDocument(gdocId)
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            console.warn(`Skipping ${gdocId}: could not fetch (${message})`)
            continue
        }
        const lines = gdocToSourceMappedLines(document)
        const scan = scanScopes(lines)
        const collection =
            migration.mode === "component"
                ? collectBlockSamples(gdocId, lines, scan, migration.blockType)
                : collectFrontmatterSamples(
                      gdocId,
                      lines,
                      scan,
                      migration.ops.flatMap(frontmatterOpKeys)
                  )
        allSamples.push(...collection.samples)
        for (const [reason, count] of Object.entries(collection.skipped)) {
            skipped[reason as SampleSkipReason] += count
        }
    }

    const samples = dedupeSamples(allSamples, options.maxSamples)
    const shapes = new Set(allSamples.map((sample) => sample.shape))
    console.log(
        `Found ${allSamples.length} sample(s) in ${shapes.size} distinct shape(s); keeping ${samples.length}:`
    )
    for (const sample of samples) {
        console.log(`  ${sample.shape || "(no properties)"}`)
    }
    const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0)
    if (skippedTotal > 0) {
        console.log(
            `Skipped ${skippedTotal} sample(s) the Docs API can't re-create faithfully: ` +
                Object.entries(skipped)
                    .filter(([, count]) => count > 0)
                    .map(([reason, count]) => `${reason} ×${count}`)
                    .join(", ")
        )
    }
    if (samples.length === 0) {
        console.log("Nothing to write — no usable samples found.")
        return
    }

    const docLines = buildTestDocLines(migration, samples)
    if (options.dryRun) {
        console.log("\n--- test doc ArchieML (dry run, nothing created) ---")
        console.log(docLines.join("\n"))
        return
    }

    const folder = options.folder ?? GDOCS_MIGRATION_TEST_FOLDER
    if (!folder) {
        throw new Error(
            "no Drive folder: pass --folder <id> or set GDOCS_MIGRATION_TEST_FOLDER (or GDOCS_BACKPORTING_TARGET_FOLDER) in .env"
        )
    }
    const gdocId = await createGdocFromArchieMlLines(
        `Migration test doc: ${migration.name}`,
        docLines,
        folder,
        options.shareWith
    )
    console.log(`\nCreated ${docUrl(gdocId)}`)
    if (options.shareWith.length > 0)
        console.log(`Shared with: ${options.shareWith.join(", ")}`)
    console.log(`
Next:
    yarn gdocMigration plan   --migration ${migration.name} --id ${gdocId}
    yarn gdocMigration apply  --migration ${migration.name} --id ${gdocId}
    yarn gdocMigration verify --migration ${migration.name} --id ${gdocId}`)
}
