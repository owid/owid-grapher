import * as db from "../db/db.js"
import parseArgs from "minimist"
import {
    PostsGdocsTableName,
    parsePostsGdocsRow,
    type DbRawPostGdoc,
} from "@ourworldindata/types"
import { gdocFromJSON } from "../db/model/Gdoc/GdocFactory.js"

const DEFAULT_BATCH_SIZE = 50

type CliOptions = {
    batchSize: number
    id?: string
}

function printHelp(): void {
    console.log(`Regenerate posts_gdocs.markdown from enriched content.

Usage:
    yarn tsx devTools/regenerateGdocMarkdown.ts [options]

Options:
    --batch-size <n>    Number of rows to process per query (default: ${DEFAULT_BATCH_SIZE}).
    --id <gdocId>       Restrict regeneration to a single Google Doc by id.
    -h, --help          Show this message.
`)
}

async function regenerateMarkdown({
    batchSize,
    id,
}: CliOptions): Promise<void> {
    const knex = db.knexInstance()
    try {
        const totalQuery = knex(PostsGdocsTableName)
        if (id) totalQuery.where({ id })
        const totalResult = await totalQuery.count<{ total: number | string }>({
            total: "*",
        })
        const total = Number(totalResult?.[0]?.total ?? 0)

        if (total === 0) {
            console.log(id ? `No gdoc found with id ${id}` : "No gdocs found.")
            return
        }

        let offset = 0
        let processed = 0
        let updated = 0
        const failures: { id: string; error: unknown }[] = []

        while (true) {
            const pageQuery = knex
                .table<DbRawPostGdoc>(PostsGdocsTableName)
                .orderBy("id")
                .limit(batchSize)
            if (id) {
                pageQuery.where({ id })
            } else {
                pageQuery.offset(offset)
            }

            const rows = await pageQuery
            if (!rows.length) break

            for (const row of rows) {
                processed += 1
                try {
                    const enrichedRow = parsePostsGdocsRow(row)
                    const gdoc = gdocFromJSON(enrichedRow as any)
                    gdoc.updateMarkdown()
                    const nextMarkdown = gdoc.markdown ?? null
                    if (nextMarkdown !== row.markdown) {
                        await knex
                            .table(PostsGdocsTableName)
                            .where({ id: row.id })
                            .update({
                                markdown: nextMarkdown,
                                updatedAt: row.updatedAt,
                            })
                        updated += 1
                    }
                } catch (error) {
                    failures.push({ id: row.id, error })
                    console.error(
                        `Failed to regenerate markdown for gdoc ${row.id}`,
                        error
                    )
                }
            }

            if (id) break
            offset += rows.length
            console.log(
                `Processed ${processed}/${total} documents (${updated} updated so far)`
            )
        }

        console.log(
            `Finished regenerating markdown. Updated ${updated} of ${processed} documents. ${processed - updated - failures.length} unchanged.`
        )
        if (failures.length) {
            console.log(
                `Encountered ${failures.length} errors:\n${failures
                    .map(
                        ({ id: gdocId, error }) =>
                            ` - ${gdocId}: ${(error as Error)?.message ?? error}`
                    )
                    .join("\n")}`
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

    const id = parsed.id ?? parsed._?.[0]

    return { batchSize, id }
}

async function main(): Promise<void> {
    try {
        const options = parseCli()
        if (!options) return
        await regenerateMarkdown(options)
    } catch (error) {
        console.error(error)
        process.exitCode = 1
    }
}

void main()
