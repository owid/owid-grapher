import { ContentGraphLinkType } from "../domainTypes/ContentGraph.js"

export const DodLinksTableName = "dod_links"

export interface DbInsertDodLink {
    id?: number
    dodId: number
    target: string
    linkType: ContentGraphLinkType
    text: string
    queryString?: string
    hash?: string
}

export type DbPlainDodLink = Required<DbInsertDodLink>
