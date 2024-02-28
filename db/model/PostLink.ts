import { formatUrls } from "../../site/formatting.js"
import {
    DbInsertPostLink,
    DbPlainPostLink,
    PostsLinksTableName,
    Url,
} from "@ourworldindata/utils"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { KnexReadWriteTransaction, KnexReadonlyTransaction } from "../db.js"
export function postLinkCreateFromUrl({
    url,
    sourceId,
    text = "",
    componentType = "",
}: {
    url: string
    sourceId: number
    text?: string
    componentType?: string
}): Omit<DbPlainPostLink, "id"> {
    const formattedUrl = formatUrls(url)
    const urlObject = Url.fromURL(formattedUrl)
    const linkType = getLinkType(formattedUrl)
    const target = getUrlTarget(formattedUrl)
    const queryString = urlObject.queryStr
    const hash = urlObject.hash
    return {
        target,
        linkType,
        queryString,
        hash,
        sourceId,
        text,
        componentType,
    }
}

export async function getPostLinkById(
    knex: KnexReadonlyTransaction,
    id: number
): Promise<DbPlainPostLink | undefined> {
    return knex<DbPlainPostLink>(PostsLinksTableName).where({ id }).first()
}

export async function getAllPostLinks(
    knex: KnexReadonlyTransaction
): Promise<DbPlainPostLink[]> {
    return knex<DbPlainPostLink>(PostsLinksTableName)
}

export async function getPostLinksBySourceId(
    knex: KnexReadonlyTransaction,
    sourceId: number
): Promise<DbPlainPostLink[]> {
    return knex<DbPlainPostLink>(PostsLinksTableName).where({ sourceId })
}

export async function insertPostLink(
    knex: KnexReadWriteTransaction,
    postLink: DbInsertPostLink
): Promise<{ id: number }> {
    return knex(PostsLinksTableName).returning("id").insert(postLink)
}

export async function insertManyPostLinks(
    knex: KnexReadWriteTransaction,
    postLinks: DbInsertPostLink[]
): Promise<void> {
    return knex.batchInsert(PostsLinksTableName, postLinks)
}

export async function updatePostLink(
    knex: KnexReadWriteTransaction,
    id: number,
    postLink: DbInsertPostLink
): Promise<void> {
    return knex(PostsLinksTableName).where({ id }).update(postLink)
}

export async function deletePostLink(
    knex: KnexReadWriteTransaction,
    id: number
): Promise<void> {
    return knex(PostsLinksTableName).where({ id }).delete()
}

export async function deleteManyPostLinks(
    knex: KnexReadWriteTransaction,
    ids: number[]
): Promise<void> {
    return knex(PostsLinksTableName).whereIn("id", ids).delete()
}
