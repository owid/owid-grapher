import { BreadcrumbItem } from "../domainTypes/Site.js"
import { JsonString } from "../domainTypes/Various.js"
import {
    OwidGdocContent,
    OwidGdocPublicationContext,
    OwidGdocType,
} from "../gdocTypes/Gdoc.js"
import { MinimalTag } from "./Tags.js"

export const PostsGdocsTableName = "posts_gdocs"
export interface DbInsertPostGdoc {
    manualBreadcrumbs?: JsonString | null
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
export type DbRawPostGdoc = Required<DbInsertPostGdoc> & {
    type?: OwidGdocType
    authors?: JsonString
}
export type DbEnrichedPostGdoc = Omit<
    DbRawPostGdoc,
    "content" | "manualBreadcrumbs" | "published" | "authors"
> & {
    content: OwidGdocContent
    manualBreadcrumbs: BreadcrumbItem[] | null
    published: boolean
    authors?: string[]
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

export function parsePostGdocsAuthors(
    authors: JsonString | undefined
): string[] {
    return authors ? JSON.parse(authors) : []
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
        manualBreadcrumbs: parsePostsGdocsBreadcrumbs(row.manualBreadcrumbs),
        published: !!row.published,
        authors: parsePostGdocsAuthors(row.authors),
    }
}

export function parsePostsGdocsWithTagsRow(
    row: DBRawPostGdocWithTags
): DBEnrichedPostGdocWithTags {
    return {
        ...parsePostsGdocsRow(row),
        tags: JSON.parse(row.tags),
    }
}

export function serializePostsGdocsRow(
    row: DbEnrichedPostGdoc
): DbInsertPostGdoc {
    // Kind of awkward, but some props may be set on the row but we don't want to insert them.
    // So we remove them here.
    const KEYS_TO_REMOVE = ["breadcrumbs", "type", "authors"]

    KEYS_TO_REMOVE.forEach((key) => {
        if (key in row) {
            delete (row as any)[key]
        }
    })
    return {
        ...row,
        content: serializePostGdocContent(row.content),
        manualBreadcrumbs: serializePostsGdocsBreadcrumbs(
            row.manualBreadcrumbs
        ),
        published: row.published ? 1 : 0,
    }
}
