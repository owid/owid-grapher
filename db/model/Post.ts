import * as db from "../db.js"
import { Knex } from "knex"
import { PostRow, sortBy } from "@ourworldindata/utils"

export const postsTable = "posts"

export const table = "posts"

export const select = <K extends keyof PostRow>(
    ...args: K[]
): { from: (query: Knex.QueryBuilder) => Promise<Pick<PostRow, K>[]> } => ({
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

export const bySlug = async (slug: string): Promise<PostRow | undefined> =>
    (await db.knexTable("posts").where({ slug: slug }))[0]

/** The authors field in the posts table is a json column that contains an array of
    { order: 1, authors: "Max Mustermann" } like records. This function parses the
    string and returns a simple string array of author names in the correct order  */
export const parsePostAuthors = (authorsJson: string): string[] => {
    const authors = JSON.parse(authorsJson)
    return sortBy(authors, ["order"]).map((author) => author.author)
}

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

export const getPostBySlug = async (
    slug: string
): Promise<PostRow | undefined> =>
    (await db.knexTable("posts").where({ slug: slug }))[0]
