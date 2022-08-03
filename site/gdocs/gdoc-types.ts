export interface OwidArticleBlock {
    type: string
    value: string | any
}

export interface OwidArticleContent {
    body: OwidArticleBlock[]
    title: string
    subtitle: string
    template: string
    byline: string | string[]
    dateline?: string
    refs?: OwidArticleBlock[]
    summary?: OwidArticleBlock[]
    citation?: OwidArticleBlock[]
    "cover-image"?: any
    "featured-image"?: any
}

export interface OwidArticleType {
    content: OwidArticleContent
    slug: string
    createdAt: Date
    updatedAt: Date
    published: boolean
    documentId: string
    id: number
}
