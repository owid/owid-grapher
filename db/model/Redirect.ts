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

/**
 * Takes a list of redirects and returns a map of source -> target
 * such that if you have [A -> B, B -> C], the map will be { A -> C, B -> C }
 */
export function resolveRedirects(
    redirects: Pick<DbPlainRedirect, "source" | "target">[]
): Map<string, string> {
    const asMap = new Map<string, string>(
        redirects.map(({ source, target }) => [source, target])
    )
    const resolved = new Map<string, string>()

    for (const [source, target] of asMap) {
        let current = target
        while (asMap.has(current)) {
            current = asMap.get(current)!
        }
        resolved.set(source, current)
    }

    return resolved
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

export async function getChainedRedirect(
    knex: db.KnexReadonlyTransaction,
    source: string,
    target: string
): Promise<Pick<DbPlainRedirect, "source" | "target"> | undefined> {
    return await db.knexRawFirst(
        knex,
        `SELECT source, target FROM redirects WHERE source = ? OR target = ?`,
        [target, source]
    )
}

export async function deleteExpiredRedirects(
    knex: db.KnexReadWriteTransaction
): Promise<void> {
    await db.knexRaw(knex, "DELETE FROM redirects WHERE ttl < NOW()")
}
