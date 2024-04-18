import { BreadcrumbItem } from "../domainTypes/Site.js"
import { JsonString } from "../domainTypes/Various.js"
import {
    OwidGdocContent,
    OwidGdocPublicationContext,
} from "../gdocTypes/Gdoc.js"
import { MinimalTag } from "./Tags.js"

export const PostsGdocsTableName = "posts_gdocs"
export interface DbInsertPostGdoc {
    breadcrumbs?: JsonString | null
    content: JsonString
    createdAt: Date
    id: string
    markdown?: string | null
    publicationContext?: OwidGdocPublicationContext
    published: number
    publishedAt?: Date | null
    revisionId?: string | null
    slug: string
    updatedAt?: Date | null
}
export type DbRawPostGdoc = Required<DbInsertPostGdoc>
export type DbEnrichedPostGdoc = Omit<
    DbRawPostGdoc,
    "content" | "breadcrumbs" | "published"
> & {
    content: OwidGdocContent
    breadcrumbs: BreadcrumbItem[] | null
    published: boolean
}

export type DBRawPostGdocWithTags = DbRawPostGdoc & {
    tags: MinimalTag[]
}

export type DBEnrichedPostGdocWithTags = DbEnrichedPostGdoc & {
    tags: MinimalTag[]
}

export function parsePostGdocContent(content: JsonString): OwidGdocContent {
    return JSON.parse(content)
}

export function serializePostGdocContent(content: OwidGdocContent): JsonString {
    return JSON.stringify(content)
}

export function parsePostsGdocsBreadcrumbs(
    breadcrumbs: JsonString | null
): BreadcrumbItem[] | null {
    return breadcrumbs ? JSON.parse(breadcrumbs) : null
}

export function serializePostsGdocsBreadcrumbs(
    breadcrumbs: BreadcrumbItem[] | null
): JsonString | null {
    return breadcrumbs ? JSON.stringify(breadcrumbs) : null
}

export function parsePostsGdocsRow(row: DbRawPostGdoc): DbEnrichedPostGdoc {
    return {
        ...row,
        content: parsePostGdocContent(row.content),
        breadcrumbs: parsePostsGdocsBreadcrumbs(row.breadcrumbs),
        published: !!row.published,
    }
}

export function parsePostsGdocsWithTagsRow(
    row: DBRawPostGdocWithTags
): DBEnrichedPostGdocWithTags {
    return {
        ...parsePostsGdocsRow(row),
        tags: row.tags,
    }
}

export function serializePostsGdocsRow(row: DbEnrichedPostGdoc): DbRawPostGdoc {
    return {
        ...row,
        content: serializePostGdocContent(row.content),
        breadcrumbs: serializePostsGdocsBreadcrumbs(row.breadcrumbs),
        published: row.published ? 1 : 0,
    }
}
