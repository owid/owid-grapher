import * as db from "db/db"
import { Post } from "db/model/Post"
import { Tag } from "db/model/Tag"
import * as wpdb from "db/wpdb"
import { decodeHTML } from "entities"
import _ = require("lodash")

async function main() {
    try {
        const categoriesByPostId = await wpdb.getCategoriesByPostId()

        const postRows = await wpdb.query(
            "select * from wp_posts where (post_type='page' or post_type='post') AND post_status != 'trash'"
        )

        for (const post of postRows) {
            const categories = categoriesByPostId.get(post.ID) || []

            const tagNames = categories.map(t => decodeHTML(t))

            const matchingTags = await Tag.select(
                "id",
                "name",
                "isBulkImport"
            ).from(
                db
                    .table(Tag.table)
                    .whereIn("name", tagNames)
                    .andWhere({ isBulkImport: false })
            )

            const existingTags = await Tag.select("id").from(
                db
                    .table(Tag.table)
                    .join("post_tags", { "post_tags.tag_id": "tags.id" })
                    .where({ "post_tags.post_id": post.ID })
            )

            const tagIds = matchingTags
                .map(t => t.id)
                .concat(existingTags.map(t => t.id))
            // if (matchingTags.map(t => t.name).includes(post.post_title)) {
            //     tagIds.push(1640)
            // }

            // const matchingTags = await Tag.select('id', 'name', 'isBulkImport').from(
            //     db.knex().from(Tag.table).whereIn('name', tagNames).andWhere({ isBulkImport: false })
            // )
            // let tagIds = matchingTags.map(t => t.id)
            // if (matchingTags.map(t => t.name).includes(post.post_title)) {
            //     tagIds.push(1640)
            // }
            await Post.setTags(post.ID, _.uniq(tagIds))
        }
    } finally {
        await wpdb.end()
        await db.end()
    }
}

main()
