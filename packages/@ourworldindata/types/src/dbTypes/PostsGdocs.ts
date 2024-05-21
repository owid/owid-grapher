import { DbEnrichedAuthor } from "../domainTypes/Author.js"
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
    authors: DbEnrichedAuthor[]
    content: OwidGdocContent
    breadcrumbs: BreadcrumbItem[] | null
    published: boolean
}

export type DBRawPostGdocWithTags = DbRawPostGdoc & {
    tags: string
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
        authors: [],
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
        authors: [],
        tags: JSON.parse(row.tags),
    }
}

export function serializePostsGdocsRow(row: DbEnrichedPostGdoc): DbRawPostGdoc {
    const { authors: _authors, ...rowWithoutAuthors } = row

    return {
        ...rowWithoutAuthors,
        content: serializePostGdocContent(rowWithoutAuthors.content),
        breadcrumbs: serializePostsGdocsBreadcrumbs(
            rowWithoutAuthors.breadcrumbs
        ),
        published: rowWithoutAuthors.published ? 1 : 0,
    }
}
