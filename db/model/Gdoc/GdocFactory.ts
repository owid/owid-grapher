import * as _ from "lodash-es"
import { match, P } from "ts-pattern"
import {
    ARCHIVED_THUMBNAIL_FILENAME,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    DbEnrichedPostGdoc,
    DbInsertPostGdocLink,
    DbInsertPostGdocXImage,
    DbPlainTag,
    DbRawPostGdoc,
    GdocsContentSource,
    ImageMetadata,
    LatestDataInsight,
    OwidEnrichedGdocBlock,
    OwidGdoc,
    OwidGdocBaseInterface,
    OwidGdocDataInsightContent,
    OwidGdocIndexItem,
    OwidGdocMinimalPostInterface,
    OwidGdocPublicationContext,
    OwidGdocType,
    PostsGdocsComponentsTableName,
    PostsGdocsLinksTableName,
    PostsGdocsTableName,
    PostsGdocsXImagesTableName,
    PostsGdocsXTagsTableName,
    checkIsOwidGdocType,
    extractGdocIndexItem,
    formatDate,
    parsePostGdocContent,
    parsePostsGdocsRow,
    serializePostsGdocsRow,
    traverseEnrichedBlock,
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
    getImageMetadataByFilenames,
    getPublishedGdocsWithTags,
    getTagHierarchiesByChildName,
    getBestBreadcrumbs,
} from "../../db.js"
import { enrichedBlocksToMarkdown } from "./enrichedToMarkdown.js"
import { GdocAbout } from "./GdocAbout.js"
import { GdocAuthor } from "./GdocAuthor.js"
import { extractFilenamesFromBlock } from "./gdocUtils.js"
import { getGdocComponentsWithoutChildren } from "./extractGdocComponentInfo.js"
import { GdocAnnouncement } from "./GdocAnnouncement.js"

export function gdocFromJSON(
    json: Record<string, any>
):
    | GdocPost
    | GdocDataInsight
    | GdocHomepage
    | GdocAbout
    | GdocAuthor
    | GdocAnnouncement {
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

    json.createdAt = json.createdAt ? new Date(json.createdAt) : null
    json.publishedAt = json.publishedAt ? new Date(json.publishedAt) : null
    json.updatedAt = json.updatedAt ? new Date(json.updatedAt) : null

    return match(type)
        .with(
            P.union(
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.Fragment
            ),
            // TODO: better validation here?
            () => GdocPost.create({ ...(json as any) })
        )
        .with(
            OwidGdocType.AboutPage,
            // TODO: better validation here?
            () => GdocAbout.create({ ...(json as any) })
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
        .with(
            OwidGdocType.Announcement,
            // TODO: better validation here?
            () => GdocAnnouncement.create({ ...(json as any) })
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

    // Load its metadata and state so that subclass parsing & validation is also done.
    // This involves a second call to the DB and Google, which makes me sad, but it'll do for now.
    const gdoc = await loadGdocFromGdocBase(
        knex,
        base,
        GdocsContentSource.Gdocs
    )

    // Save the enriched Gdoc to the database (including subclass-specific
    // enrichments, cf. _enrichSubclassContent()). Otherwise subclass
    // enrichments are not present on the Gdoc subclass when loading from the DB
    // (GdocsContentSource.Internal), since subclass enrichements are only done
    // while fetching the live gdocs (GdocsContentSource.Gdocs) in
    // loadGdocFromGdocBase().
    await upsertGdoc(knex, gdoc)

    return gdoc
}

export async function updateGdocContentOnly(
    knex: KnexReadWriteTransaction,
    id: string,
    gdoc:
        | GdocPost
        | GdocDataInsight
        | GdocHomepage
        | GdocAbout
        | GdocAuthor
        | GdocAnnouncement
): Promise<void> {
    let markdown: string | null = gdoc.markdown
    try {
        const markdownContentSource = gdoc.enrichedBlockSources.flat()
        markdown = enrichedBlocksToMarkdown(markdownContentSource, true) ?? null
    } catch (e) {
        console.error("Error when converting content to markdown", e)
    }
    await knex
        .table(PostsGdocsTableName)
        .where({ id })
        .andWhere("revisionId", "<>", gdoc.revisionId)
        .update({
            content: JSON.stringify(gdoc.content),
            revisionId: gdoc.revisionId,
            markdown,
        })
    await updateDerivedGdocPostsComponents(knex, id, gdoc.content.body)
}

export async function updateDerivedGdocPostsComponents(
    knex: KnexReadWriteTransaction,
    gdocId: string,
    body: OwidEnrichedGdocBlock[] | undefined
): Promise<void> {
    await knex
        .table(PostsGdocsComponentsTableName)
        .where({ gdocId: gdocId })
        .delete()
    if (body) {
        const components = getGdocComponentsWithoutChildren(gdocId, body)
        if (components.length)
            await knex(PostsGdocsComponentsTableName).insert(components)
    }
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

        if (tags.length) {
            const tagHierarchiesByChildName =
                await getTagHierarchiesByChildName(knex)
            gdoc.breadcrumbs = getBestBreadcrumbs(
                gdoc.tags,
                tagHierarchiesByChildName
            )
        }
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
                authors,
                publishedAt,
                published,
                content ->> '$.subtitle' as subtitle,
                content ->> '$.excerpt' as excerpt,
                type,
                CASE
                    WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN '${ARCHIVED_THUMBNAIL_FILENAME}'
                    ELSE content ->> '$."featured-image"'
                END as "featured-image"
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

export async function getPublishedGdocBaseObjectBySlug(
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
            AND published = 1
            AND publishedAt <= NOW()`,
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
        if (tags.length) {
            const tagHierarchiesByChildName =
                await getTagHierarchiesByChildName(knex)
            gdoc.breadcrumbs = getBestBreadcrumbs(
                gdoc.tags,
                tagHierarchiesByChildName
            )
        }
    }
    return gdoc
}

export async function getAndLoadGdocBySlug(
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<
    | GdocPost
    | GdocDataInsight
    | GdocHomepage
    | GdocAbout
    | GdocAuthor
    | GdocAnnouncement
> {
    const base = await getPublishedGdocBaseObjectBySlug(knex, slug, true)
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
): Promise<
    | GdocPost
    | GdocDataInsight
    | GdocHomepage
    | GdocAbout
    | GdocAuthor
    | GdocAnnouncement
> {
    const base = await getGdocBaseObjectById(knex, id, true)
    if (!base)
        throw new Error(`No Google Doc with id "${id}" found in the database`)
    return loadGdocFromGdocBase(knex, base, contentSource)
}

export async function createOrLoadGdocById(
    trx: KnexReadWriteTransaction,
    id: string
): Promise<OwidGdoc> {
    // Check to see if the gdoc already exists in the database
    const existingGdoc = await getGdocBaseObjectById(trx, id, false)
    if (existingGdoc) {
        return loadGdocFromGdocBase(trx, existingGdoc, GdocsContentSource.Gdocs)
    } else {
        return createGdocAndInsertIntoDb(trx, id)
    }
}

// From an ID, get a Gdoc object with all its metadata and state loaded, in its correct subclass.
// If contentSource is Gdocs, use live data from Google, otherwise use the data in the DB.
export async function loadGdocFromGdocBase(
    knex: KnexReadonlyTransaction,
    base: OwidGdocBaseInterface,
    contentSource?: GdocsContentSource,
    options?: { loadState?: boolean }
): Promise<
    | GdocPost
    | GdocDataInsight
    | GdocHomepage
    | GdocAbout
    | GdocAuthor
    | GdocAnnouncement
> {
    const shouldLoadState = options?.loadState ?? true

    const type = _.get(base, "content.type") as unknown
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
                OwidGdocType.Fragment
            ),
            () => GdocPost.create(base)
        )
        .with(OwidGdocType.AboutPage, () => GdocAbout.create(base))
        .with(OwidGdocType.DataInsight, () => GdocDataInsight.create(base))
        .with(OwidGdocType.Homepage, () => GdocHomepage.create(base))
        .with(OwidGdocType.Author, () => GdocAuthor.create(base))
        .with(OwidGdocType.Announcement, () => GdocAnnouncement.create(base))
        .exhaustive()

    if (contentSource === GdocsContentSource.Gdocs) {
        // TODO: if we get here via fromJSON then we have already done this - optimize that?
        await gdoc.fetchAndEnrichGdoc()
    }

    if (shouldLoadState) {
        await gdoc.loadState(knex)
    }

    return gdoc
}

async function getAndLoadPublishedGdocs<T extends GdocBase>(
    knex: KnexReadonlyTransaction,
    type: T["content"]["type"],
    options?: { limit: number; offset?: number; topicSlug?: string }
): Promise<T[]> {
    let query = knex<DbRawPostGdoc>(PostsGdocsTableName)
        .where("type", type)
        .where("published", 1)
        .where("publishedAt", "<=", knex.fn.now())
        .orderBy("publishedAt", "desc")

    if (options?.topicSlug) {
        query = query
            .join("posts_gdocs_x_tags as pgt", "posts_gdocs.id", "pgt.gdocId")
            .join("tags", "pgt.tagId", "tags.id")
            .where("tags.slug", options.topicSlug)
            .distinct()
    }

    if (options?.limit) query = query.limit(options.limit)
    if (options?.offset) query = query.offset(options.offset)

    const rows = await query.select(`${PostsGdocsTableName}.*`)
    const ids = rows.map((row) => row.id)

    let gdocs: T[] = []

    if (ids.length) {
        const tags = await knexRaw<DbPlainTag>(
            knex,
            `-- sql
      SELECT gt.gdocId as gdocId, tags.*
      FROM tags
      JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
      WHERE gt.gdocId in (:ids)`,
            { ids: ids }
        )

        const groupedTags = _.groupBy(tags, "gdocId")

        const enrichedRows = rows.map((row) => {
            return {
                ...parsePostsGdocsRow(row),
                tags: groupedTags[row.id] ? groupedTags[row.id] : null,
            } satisfies OwidGdocBaseInterface
        })

        gdocs = (await Promise.all(
            enrichedRows.map(async (row) => loadGdocFromGdocBase(knex, row))
        )) as T[]
    }

    return gdocs
}

export async function getAndLoadPublishedDataInsightsPage(
    knex: KnexReadonlyTransaction,
    page?: number,
    topicSlug?: string
): Promise<GdocDataInsight[]> {
    let options:
        | { limit: number; offset?: number; topicSlug?: string }
        | undefined
    if (page !== undefined) {
        options = {
            limit: DATA_INSIGHTS_INDEX_PAGE_SIZE,
            offset: page * DATA_INSIGHTS_INDEX_PAGE_SIZE,
        }
    }
    if (topicSlug !== undefined) {
        options = {
            limit: options?.limit ?? DATA_INSIGHTS_INDEX_PAGE_SIZE,
            offset: options?.offset,
            topicSlug,
        }
    }
    return await getAndLoadPublishedGdocs<GdocDataInsight>(
        knex,
        OwidGdocType.DataInsight,
        options
    )
}

export async function getLatestDataInsights(
    knex: KnexReadonlyTransaction
): Promise<{
    dataInsights: LatestDataInsight[]
    imageMetadata: Record<string, ImageMetadata>
}> {
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `SELECT id, slug, publishedAt, content
         FROM posts_gdocs
         WHERE type = :type
         AND published = 1
         AND publishedAt <= NOW()
         ORDER BY publishedAt DESC
         LIMIT 7`,
        { type: OwidGdocType.DataInsight }
    )
    const dataInsights = rows.map((row) => {
        return {
            ...row,
            content: parsePostGdocContent(
                row.content
            ) as OwidGdocDataInsightContent,
        }
    })
    const filenames = new Set<string>()
    for (const dataInsight of dataInsights) {
        for (const block of dataInsight.content.body) {
            traverseEnrichedBlock(block, (block) => {
                for (const filename of extractFilenamesFromBlock(block)) {
                    filenames.add(filename)
                }
            })
        }
    }
    return {
        dataInsights,
        imageMetadata: await getImageMetadataByFilenames(knex, [...filenames]),
    }
}

export async function getAndLoadPublishedGdocPosts(
    knex: KnexReadonlyTransaction
): Promise<GdocPost[]> {
    const rows = await getPublishedGdocsWithTags(knex)
    const gdocs = await Promise.all(
        rows.map(async (row) => loadGdocFromGdocBase(knex, row))
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
            AND type IN (:types)`,
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
        enrichedRows.map((row) => loadGdocFromGdocBase(knex, row))
    )
    return gdocs as GdocAuthor[]
}

export async function getAndLoadListedGdocPosts(
    knex: KnexReadonlyTransaction,
    options?: { loadState?: boolean }
): Promise<GdocPost[]> {
    const shouldLoadState = options?.loadState ?? true

    // TODO: Check if we shouldn't also restrict the types of gdocs here
    const rows = await knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
            SELECT *
            FROM posts_gdocs
            WHERE published = 1 AND
            publicationContext = :publicationContext AND
            publishedAt <= NOW()
            ORDER BY publishedAt DESC`,
        { publicationContext: OwidGdocPublicationContext.listed }
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
    const groupedTags = _.groupBy(tags, "gdocId")
    const enrichedRows = rows
        .filter(
            (row) =>
                row.type !== OwidGdocType.Announcement &&
                row.type !== OwidGdocType.Homepage
        )
        .map((row) => {
            return {
                ...parsePostsGdocsRow(row),
                tags: groupedTags[row.id] ? groupedTags[row.id] : null,
            } satisfies OwidGdocBaseInterface
        })

    // Pass loadState option through to loadGdocFromGdocBase
    // When loadState=false (for blog index), it only creates gdoc objects with basic metadata
    // When loadState=true (default), it fully loads linked charts, validates, loads images, etc.
    const gdocs = (await Promise.all(
        enrichedRows.map(async (row) =>
            loadGdocFromGdocBase(knex, row, undefined, {
                loadState: shouldLoadState,
            })
        )
    )) as GdocPost[]

    return gdocs
}

export async function setTagsForGdoc(
    knex: KnexReadWriteTransaction,
    gdocId: string,
    tagIds: Pick<DbPlainTag, "id">[]
): Promise<void> {
    await knex.table(PostsGdocsXTagsTableName).where({ gdocId }).delete()
    const tagIdsForInsert = tagIds.map(({ id: tagId }) => ({ gdocId, tagId }))
    if (tagIdsForInsert.length)
        await knex.table(PostsGdocsXTagsTableName).insert(tagIdsForInsert)
}

export enum GdocLinkUpdateMode {
    DeleteOnly = "DeleteOnly",
    DeleteAndInsert = "DeleteAndInsert",
}

export async function setLinksForGdoc(
    knex: KnexReadWriteTransaction,
    gdocId: string,
    links: DbInsertPostGdocLink[],
    updatedMode: GdocLinkUpdateMode
): Promise<void> {
    await knex
        .table(PostsGdocsLinksTableName)
        .where({ sourceId: gdocId })
        .delete()
    if (updatedMode === GdocLinkUpdateMode.DeleteAndInsert && links.length)
        await knex.table(PostsGdocsLinksTableName).insert(links)
}

export function getDbEnrichedGdocFromOwidGdoc(
    gdoc: OwidGdoc | GdocBase
): DbEnrichedPostGdoc {
    const enrichedGdoc = {
        manualBreadcrumbs: gdoc.manualBreadcrumbs,
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
): Promise<DbEnrichedPostGdoc> {
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
        await query
        await updateDerivedGdocPostsComponents(knex, gdoc.id, gdoc.content.body)
        const upserted = await getAndLoadGdocById(knex, gdoc.id)
        return upserted
    } catch (e) {
        console.error(`Error occured in sql: ${sql}`, e)
        throw e
    }
}

export async function getTagsGroupedByGdocId(
    knex: KnexReadonlyTransaction,
    gdocIds: string[]
): Promise<Record<string, DbPlainTag[]>> {
    const tags = await knexRaw<DbPlainTag & Pick<DbRawPostGdoc, "id">>(
        knex,
        `-- sql
            SELECT gt.gdocId as gdocId, tags.*
            FROM tags
            JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
            WHERE gt.gdocId in (:ids)`,
        { ids: gdocIds }
    )
    return _.groupBy(tags, "gdocId")
}

export async function getAllGdocIndexItemsOrderedByUpdatedAt(
    knex: KnexReadonlyTransaction
): Promise<OwidGdocIndexItem[]> {
    // Old note from Ike for somewhat different code that might still be relevant:
    // orderBy was leading to a sort buffer overflow (ER_OUT_OF_SORTMEMORY) with MySQL's default sort_buffer_size
    // when the posts_gdocs table got larger than 9MB, so we sort in memory
    const gdocs: DbRawPostGdoc[] = await knex
        .table<DbRawPostGdoc>(PostsGdocsTableName)
        .orderBy("updatedAt", "desc")
    const groupedTags = await getTagsGroupedByGdocId(
        knex,
        gdocs.map((gdoc) => gdoc.id)
    )
    return gdocs.map((gdoc) =>
        extractGdocIndexItem({
            ...parsePostsGdocsRow(gdoc),
            tags: groupedTags[gdoc.id] ? groupedTags[gdoc.id] : null,
        })
    )
}

export async function setImagesInContentGraph(
    trx: KnexReadWriteTransaction,
    gdoc:
        | GdocPost
        | GdocDataInsight
        | GdocHomepage
        | GdocAbout
        | GdocAuthor
        | GdocAnnouncement
): Promise<void> {
    const id = gdoc.id
    // Deleting and recreating these is simpler than tracking orphans over the next code block
    await trx.table(PostsGdocsXImagesTableName).where({ gdocId: id }).delete()
    const filenames = gdoc.filenames

    // Includes fragments so that images in data pages are also tracked
    if (filenames.length && gdoc.published) {
        const images = await getImageMetadataByFilenames(trx, filenames)
        const gdocXImagesToInsert: DbInsertPostGdocXImage[] = []
        for (const image of Object.values(images)) {
            gdocXImagesToInsert.push({
                gdocId: gdoc.id,
                imageId: image.id,
            })
        }
        try {
            await trx
                .table(PostsGdocsXImagesTableName)
                .insert(gdocXImagesToInsert)
        } catch (e) {
            console.error(
                `Error tracking image references with Google ID ${gdoc.id}`,
                e
            )
        }
    }
}
