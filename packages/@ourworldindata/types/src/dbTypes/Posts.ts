import {
    WP_PostType,
    FormattingOptions,
} from "../wordpressTypes/WordpressTypes.js"
import {
    OwidArticleBackportingStatistics,
    OwidGdocPostInterface,
} from "../gdocTypes/Gdoc.js"

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
