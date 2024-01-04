import { BreadcrumbItem } from "../domainTypes/Site.js"
import { JsonString } from "../domainTypes/Various.js"
import {
    OwidGdocContent,
    OwidGdocPublicationContext,
} from "../gdocTypes/Gdoc.js"

export const PostsGdocsRowTableName = "posts_gdocs"
export interface PostsGdocsRowForInsert {
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
export type PostsGdocsRowRaw = Required<PostsGdocsRowForInsert>
export type PostsGdocsRowEnriched = Omit<
    PostsGdocsRowRaw,
    "content" | "breadcrumbs"
> & {
    content: OwidGdocContent
    breadcrumbs: BreadcrumbItem[] | null
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

export function parsePostsGdocsRow(
    row: PostsGdocsRowRaw
): PostsGdocsRowEnriched {
    return {
        ...row,
        content: parsePostGdocContent(row.content),
        breadcrumbs: parsePostsGdocsBreadcrumbs(row.breadcrumbs),
    }
}

export function serializePostsGdocsRow(
    row: PostsGdocsRowEnriched
): PostsGdocsRowRaw {
    return {
        ...row,
        content: serializePostGdocContent(row.content),
        breadcrumbs: serializePostsGdocsBreadcrumbs(row.breadcrumbs),
    }
}
