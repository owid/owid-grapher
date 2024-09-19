import { DbPlainPostGdocTombstone } from "@ourworldindata/types"
import * as db from "../db"

export async function getTombstones(
    knex: db.KnexReadonlyTransaction
): Promise<
    Pick<DbPlainPostGdocTombstone, "id" | "slug" | "reason" | "relatedLink">[]
> {
    return await db.knexRaw(
        knex,
        `-- sql
        SELECT id, slug, reason, relatedLink
        FROM posts_gdocs_tombstones`
    )
}

export async function getTombstoneBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<
    | Pick<DbPlainPostGdocTombstone, "slug" | "reason" | "relatedLink">
    | undefined
> {
    return await db.knexRawFirst(
        knex,
        `-- sql
        SELECT slug, reason, relatedLink
        FROM posts_gdocs_tombstones WHERE slug = ?`,
        [slug]
    )
}
