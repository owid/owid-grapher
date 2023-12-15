import { FormattingOptions, WP_PostType } from "../owidTypes.js"

export interface PostRowPlainFields {
    id: number
    title: string
    slug: string
    type: WP_PostType
    status: string
    content: string
    published_at: Date | null
    updated_at: Date | null
    updated_at_in_wordpress: Date | null
    archieml: string
    archieml_update_statistics: string
    gdocSuccessorId: string | null
    excerpt: string
    created_at_in_wordpress: Date | null
    featured_image: string
}

export interface PostRowUnparsedFields {
    authors: string
    formattingOptions: string
}

export interface PostRowParsedFields {
    authors: string[]
    formattingOptions: FormattingOptions
}
export type PostRowRaw = PostRowPlainFields & PostRowUnparsedFields
export type PostRowEnriched = PostRowPlainFields & PostRowParsedFields
