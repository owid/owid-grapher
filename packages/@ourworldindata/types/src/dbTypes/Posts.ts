import {
    WP_PostType,
    FormattingOptions,
    PostRestApi,
    BlockGraphQlApi,
} from "../wordpressTypes/WordpressTypes.js"
import {
    OwidArticleBackportingStatistics,
    OwidGdocPostInterface,
} from "../gdocTypes/Gdoc.js"

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
    gdocSuccessorId?: string | null
    excerpt?: string | null
    created_at_in_wordpress?: Date | null
    featured_image: string
    markdown: string
    authors?: string | null
    formattingOptions?: string | null
    archieml?: string | null
    archieml_update_statistics?: string | null
    wpApiSnapshot?: string | null
}
export type DbRawPost = Required<DbInsertPost>
export type DbEnrichedPost = Omit<
    DbRawPost,
    | "authors"
    | "formattingOptions"
    | "archieml"
    | "archieml_update_statistics"
    | "wpApiSnapshot"
> & {
    authors: string[] | null
    formattingOptions: FormattingOptions | null
    archieml: OwidGdocPostInterface | null
    archieml_update_statistics: OwidArticleBackportingStatistics | null
    wpApiSnapshot: PostRestApi | BlockGraphQlApi | null
}
export interface DbRawPostWithGdocPublishStatus extends DbRawPost {
    isGdocPublished: boolean
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

export function parsePostRow(postRow: DbRawPost): DbEnrichedPost {
    return {
        ...postRow,
        authors: postRow.authors ? parsePostAuthors(postRow.authors) : null,
        formattingOptions: postRow.formattingOptions
            ? parsePostFormattingOptions(postRow.formattingOptions)
            : null,
        archieml: postRow.archieml ? parsePostArchieml(postRow.archieml) : null,
        archieml_update_statistics: postRow.archieml_update_statistics
            ? JSON.parse(postRow.archieml_update_statistics)
            : null,
        wpApiSnapshot: postRow.wpApiSnapshot
            ? JSON.parse(postRow.wpApiSnapshot)
            : null,
    }
}

export function serializePostRow(postRow: DbEnrichedPost): DbRawPost {
    return {
        ...postRow,
        authors: JSON.stringify(postRow.authors),
        formattingOptions: JSON.stringify(postRow.formattingOptions),
        archieml: JSON.stringify(postRow.archieml),
        archieml_update_statistics: JSON.stringify(
            postRow.archieml_update_statistics
        ),
        wpApiSnapshot: JSON.stringify(postRow.wpApiSnapshot),
    }
}

export const snapshotIsPostRestApi = (
    snapshot: PostRestApi | BlockGraphQlApi | undefined | null
): snapshot is PostRestApi => {
    if (!snapshot) return false

    return [WP_PostType.Page, WP_PostType.Post].includes(
        (snapshot as PostRestApi).type
    )
}
