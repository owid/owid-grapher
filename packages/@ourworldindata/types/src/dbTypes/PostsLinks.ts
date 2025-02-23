import { ContentGraphLinkType } from "../domainTypes/ContentGraph.js"

export const PostsLinksTableName = "posts_links"
export interface DbInsertPostLink {
    componentType: string
    hash: string
    id?: number
    linkType?: ContentGraphLinkType | null
    queryString: string
    sourceId: number
    target: string
    text: string
}
export type DbPlainPostLink = Required<DbInsertPostLink>
