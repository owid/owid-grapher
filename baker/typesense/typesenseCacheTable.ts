import { Client } from "typesense"
import * as db from "../../db/db.js"
import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js"
import { eng as ENGLISH_STOPWORDS } from "stopword"

export const checkTableExistsAndNotEmpty = async (
    tableName: string
): Promise<boolean> => {
    try {
        return await db.knexReadonlyTransaction(async (trx) => {
            // First check if table exists
            const tableExistsResult = await trx.raw(
                `
                SELECT COUNT(*) as count
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                AND table_name = ?
            `,
                [tableName]
            )

            if (tableExistsResult[0][0].count === 0) {
                return false
            }

            // Then check if table has records
            const recordCountResult = await trx.raw(
                `SELECT COUNT(*) as count FROM ??`,
                [tableName]
            )

            return recordCountResult[0][0].count > 0
        }, db.TransactionCloseMode.Close)
    } catch (error) {
        console.error(
            `Error checking if table ${tableName} exists and is not empty:`,
            error
        )
        return false
    }
}

export const createCacheTable = async (tableName: string) => {
    return await db.knexReadWriteTransaction(async (trx) => {
        await trx.raw(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id VARCHAR(255) PRIMARY KEY,
                record_data JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `)
        console.log(`Created cache table: ${tableName}`)
    }, db.TransactionCloseMode.Close)
}

export const saveRecordsToCache = async <
    T extends { objectID: string; id?: string },
>(
    tableName: string,
    records: T[]
) => {
    return db.knexReadWriteTransaction(async (trx) => {
        // Clear existing records
        await trx(tableName).del()

        // Insert new records in batches
        const batchSize = 1000
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize)
            const insertData = batch.map((record) => ({
                id: record.objectID || record.id,
                record_data: JSON.stringify(record),
            }))
            await trx(tableName).insert(insertData)
        }
        console.log(
            `Saved ${records.length} records to cache table: ${tableName}`
        )
    }, db.TransactionCloseMode.Close)
}

export const loadRecordsFromCache = async <T>(
    tableName: string
): Promise<T[]> => {
    return await db.knexReadonlyTransaction(async (trx) => {
        const rows = await trx(tableName).select("record_data")
        const records = rows.map((row) => JSON.parse(row.record_data) as T)
        console.log(
            `Loaded ${records.length} records from cache table: ${tableName}`
        )
        return records
    }, db.TransactionCloseMode.Close)
}

// Collection management functions
/**
 * Ensures the "english" stopwords set exists in Typesense.
 * This is idempotent — calling it multiple times is safe (upsert).
 * The stopwords set is referenced by search queries via `stopwords: "english"`.
 */
export const ensureStopwordsSet = async (client: Client): Promise<void> => {
    try {
        await client.stopwords().upsert("english", {
            stopwords: ENGLISH_STOPWORDS,
        })
        console.log("Ensured 'english' stopwords set exists")
    } catch (error) {
        console.error("Failed to create stopwords set:", error)
        throw error
    }
}

export const recreateCollection = async (
    client: Client,
    schema: CollectionCreateSchema,
    collectionName: string
) => {
    try {
        // Try to delete existing collection
        try {
            await client.collections(collectionName).delete()
            console.log(`Deleted existing collection: ${collectionName}`)
        } catch (error) {
            // Ignore if collection doesn't exist
        }

        // Create new collection
        await client.collections().create(schema)
        console.log(`Created collection: ${collectionName}`)
    } catch (error) {
        console.error(`Error creating collection ${collectionName}:`, error)
        throw error
    }
}
