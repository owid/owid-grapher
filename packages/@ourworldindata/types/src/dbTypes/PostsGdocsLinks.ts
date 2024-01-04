import { OwidGdocLinkType } from "../gdocTypes/Gdoc.js"

export const PostsGdocsLinksRowTableName = "posts_gdocs_links"
export interface PostsGdocsLinksRowForInsert {
    componentType: string
    hash: string
    id?: number
    linkType?: OwidGdocLinkType | null
    queryString: string
    sourceId?: string | null
    target: string
    text: string
}
export type PostsGdocsLinksRow = Required<PostsGdocsLinksRowForInsert>
