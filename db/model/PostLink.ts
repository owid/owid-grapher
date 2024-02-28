import { formatUrls } from "../../site/formatting.js"
import {
    DbInsertPostLink,
    DbPlainPostLink,
    PostsLinksTableName,
    Url,
} from "@ourworldindata/utils"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { Knex } from "knex"
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
    knex: Knex<any, any[]>,
    id: number
): Promise<DbPlainPostLink | undefined> {
    return knex<DbPlainPostLink>(PostsLinksTableName).where({ id }).first()
}

export async function getAllPostLinks(
    knex: Knex<any, any[]>
): Promise<DbPlainPostLink[]> {
    return knex<DbPlainPostLink>(PostsLinksTableName)
}

export async function getPostLinksBySourceId(
    knex: Knex<any, any[]>,
    sourceId: number
): Promise<DbPlainPostLink[]> {
    return knex<DbPlainPostLink>(PostsLinksTableName).where({ sourceId })
}

export async function insertPostLink(
    knex: Knex<any, any[]>,
    postLink: DbInsertPostLink
): Promise<{ id: number }> {
    return knex(PostsLinksTableName).returning("id").insert(postLink)
}

export async function insertManyPostLinks(
    knex: Knex<any, any[]>,
    postLinks: DbInsertPostLink[]
): Promise<void> {
    return knex.batchInsert(PostsLinksTableName, postLinks)
}

export async function updatePostLink(
    knex: Knex<any, any[]>,
    id: number,
    postLink: DbInsertPostLink
): Promise<void> {
    return knex(PostsLinksTableName).where({ id }).update(postLink)
}

export async function deletePostLink(
    knex: Knex<any, any[]>,
    id: number
): Promise<void> {
    return knex(PostsLinksTableName).where({ id }).delete()
}

export async function deleteManyPostLinks(
    knex: Knex<any, any[]>,
    ids: number[]
): Promise<void> {
    return knex(PostsLinksTableName).whereIn("id", ids).delete()
}
