import {
    PostsTableName,
    DbRawPost,
    DbRawPostWithGdocPublishStatus,
    JsonError,
    OwidGdocPostInterface,
    OwidGdocType,
    PostsGdocsTableName,
} from "@ourworldindata/types"
import { camelCaseProperties } from "@ourworldindata/utils"
import { createGdocAndInsertOwidGdocPostContent } from "../../db/model/Gdoc/archieToGdoc.js"
import { upsertGdoc, setTagsForGdoc } from "../../db/model/Gdoc/GdocFactory.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { setTagsForPost, getTagsByPostId } from "../../db/model/Post.js"
import { expectInt } from "../../serverUtils/serverUtil.js"
import { apiRouter } from "../apiRouter.js"
import {
    getRouteWithROTransaction,
    postRouteWithRWTransaction,
} from "../functionalRouterHelpers.js"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import e from "express"
export async function handleGetPostsJson(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const raw_rows = await db.knexRaw(
        trx,
        `-- sql
        WITH
            posts_tags_aggregated AS (
                SELECT
                    post_id,
                    IF(
                        COUNT(tags.id) = 0,
                        JSON_ARRAY(),
                        JSON_ARRAYAGG(JSON_OBJECT("id", tags.id, "name", tags.name))
                    ) AS tags
                FROM
                    post_tags
                    LEFT JOIN tags ON tags.id = post_tags.tag_id
                GROUP BY
                    post_id
            ),
            post_gdoc_slug_successors AS (
                SELECT
                    posts.id,
                    IF(
                        COUNT(gdocSlugSuccessor.id) = 0,
                        JSON_ARRAY(),
                        JSON_ARRAYAGG(
                            JSON_OBJECT("id", gdocSlugSuccessor.id, "published", gdocSlugSuccessor.published)
                        )
                    ) AS gdocSlugSuccessors
                FROM
                    posts
                    LEFT JOIN posts_gdocs gdocSlugSuccessor ON gdocSlugSuccessor.slug = posts.slug
                GROUP BY
                    posts.id
            )
            SELECT
                posts.id AS id,
                posts.title AS title,
                posts.type AS TYPE,
                posts.slug AS slug,
                STATUS,
                updated_at_in_wordpress,
                posts.authors,
                posts_tags_aggregated.tags AS tags,
                gdocSuccessorId,
                gdocSuccessor.published AS isGdocSuccessorPublished,
                -- posts can either have explict successors via the gdocSuccessorId column
                -- or implicit successors if a gdoc has been created that uses the same slug
                -- as a Wp post (the gdoc one wins once it is published)
                post_gdoc_slug_successors.gdocSlugSuccessors AS gdocSlugSuccessors
            FROM
                posts
                LEFT JOIN post_gdoc_slug_successors ON post_gdoc_slug_successors.id = posts.id
                LEFT JOIN posts_gdocs gdocSuccessor ON gdocSuccessor.id = posts.gdocSuccessorId
                LEFT JOIN posts_tags_aggregated ON posts_tags_aggregated.post_id = posts.id
            ORDER BY
                updated_at_in_wordpress DESC`,
        []
    )
    const rows = raw_rows.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags),
        isGdocSuccessorPublished: !!row.isGdocSuccessorPublished,
        gdocSlugSuccessors: JSON.parse(row.gdocSlugSuccessors),
        authors: JSON.parse(row.authors),
    }))

    return { posts: rows }
}

export async function handleSetTagsForPost(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const postId = expectInt(req.params.postId)
    await setTagsForPost(trx, postId, req.body.tagIds)
    return { success: true }
}

export async function handleGetPostById(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadonlyTransaction
) {
    const postId = expectInt(req.params.postId)
    const post = (await trx
        .table(PostsTableName)
        .where({ id: postId })
        .select("*")
        .first()) as DbRawPost | undefined
    return camelCaseProperties({ ...post })
}

export async function handleCreateGdoc(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const postId = expectInt(req.params.postId)
    const allowRecreate = !!req.body.allowRecreate
    const post = (await trx
        .table("posts_with_gdoc_publish_status")
        .where({ id: postId })
        .select("*")
        .first()) as DbRawPostWithGdocPublishStatus | undefined

    if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
    const existingGdocId = post.gdocSuccessorId
    if (!allowRecreate && existingGdocId)
        throw new JsonError("A gdoc already exists for this post", 400)
    if (allowRecreate && existingGdocId && post.isGdocPublished) {
        throw new JsonError(
            "A gdoc already exists for this post and it is already published",
            400
        )
    }
    if (post.archieml === null)
        throw new JsonError(
            `ArchieML was not present for post with id ${postId}`,
            500
        )
    const tagsByPostId = await getTagsByPostId(trx)
    const tags = tagsByPostId.get(postId) || []
    const archieMl = JSON.parse(
        // Google Docs interprets &region in grapher URLS as ®ion
        // So we escape them here
        post.archieml.replaceAll("&", "&amp;")
    ) as OwidGdocPostInterface
    const gdocId = await createGdocAndInsertOwidGdocPostContent(
        archieMl.content,
        post.gdocSuccessorId
    )
    // If we did not yet have a gdoc associated with this post, we need to register
    // the gdocSuccessorId and create an entry in the posts_gdocs table. Otherwise
    // we don't need to make changes to the DB (only the gdoc regeneration was required)
    if (!existingGdocId) {
        post.gdocSuccessorId = gdocId
        // This is not ideal - we are using knex for on thing and typeorm for another
        // which means that we can't wrap this in a transaction. We should probably
        // move posts to use typeorm as well or at least have a typeorm alternative for it
        await trx
            .table(PostsTableName)
            .where({ id: postId })
            .update("gdocSuccessorId", gdocId)

        const gdoc = new GdocPost(gdocId)
        gdoc.slug = post.slug
        gdoc.content.title = post.title
        gdoc.content.type = archieMl.content.type || OwidGdocType.Article
        gdoc.published = false
        gdoc.createdAt = new Date()
        gdoc.publishedAt = post.published_at
        await upsertGdoc(trx, gdoc)
        await setTagsForGdoc(trx, gdocId, tags)
    }
    return { googleDocsId: gdocId }
}

export async function handleUnlinkGdoc(
    req: Request,
    _res: e.Response<any, Record<string, any>>,
    trx: db.KnexReadWriteTransaction
) {
    const postId = expectInt(req.params.postId)
    const post = (await trx
        .table("posts_with_gdoc_publish_status")
        .where({ id: postId })
        .select("*")
        .first()) as DbRawPostWithGdocPublishStatus | undefined

    if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
    const existingGdocId = post.gdocSuccessorId
    if (!existingGdocId)
        throw new JsonError("No gdoc exists for this post", 400)
    if (existingGdocId && post.isGdocPublished) {
        throw new JsonError(
            "The GDoc is already published - you can't unlink it",
            400
        )
    }
    // This is not ideal - we are using knex for on thing and typeorm for another
    // which means that we can't wrap this in a transaction. We should probably
    // move posts to use typeorm as well or at least have a typeorm alternative for it
    await trx
        .table(PostsTableName)
        .where({ id: postId })
        .update("gdocSuccessorId", null)

    await trx.table(PostsGdocsTableName).where({ id: existingGdocId }).delete()

    return { success: true }
}

getRouteWithROTransaction(apiRouter, "/posts.json", handleGetPostsJson)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/setTags",
    handleSetTagsForPost
)

getRouteWithROTransaction(apiRouter, "/posts/:postId.json", handleGetPostById)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/createGdoc",
    handleCreateGdoc
)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/unlinkGdoc",
    handleUnlinkGdoc
)
