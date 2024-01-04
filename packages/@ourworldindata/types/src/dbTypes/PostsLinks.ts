import { OwidGdocLinkType } from "../gdocTypes/Gdoc.js"

export const PostsLinksRowTableName = "posts_links"
export interface PostsLinksRowForInsert {
    componentType: string
    hash: string
    id?: number
    linkType?: OwidGdocLinkType | null
    queryString: string
    sourceId: number
    target: string
    text: string
}
export type PostsLinksRow = Required<PostsLinksRowForInsert>
