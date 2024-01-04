import {
    WP_PostType,
    FormattingOptions,
} from "../wordpressTypes/WordpressTypes.js"
import {
    OwidArticleBackportingStatistics,
    OwidGdocPostInterface,
} from "../gdocTypes/Gdoc.js"

export const PostRowTableName = "posts"
export interface PostRowPlainFields {
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
}

export interface PostRowUnparsedFields {
    authors?: string | null
    formattingOptions?: string | null
    archieml?: string | null
    archieml_update_statistics?: string | null
}

export interface PostRowParsedFields {
    authors: string[] | null
    formattingOptions: FormattingOptions | null
    archieml: OwidGdocPostInterface | null
    archieml_update_statistics: OwidArticleBackportingStatistics | null
}
export type PostRowForInsert = PostRowPlainFields & PostRowUnparsedFields

export type PostRowRaw = Required<PostRowForInsert>
export type PostRowEnriched = Required<PostRowPlainFields & PostRowParsedFields>
export interface PostRowWithGdocPublishStatus extends PostRowRaw {
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

export function parsePostRow(postRow: PostRowRaw): PostRowEnriched {
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
    }
}

export function serializePostRow(postRow: PostRowEnriched): PostRowRaw {
    return {
        ...postRow,
        authors: JSON.stringify(postRow.authors),
        formattingOptions: JSON.stringify(postRow.formattingOptions),
        archieml: JSON.stringify(postRow.archieml),
        archieml_update_statistics: JSON.stringify(
            postRow.archieml_update_statistics
        ),
    }
}
