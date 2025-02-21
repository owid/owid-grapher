import { OwidGdocLinkType } from "../gdocTypes/Gdoc.js"

export const DodLinksTableName = "dod_links"

export interface DbInsertDodLink {
    id?: number
    dodId: number
    target: string
    linkType: OwidGdocLinkType
    text: string
    queryString?: string
    hash?: string
}

export type DbPlainDodLink = Required<DbInsertDodLink>
