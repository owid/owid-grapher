import * as db from "../../../db/db.js"

/**
 * Get all existing search suggestions from the database
 */
export async function getAllSearchSuggestions(
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, { suggestion: string; score: number }>> {
    const rows = await db.knexRaw<{
        title: string
        suggestion: string
        score: number
    }>(
        knex,
        `-- sql
        SELECT title, suggestion, score
        FROM search_suggestions
        `
    )

    // Create a map of title to suggestion and score for fast lookups
    return new Map(
        rows.map((row) => [
            row.title,
            { suggestion: row.suggestion, score: row.score },
        ])
    )
}

/**
 * Store a search suggestion in the database
 */
export async function upsertSearchSuggestion(
    knex: db.KnexReadWriteTransaction,
    title: string,
    suggestion: string,
    score: number
): Promise<void> {
    if (!suggestion) return

    await knex
        .table("search_suggestions")
        .insert({
            title,
            suggestion,
            score,
        })
        .onConflict("title")
        .merge() // Update the suggestion and score if the title already exists
}
