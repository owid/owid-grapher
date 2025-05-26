import {
    WP_PostType,
    FormattingOptions,
    PostRestApi,
    BlockGraphQlApi,
} from "../wordpressTypes/WordpressTypes.js"
import { OwidGdocPostInterface } from "../gdocTypes/Gdoc.js"

export const PostsTableName = "posts"
export interface DbInsertPost {
    id: number
    title: string
    slug: string
    type: WP_PostType
    status: string
    content: string
    published_at?: Date | null
    updated_at?: Date | null
    updated_at_in_wordpress?: Date | null
    excerpt?: string | null
    created_at_in_wordpress?: Date | null
    featured_image: string
    markdown: string
    authors?: string | null
    formattingOptions?: string | null
    archieml?: string | null
    wpApiSnapshot?: string | null
}
export type DbRawPost = Required<DbInsertPost>
export type DbEnrichedPost = Omit<
    DbRawPost,
    "authors" | "formattingOptions" | "archieml" | "wpApiSnapshot"
> & {
    authors: string[] | null
    formattingOptions: FormattingOptions | null
    archieml: OwidGdocPostInterface | null
    wpApiSnapshot: PostRestApi | BlockGraphQlApi | null
}

export function parsePostFormattingOptions(
    formattingOptions: string
): FormattingOptions {
    return JSON.parse(formattingOptions)
}

export function parsePostAuthors(authors: string): string[] {
    const authorsJson = JSON.parse(authors)
    return authorsJson
}

export function parsePostArchieml(archieml: string): any {
    // TODO: validation would be nice here
    return JSON.parse(archieml)
}

function parsePostWpApiSnapshot(wpApiSnapshot: string): PostRestApi {
    return JSON.parse(wpApiSnapshot)
}

export function parsePostRow(postRow: DbRawPost): DbEnrichedPost {
    return {
        ...postRow,
        authors: postRow.authors ? parsePostAuthors(postRow.authors) : null,
        formattingOptions: postRow.formattingOptions
            ? parsePostFormattingOptions(postRow.formattingOptions)
            : null,
        archieml: postRow.archieml ? parsePostArchieml(postRow.archieml) : null,
        wpApiSnapshot: postRow.wpApiSnapshot
            ? parsePostWpApiSnapshot(postRow.wpApiSnapshot)
            : null,
    }
}

export const snapshotIsPostRestApi = (
    snapshot: PostRestApi | BlockGraphQlApi
): snapshot is PostRestApi => {
    return [WP_PostType.Page, WP_PostType.Post].includes(
        (snapshot as PostRestApi).type
    )
}

export const snapshotIsBlockGraphQlApi = (
    snapshot: PostRestApi | BlockGraphQlApi
): snapshot is BlockGraphQlApi => {
    return (snapshot as BlockGraphQlApi).data?.wpBlock?.content !== undefined
}
