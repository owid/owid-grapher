import { OwidGdocLinkType } from "../gdocTypes/Gdoc.js"

export const PostsGdocsLinksTableName = "posts_gdocs_links"
export interface DbInsertPostGdocLink {
    componentType: string
    hash: string
    id?: number
    linkType?: OwidGdocLinkType | null
    queryString: string
    sourceId?: string | null
    target: string
    text: string
}
export type DbPlainPostGdocLink = Required<DbInsertPostGdocLink>
