import * as db from 'db/db'
import * as wpdb from 'db/wpdb'
import * as _ from 'lodash'

export namespace Post {
    export interface Row {
        id: number
        title: string
        slug: string
        type: 'post'|'page'
        status: string
        content: string
        published_at: Date|null
        updated_at: Date
    }
    
    export type Field = keyof Row
    
    export function table() {
        return db.knex()("posts")
    }
    
    export function select<K extends keyof Row>(...args: K[]): Promise<Pick<Row, K>[]> {
        return table().select(...args) as any
    }
}

export async function syncPostsToGrapher(postIds?: number[]) {
    const rows = postIds ? await wpdb.query("SELECT * FROM wp_posts WHERE ID IN ?", [postIds]) : await wpdb.query("SELECT * FROM wp_posts WHERE post_type='page' OR post_type='post'")
    const dbRows = rows.map((post: any) => ({
        id: post.ID, 
        title: post.post_title, 
        slug: post.post_name, 
        type: post.post_type, 
        status: post.post_status, 
        content: post.post_content, 
        published_at: post.post_date_gmt === "0000-00-00 00:00:00" ? null : post.post_date_gmt, 
        updated_at: post.post_modified_gmt === "0000-00-00 00:00:00" ? "1970-01-01 00:00:00" : post.post_modified_gmt
    })) as Post.Row[]

    const existing = await db.knex().select('id').from('posts').whereIn('id', dbRows.map(r => r.id))
    const doesExist = _.keyBy(existing, 'id')

    await db.knex().transaction(async t => {
        for (const row of dbRows) {
            if (doesExist[row.id])
                await t.update(row).where('id', '=', row.id).into('posts')
            else
                await t.insert(row).into('posts')
        }
    })
}

// Sync post from the wordpress database to OWID database
export async function syncPostToGrapher(postId: number): Promise<string> {
    await syncPostsToGrapher([postId])

    return (await db.get("SELECT slug FROM posts WHERE id=?", [postId])).slug
}
