import { DbPlainPostGdocTombstone } from "@ourworldindata/types"
import * as db from "../db"

export async function getTombstones(
    knex: db.KnexReadonlyTransaction
): Promise<
    Pick<
        DbPlainPostGdocTombstone,
        | "id"
        | "slug"
        | "reason"
        | "includeArchiveLink"
        | "relatedLinkUrl"
        | "relatedLinkTitle"
        | "relatedLinkDescription"
        | "relatedLinkThumbnail"
    >[]
> {
    return await db.knexRaw(
        knex,
        `-- sql
        SELECT
            id,
            slug,
            reason,
            includeArchiveLink,
            relatedLinkUrl,
            relatedLinkTitle,
            relatedLinkDescription,
            relatedLinkThumbnail
        FROM posts_gdocs_tombstones`
    )
}

export async function getTombstoneBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<
    | Pick<
          DbPlainPostGdocTombstone,
          | "slug"
          | "reason"
          | "includeArchiveLink"
          | "relatedLinkUrl"
          | "relatedLinkTitle"
          | "relatedLinkDescription"
          | "relatedLinkThumbnail"
      >
    | undefined
> {
    return await db.knexRawFirst(
        knex,
        `-- sql
        SELECT
            slug,
            reason,
            includeArchiveLink,
            relatedLinkUrl,
            relatedLinkTitle,
            relatedLinkDescription,
            relatedLinkThumbnail
        FROM posts_gdocs_tombstones WHERE slug = ?`,
        [slug]
    )
}
