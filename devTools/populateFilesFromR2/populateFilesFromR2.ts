import { DbInsertFile, FilesTableName } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { listAllFilesInAssetsR2 } from "../../serverUtils/r2/assetsR2Helpers.js"
import { _Object } from "@aws-sdk/client-s3"

async function extractFileMetadata(
    r2Files: _Object[]
): Promise<DbInsertFile[]> {
    const files: DbInsertFile[] = []

    for (const file of r2Files) {
        const path = file.Key?.slice(0, file.Key.lastIndexOf("/"))
        const filename = file.Key?.slice(file.Key.lastIndexOf("/") + 1)
        const etag = file.ETag?.replace(/"/g, "") // Remove quotes from ETag
        if (!filename || !path || !etag) {
            console.warn("Skipping file with missing metadata:", file.Key)
            continue
        }

        // Don't need to track these programmatically uploaded files
        if (path === "exports" || path === "grapher/exports") {
            continue
        }

        files.push({
            filename,
            path,
            etag,
            createdAt: file.LastModified || new Date(),
            createdBy: null, // No user info available from R2
        })
    }

    return files
}

async function populateFilesTable(dryRun: boolean = false): Promise<void> {
    console.log("Fetching files from R2...")

    try {
        const r2Files = await listAllFilesInAssetsR2()
        console.log(`Found ${r2Files.length} files in R2`)

        const fileRecords = await extractFileMetadata(r2Files)
        console.log(`Extracted ${fileRecords.length} valid file records`)

        if (dryRun) {
            console.log("DRY RUN - Would insert the following files:")
            fileRecords.forEach((file, index) => {
                console.log(`${index + 1}. ${file.filename} (${file.path})`)
            })
            return
        }

        if (fileRecords.length === 0) {
            console.log("No files to insert")
            return
        }

        console.log("💾 Inserting files into database...")
        await db.knexInstance().transaction(async (trx) => {
            // Insert in batches to avoid overwhelming the database
            const batchSize = 100
            for (let i = 0; i < fileRecords.length; i += batchSize) {
                const batch = fileRecords.slice(i, i + batchSize)
                try {
                    await trx<DbInsertFile>(FilesTableName).insert(batch)
                    console.log(
                        `Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(fileRecords.length / batchSize)}`
                    )
                } catch (error) {
                    console.error(
                        `Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
                        error
                    )
                    // Log the problematic records
                    batch.forEach((record, idx) => {
                        console.log(
                            `  ${idx + 1}. ${record.filename} (${record.path})`
                        )
                    })
                    throw error
                }
            }
        })

        console.log(
            `Successfully populated files table with ${fileRecords.length} records`
        )
    } catch (error) {
        console.error("Error populating files table:", error)
        throw error
    }
}

/**
 * A script intended to be run once in prod. Ensure the OWID_ASSETS_R2_ env variables are set.
 * Usage:
 *  yarn tsx --tsconfig tsconfig.tsx.json  devTools/populateFilesFromR2/populateFilesFromR2.ts [--dry-run]
 **/

async function main() {
    const args = process.argv.slice(2)
    const dryRun = args.includes("--dry-run")

    if (dryRun) {
        console.log("Running in DRY RUN mode - no changes will be made")
    }

    try {
        await populateFilesTable(dryRun)
    } catch (error) {
        console.error("Script failed:", error)
        process.exit(1)
    } finally {
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
    .catch((error) => {
        console.error("Error in main function:", error)
        process.exit(1)
    })
    .finally(() => {
        console.log("Script execution completed")
    })
