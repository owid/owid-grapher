import { ContentGraphLinkType } from "../domainTypes/ContentGraph.js"

export const PostsGdocsLinksTableName = "posts_gdocs_links"

export interface DbInsertPostGdocLink {
    id?: number
    sourceId: string
    target: string
    linkType?: ContentGraphLinkType | null
    componentType: string
    text: string
    queryString: string
    hash: string
}

export type DbPlainPostGdocLink = Required<DbInsertPostGdocLink>
