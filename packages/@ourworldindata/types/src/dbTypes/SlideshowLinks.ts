import { ContentGraphLinkType } from "../domainTypes/ContentGraph.js"

export const SlideshowLinksTableName = "slideshow_links"

export interface DbInsertSlideshowLink {
    id?: number
    slideshowId: number
    target: string
    linkType: ContentGraphLinkType
    queryString?: string
    hash?: string
}

export type DbPlainSlideshowLink = Required<DbInsertSlideshowLink>
