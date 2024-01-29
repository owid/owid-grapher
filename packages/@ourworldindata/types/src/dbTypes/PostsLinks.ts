import { OwidGdocLinkType } from "../gdocTypes/Gdoc.js"

export const PostsLinksTableName = "posts_links"
export interface DbInsertPostLink {
    componentType: string
    hash: string
    id?: number
    linkType?: OwidGdocLinkType | null
    queryString: string
    sourceId: number
    target: string
    text: string
}
export type DbPlainPostLink = Required<DbInsertPostLink>
