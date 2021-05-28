import * as db from "../db"
import { QueryBuilder } from "knex"
import { PostRow } from "../../clientUtils/owidTypes"

export namespace Post {
    export const table = "posts"

    export const select = <K extends keyof PostRow>(
        ...args: K[]
    ): { from: (query: QueryBuilder) => Promise<Pick<PostRow, K>[]> } => ({
        from: (query): any => query.select(...args) as any,
    })

    export const tagsByPostId = async (): Promise<
        Map<number, { id: number; name: string }[]>
    > => {
        const postTags = await db.queryMysql(`
            SELECT pt.post_id AS postId, pt.tag_id AS tagId, t.name as tagName FROM post_tags pt
            JOIN posts p ON p.id=pt.post_id
            JOIN tags t ON t.id=pt.tag_id
        `)

        const tagsByPostId: Map<
            number,
            { id: number; name: string }[]
        > = new Map()

        for (const pt of postTags) {
            const tags = tagsByPostId.get(pt.postId) || []
            tags.push({ id: pt.tagId, name: pt.tagName })
            tagsByPostId.set(pt.postId, tags)
        }

        return tagsByPostId
    }

    export const setTags = async (postId: number, tagIds: number[]) =>
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
}
