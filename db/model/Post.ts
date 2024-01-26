import * as db from "../db.js"
import { Knex } from "knex"
import {
    DbEnrichedPost,
    DbRawPost,
    parsePostRow,
    FilterFnPostRestApi,
    WP_PostType,
} from "@ourworldindata/utils"
import { BLOG_SLUG } from "../../settings/serverSettings.js"

export const postsTable = "posts"

export const select = <K extends keyof DbRawPost>(
    ...args: K[]
): {
    from: (query: Knex.QueryBuilder) => Promise<Pick<DbRawPost, K>[]>
} => ({
    from: (query) => query.select(...args) as any,
})

export const getTagsByPostId = async (): Promise<
    Map<number, { id: number; name: string }[]>
> => {
    const postTags = await db.queryMysql(`
            SELECT pt.post_id AS postId, pt.tag_id AS tagId, t.name as tagName FROM post_tags pt
            JOIN posts p ON p.id=pt.post_id
            JOIN tags t ON t.id=pt.tag_id
        `)

    const tagsByPostId: Map<number, { id: number; name: string }[]> = new Map()

    for (const pt of postTags) {
        const tags = tagsByPostId.get(pt.postId) || []
        tags.push({ id: pt.tagId, name: pt.tagName })
        tagsByPostId.set(pt.postId, tags)
    }

    return tagsByPostId
}

export const setTags = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const setTagsForPost = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const getPostRawBySlug = async (
    slug: string
): Promise<DbRawPost | undefined> =>
    // Slugs are not guaranteed to be unique across post types so we are
    // grabbing the first match in case of duplicates. Here is a query to
    // get a list of offending slugs:

    // SELECT dup_slugs.slug,
    // GROUP_CONCAT(p.id ORDER BY p.id) AS post_ids,
    // GROUP_CONCAT(p.type ORDER BY p.id) AS post_types
    // FROM ( SELECT slug FROM posts GROUP BY slug HAVING COUNT(*) > 1) AS dup_slugs
    // JOIN posts p ON dup_slugs.slug = p.slug
    // GROUP BY dup_slugs.slug;
    (await db.knexTable("posts").where({ slug: slug }))[0]

export const getPostEnrichedBySlug = async (
    slug: string
): Promise<DbEnrichedPost | undefined> => {
    const post = await getPostRawBySlug(slug)
    if (!post) return undefined
    return parsePostRow(post)
}

export const filterListedPosts: FilterFnPostRestApi = (post) => post.isListed

export const getPosts = async (
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    filterFunc?: FilterFnPostRestApi
): Promise<DbEnrichedPost[]> => {
    const posts: DbRawPost[] = await db
        .knexTable(postsTable)
        .where("type", "in", [postTypes.join(",")])
        .andWhere("status", "publish")

    // Published pages excluded from public views
    const excludedSlugs = [BLOG_SLUG]

    const filterConditions: Array<FilterFnPostRestApi> = [
        (post): boolean => !excludedSlugs.includes(post.slug),
        (post): boolean => !post.slug.endsWith("-country-profile"),
    ]
    if (filterFunc) filterConditions.push(filterFunc)

    const filteredPosts = posts
        .filter((post) => filterConditions.every((c) => c(post)))
        .map(parsePostRow)

    return filteredPosts
}
