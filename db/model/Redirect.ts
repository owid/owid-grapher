import { DbPlainRedirect } from "@ourworldindata/types"
import * as db from "../db"

export const getRedirectsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<Pick<DbPlainRedirect, "source" | "target" | "code">[]> => {
    return await db.knexRaw(knex, `SELECT source, target, code FROM redirects`)
}

export async function getRedirects(
    knex: db.KnexReadonlyTransaction
): Promise<Pick<DbPlainRedirect, "id" | "source" | "target">[]> {
    return await db.knexRaw(
        knex,
        `SELECT id, source, target FROM redirects ORDER BY id DESC`
    )
}

export async function getRedirectById(
    knex: db.KnexReadonlyTransaction,
    id: number
): Promise<Pick<DbPlainRedirect, "id" | "source" | "target"> | undefined> {
    return await db.knexRawFirst(
        knex,
        `SELECT id, source, target FROM redirects WHERE id = ?`,
        [id]
    )
}

export async function redirectWithSourceExists(
    knex: db.KnexReadonlyTransaction,
    source: string
): Promise<boolean> {
    const result = await db.knexRawFirst(
        knex,
        `SELECT 1 FROM redirects WHERE source = ?`,
        [source]
    )
    return Boolean(result)
}

export async function wouldCreateRedirectCycle(
    knex: db.KnexReadonlyTransaction,
    source: string,
    target: string
): Promise<boolean> {
    const result: { cycleExists: number } | undefined = await db.knexRawFirst(
        knex,
        `WITH RECURSIVE redirect_chain AS (
            -- Base case: Start with the target of the proposed new redirect.
            SELECT source, target
            FROM redirects
            WHERE source = ?

            UNION ALL

            -- Recursive step: Follow the chain of redirects.
            SELECT r.source, r.target
            FROM redirects r
            INNER JOIN redirect_chain rc ON rc.target = r.source
        )
         -- Check if the new source appears in the redirect chain starting from
         -- the new target.
         SELECT COUNT(*) > 0 AS cycleExists
         FROM redirect_chain
         WHERE source = ? OR target = ?`,
        [target, source, source]
    )
    return Boolean(result?.cycleExists)
}
