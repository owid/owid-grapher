import * as db from "../../../db/db.js"

/**
 * Get all existing search suggestions from the database
 */
export async function getAllSearchSuggestions(
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, string>> {
    const rows = await db.knexRaw<{ title: string; suggestion: string }>(
        knex,
        `-- sql
        SELECT title, suggestion
        FROM search_suggestions
        `
    )

    // Create a map of title to suggestion for fast lookups
    return new Map(rows.map((row) => [row.title, row.suggestion]))
}

/**
 * Store a search suggestion in the database
 */
export async function upsertSearchSuggestion(
    knex: db.KnexReadWriteTransaction,
    title: string,
    suggestion: string
): Promise<void> {
    // If there is no valid suggestion, don't insert anything
    if (!suggestion) return

    await knex
        .table("search_suggestions")
        .insert({
            title,
            suggestion,
        })
        .onConflict("title")
        .merge() // Update the suggestion if the title already exists
}
