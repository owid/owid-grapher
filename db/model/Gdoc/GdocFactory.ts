import { get, groupBy } from "lodash"
import { match, P } from "ts-pattern"
import {
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    DbEnrichedPostGdoc,
    DbPlainTag,
    DbRawPostGdoc,
    GdocsContentSource,
    OwidEnrichedGdocBlock,
    OwidGdoc,
    OwidGdocBaseInterface,
    OwidGdocIndexItem,
    OwidGdocMinimalPostInterface,
    OwidGdocPublicationContext,
    OwidGdocType,
    PostsGdocsTableName,
    PostsGdocsXTagsTableName,
    checkIsOwidGdocType,
    extractGdocIndexItem,
    formatDate,
    parsePostsGdocsRow,
    serializePostsGdocsRow,
} from "@ourworldindata/utils"

import { GdocBase } from "./GdocBase.js"
import { GdocPost } from "./GdocPost.js"
import { GdocDataInsight } from "./GdocDataInsight.js"
import { GdocHomepage } from "./GdocHomepage.js"
import {
    knexRawFirst,
    KnexReadonlyTransaction,
    knexRaw,
    KnexReadWriteTransaction,
} from "../../db.js"
import { enrichedBlocksToMarkdown } from "./enrichedToMarkdown.js"
import { GdocAuthor } from "./GdocAuthor.js"

export function gdocFromJSON(
    json: Record<string, any>
): GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor {
    if (typeof json.content === "string") {
        json.content = JSON.parse(json.content)
    }
    const type = json.content.type as OwidGdocType | undefined
    const id = json.id as string
    if (!type) {
        throw new Error(
            `Database record for Google Doc with id "${id}" has no type`
        )
    }

    json.createdAt = new Date(json.createdAt)
    json.publishedAt = json.publishedAt ? new Date(json.publishedAt) : null
    json.updatedAt = new Date(json.updatedAt)

    // `tags` ordinarily gets populated via a join table in .load(), for our purposes we don't need it here
    // except for the fact that loadRelatedCharts() assumes the array exists
    json.tags = json.tags

    return match(type)
        .with(
            P.union(
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.Fragment,
                OwidGdocType.AboutPage
            ),
            // TODO: better validation here?
            () => GdocPost.create({ ...(json as any) })
        )
        .with(
            OwidGdocType.DataInsight,
            // TODO: better validation here?
            () => GdocDataInsight.create({ ...(json as any) })
        )
        .with(
            OwidGdocType.Homepage,
            // TODO: better validation here?
            () => GdocHomepage.create({ ...(json as any) })
        )
        .with(
            OwidGdocType.Author,
            // TODO: better validation here?
            () => GdocAuthor.create({ ...(json as any) })
        )
        .exhaustive()
}

export async function createGdocAndInsertIntoDb(
    knex: KnexReadWriteTransaction,
    id: string
): Promise<OwidGdoc> {
    // Fetch the data from Google Docs and save it to the database
    // We have to fetch it here because we need to know the type of the Gdoc in load()
    const base = new GdocBase(id)
    await base.fetchAndEnrichGdoc()
    await upsertGdoc(knex, base)

    // Load its metadata and state so that subclass parsing & validation is also done.
    // This involves a second call to the DB and Google, which makes me sad, but it'll do for now.
    const gdoc = await loadGdocFromGdocBase(
        knex,
        base,
        GdocsContentSource.Gdocs
    )

    // 2024-03-12 Daniel: We used to save here before the knex refactor but I think that was redundant?
    // await gdoc.save()

    return gdoc
}

export async function updateGdocContentOnly(
    knex: KnexReadonlyTransaction,
    id: string,
    gdoc: OwidGdoc,
    markdownContentSource: OwidEnrichedGdocBlock[]
): Promise<void> {
    let markdown: string | null = gdoc.markdown
    try {
        markdown = enrichedBlocksToMarkdown(markdownContentSource, true) ?? null
    } catch (e) {
        console.error("Error when converting content to markdown", e)
    }
    return knex
        .table(PostsGdocsTableName)
        .where({ id })
        .andWhere("revisionId", "<>", gdoc.revisionId)
        .update({
            content: JSON.stringify(gdoc.content),
            revisionId: gdoc.revisionId,
            markdown,
        })
}

export async function getGdocBaseObjectById(
    knex: KnexReadonlyTransaction,
    id: string,
    fetchLinkedTags: boolean,
    onlyPublished: boolean = false
): Promise<OwidGdocBaseInterface | undefined> {
    const filters: {
        id: string
        published?: number
    } = {
        id,
    }
    if (onlyPublished) {
        filters["published"] = 1
    }
    const row = await knex.table(PostsGdocsTableName).where(filters).first()
    if (!row) return undefined
    const enrichedRow = parsePostsGdocsRow(row)
    const gdoc: OwidGdocBaseInterface = {
        ...enrichedRow,
        tags: null,
    } satisfies OwidGdocBaseInterface
    if (fetchLinkedTags) {
        const tags = await knexRaw<DbPlainTag>(
            knex,
            `-- sql
                SELECT tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId = ?`,
            [id]
        )
        gdoc.tags = tags
    }
    return gdoc
}

export async function getAllMinimalGdocBaseObjects(
    knex: KnexReadonlyTransaction
): Promise<OwidGdocMinimalPostInterface[]> {
    const rows = await knexRaw<{
        id: string
        title: string
        slug: string
        authors: string
        publishedAt: Date
        published: number
        subtitle: string
        excerpt: string
        type: string
        "featured-image": string
    }>(
        knex,
        `-- sql
            SELECT
                id,
                content ->> '$.title' as title,
                slug,
                content ->> '$.authors' as authors,
                publishedAt,
                published,
                content ->> '$.subtitle' as subtitle,
                content ->> '$.excerpt' as excerpt,
                content ->> '$.type' as type,
                content ->> '$."featured-image"' as "featured-image"
            FROM posts_gdocs
            WHERE published = 1
            AND publishedAt <= NOW()`,
        {}
    )
    return rows.map((row) => {
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            authors: JSON.parse(row.authors) as string[],
            publishedAt: formatDate(row.publishedAt),
            published: !!row.published,
            subtitle: row.subtitle,
            excerpt: row.excerpt,
            type: row.type as OwidGdocType,
            "featured-image": row["featured-image"],
        } satisfies OwidGdocMinimalPostInterface
    })
}

export async function getGdocBaseObjectBySlug(
    knex: KnexReadonlyTransaction,
    slug: string,
    fetchLinkedTags: boolean
): Promise<OwidGdocBaseInterface | undefined> {
    const row = await knexRawFirst<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE slug = ?
            AND published = 1`,
        [slug]
    )
    if (!row) return undefined
    const enrichedRow = parsePostsGdocsRow(row)
    const gdoc: OwidGdocBaseInterface = {
        ...enrichedRow,
        tags: null,
    } satisfies OwidGdocBaseInterface
    if (fetchLinkedTags) {
        const tags = await knexRaw<DbPlainTag>(
            knex,
            `-- sql
                SELECT tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId = ?`,
            [gdoc.id]
        )
        gdoc.tags = tags
    }
    return gdoc
}

export async function getAndLoadGdocBySlug(
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor> {
    const base = await getGdocBaseObjectBySlug(knex, slug, true)
    if (!base) {
        throw new Error(
            `No published Google Doc with slug "${slug}" found in the database`
        )
    }
    return loadGdocFromGdocBase(knex, base)
}

export async function getAndLoadGdocById(
    knex: KnexReadonlyTransaction,
    id: string,
    contentSource?: GdocsContentSource
): Promise<GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor> {
    const base = await getGdocBaseObjectById(knex, id, true)
    if (!base)
        throw new Error(`No Google Doc with id "${id}" found in the database`)
    return loadGdocFromGdocBase(knex, base, contentSource)
}

// From an ID, get a Gdoc object with all its metadata and state loaded, in its correct subclass.
// If contentSource is Gdocs, use live data from Google, otherwise use the data in the DB.
export async function loadGdocFromGdocBase(
    knex: KnexReadonlyTransaction,
    base: OwidGdocBaseInterface,
    contentSource?: GdocsContentSource
): Promise<GdocPost | GdocDataInsight | GdocHomepage | GdocAuthor> {
    const type = get(base, "content.type") as unknown
    if (!type)
        throw new Error(
            `Database record for Google Doc with id "${base.id}" has no type`
        )
    if (!checkIsOwidGdocType(type)) {
        throw new Error(
            `Database record for Google Doc with id "${base.id}" has invalid type "${type}"`
        )
    }

    const gdoc = match(type)
        .with(
            P.union(
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.Fragment,
                OwidGdocType.AboutPage
            ),
            () => GdocPost.create(base)
        )
        .with(OwidGdocType.DataInsight, () => GdocDataInsight.create(base))
        .with(OwidGdocType.Homepage, () => GdocHomepage.create(base))
        .with(OwidGdocType.Author, () => GdocAuthor.create(base))
        .exhaustive()

    if (contentSource === GdocsContentSource.Gdocs) {
        // TODO: if we get here via fromJSON then we have already done this - optimize that?
        await gdoc.fetchAndEnrichGdoc()
    }

    await gdoc.loadState(knex)

    return gdoc
}

export async function getAndLoadPublishedDataInsights(
    knex: KnexReadonlyTransaction,
    page?: number
): Promise<GdocDataInsight[]> {
    const limitOffsetClause =
        page !== undefined
            ? `LIMIT ${DATA_INSIGHTS_INDEX_PAGE_SIZE} OFFSET ${
                  page * DATA_INSIGHTS_INDEX_PAGE_SIZE
              }`
            : ""
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE published = 1
            AND content ->> '$.type' = ?
            AND publishedAt <= NOW()
            ORDER BY publishedAt DESC
            ${limitOffsetClause}`,
        [OwidGdocType.DataInsight]
    )
    const ids = rows.map((row) => row.id)
    const tags = await knexRaw<DbPlainTag>(
        knex,
        `-- sql
                SELECT gt.gdocId as gdocId, tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId in (:ids)`,
        { ids: ids }
    )
    const groupedTags = groupBy(tags, "gdocId")
    const enrichedRows = rows.map((row) => {
        return {
            ...parsePostsGdocsRow(row),
            tags: groupedTags[row.id] ? groupedTags[row.id] : null,
        } satisfies OwidGdocBaseInterface
    })
    const gdocs = await Promise.all(
        enrichedRows.map(async (row) => loadGdocFromGdocBase(knex, row))
    )
    return gdocs as GdocDataInsight[]
}

export async function getAndLoadPublishedGdocPosts(
    knex: KnexReadonlyTransaction
): Promise<GdocPost[]> {
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE published = 1
            AND content ->> '$.type' IN (:types)
            AND publishedAt <= NOW()
            ORDER BY publishedAt DESC`,
        {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.Fragment,
                OwidGdocType.AboutPage,
            ],
        }
    )
    const ids = rows.map((row) => row.id)
    const tags = await knexRaw<DbPlainTag>(
        knex,
        `-- sql
                SELECT gt.gdocId as gdocId, tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId in (:ids)`,
        { ids: ids }
    )
    const groupedTags = groupBy(tags, "gdocId")
    const enrichedRows = rows.map((row) => {
        return {
            ...parsePostsGdocsRow(row),
            tags: groupedTags[row.id] ? groupedTags[row.id] : null,
        } satisfies OwidGdocBaseInterface
    })
    const gdocs = await Promise.all(
        enrichedRows.map(async (row) => loadGdocFromGdocBase(knex, row))
    )
    return gdocs as GdocPost[]
}

export async function loadPublishedGdocAuthors(
    knex: KnexReadonlyTransaction
): Promise<GdocAuthor[]> {
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE published = 1
            AND content ->> '$.type' IN (:types)`,
        {
            types: [OwidGdocType.Author],
        }
    )

    const enrichedRows = rows.map((row) => {
        return {
            ...parsePostsGdocsRow(row),
        } satisfies OwidGdocBaseInterface
    })
    const gdocs = await Promise.all(
        enrichedRows.map(async (row) => loadGdocFromGdocBase(knex, row))
    )
    return gdocs as GdocAuthor[]
}

export async function getAndLoadListedGdocPosts(
    knex: KnexReadonlyTransaction
): Promise<GdocPost[]> {
    // TODO: Check if we shouldn't also restrict the types of gdocs here
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE published = 1
            publicationContext: ${OwidGdocPublicationContext.listed}
            publishedAt <= NOW()
            ORDER BY publishedAt DESC`,
        {}
    )
    const ids = rows.map((row) => row.id)
    const tags = await knexRaw<DbPlainTag>(
        knex,
        `-- sql
                SELECT gt.gdocId as gdocId, tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId in (:ids)`,
        { ids: ids }
    )
    const groupedTags = groupBy(tags, "gdocId")
    const enrichedRows = rows.map((row) => {
        return {
            ...parsePostsGdocsRow(row),
            tags: groupedTags[row.id] ? groupedTags[row.id] : null,
        } satisfies OwidGdocBaseInterface
    })
    const gdocs = await Promise.all(
        enrichedRows.map(async (row) => loadGdocFromGdocBase(knex, row))
    )
    return gdocs as GdocPost[]
}

export async function setTagsForGdoc(
    knex: KnexReadWriteTransaction,
    gdocId: string,
    tagIds: Pick<DbPlainTag, "id">[]
): Promise<void> {
    await knex.table(PostsGdocsXTagsTableName).where("gdocId", gdocId).delete()
    await knex
        .table(PostsGdocsXTagsTableName)
        .insert(tagIds.map(({ id: tagId }) => ({ gdocId, tagId })))
}

export function getDbEnrichedGdocFromOwidGdoc(
    gdoc: OwidGdoc | GdocBase
): DbEnrichedPostGdoc {
    const enrichedGdoc = {
        breadcrumbs: gdoc.breadcrumbs,
        content: gdoc.content,
        createdAt: gdoc.createdAt,
        id: gdoc.id,
        markdown: gdoc.markdown,
        publicationContext: gdoc.publicationContext,
        published: gdoc.published,
        publishedAt: gdoc.publishedAt,
        revisionId: gdoc.revisionId,
        slug: gdoc.slug,
        updatedAt: gdoc.updatedAt,
    } satisfies DbEnrichedPostGdoc
    return enrichedGdoc
}
export async function upsertGdoc(
    knex: KnexReadWriteTransaction,
    gdoc: OwidGdoc | GdocBase
): Promise<number[]> {
    let sql = undefined
    try {
        const enrichedGdoc = getDbEnrichedGdocFromOwidGdoc(gdoc)
        const rawPost = serializePostsGdocsRow(enrichedGdoc)
        const query = knex
            .table(PostsGdocsTableName)
            .insert(rawPost)
            .onConflict("id")
            .merge()
        sql = query.toSQL()
        return query
    } catch (e) {
        console.error(`Error occured in sql: ${sql}`, e)
        throw e
    }
}

// TODO:
export async function getAllGdocIndexItemsOrderedByUpdatedAt(
    knex: KnexReadonlyTransaction
): Promise<OwidGdocIndexItem[]> {
    // Old note from Ike for somewhat different code that might still be relevant:
    // orderBy was leading to a sort buffer overflow (ER_OUT_OF_SORTMEMORY) with MySQL's default sort_buffer_size
    // when the posts_gdocs table got larger than 9MB, so we sort in memory
    const gdocs: DbRawPostGdoc[] = await knex
        .table<DbRawPostGdoc>(PostsGdocsTableName)
        .orderBy("updatedAt", "desc")
    const tagsForGdocs = await knexRaw<DbPlainTag & Pick<DbRawPostGdoc, "id">>(
        knex,
        `-- sql
        SELECT gt.gdocId as gdocId, tags.*
        FROM tags
        JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
        WHERE gt.gdocId in (:ids)`,
        { ids: gdocs.map((gdoc) => gdoc.id) }
    )
    const groupedTags = groupBy(tagsForGdocs, "gdocId")
    return gdocs.map((gdoc) =>
        extractGdocIndexItem({
            ...parsePostsGdocsRow(gdoc),
            tags: groupedTags[gdoc.id] ? groupedTags[gdoc.id] : null,
        })
    )
}
